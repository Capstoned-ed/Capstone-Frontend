import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import authApi from '../../api/auth';
import '../../styles/auth/ForgotPasswordModal.css';

const OTP_STORAGE_KEY = 'regquest_password_reset_otps';

function maskEmailAddress(email = '') {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, local.length - 3))}${local.slice(-1)}@${domain}`;
}

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  initialIdentifier = '',
  onPasswordResetSuccess,
}) {
  const [step, setStep] = useState('request');
  const [identifier, setIdentifier] = useState(initialIdentifier || '');
  const [resolvedUsername, setResolvedUsername] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputRefs = useRef([]);

  useEffect(() => {
    if (isOpen) {
      setStep('request');
      if (initialIdentifier) {
        setIdentifier(initialIdentifier);
      }
      setErrorMessage('');
      setInfoMessage('');
    }
  }, [isOpen, initialIdentifier]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const resetAllState = () => {
    setStep('request');
    setOtpDigits(['', '', '', '', '', '']);
    setGeneratedOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setErrorMessage('');
    setInfoMessage('');
    setIsLoading(false);
  };

  const handleClose = () => {
    resetAllState();
    onClose();
  };

  const resolveAccountFromStorage = (cleanId) => {
    try {
      const cachedUsers = JSON.parse(localStorage.getItem('regquest_users_cache') || '[]');
      const matched = cachedUsers.find(
        (u) =>
          (u.email && u.email.toLowerCase() === cleanId.toLowerCase()) ||
          (u.username && String(u.username).toLowerCase() === cleanId.toLowerCase()) ||
          (u.student_id && String(u.student_id).toLowerCase() === cleanId.toLowerCase())
      );
      if (matched) {
        return {
          username: matched.username || matched.student_id || cleanId,
          email: matched.email || (cleanId.includes('@') ? cleanId : `${cleanId}@ustp.edu.ph`),
          name:
            [matched.first_name, matched.last_name].filter(Boolean).join(' ') ||
            matched.name ||
            matched.username ||
            cleanId,
        };
      }
    } catch {}

    return {
      username: cleanId,
      email: cleanId.includes('@') ? cleanId : `${cleanId}@ustp.edu.ph`,
      name: cleanId,
    };
  };

  const sendFrontendSmtpEmail = async ({ toEmail, toName, username, otpCode }) => {
    try {
      const smtpRes = await axios.post('/__smtp/send-otp', {
        toEmail,
        toName,
        username,
        otpCode,
      });
      if (smtpRes.data?.sent) {
        return { sent: true };
      }
    } catch (err) {
      if (err.response?.data?.detail) {
        return { sent: false, error: err.response.data.detail };
      }
    }

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (serviceId && templateId && publicKey) {
      try {
        await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            to_email: toEmail,
            to_name: toName,
            username,
            otp_code: otpCode,
            app_name: 'RegQuest USTP',
          },
        });
        return { sent: true };
      } catch (err) {
        return { sent: false, error: err.message };
      }
    }

    if (toEmail && toEmail.includes('@')) {
      try {
        const formSubmitRes = await axios.post(
          `https://formsubmit.co/ajax/${encodeURIComponent(toEmail)}`,
          {
            _subject: 'RegQuest Password Reset Verification Code',
            _template: 'table',
            _captcha: 'false',
            Account_ID: username,
            Verification_Code: otpCode,
            Instructions: `Use the 6-digit verification code (${otpCode}) to reset your RegQuest password. This code expires in 15 minutes.`,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          }
        );
        if (formSubmitRes.data?.success === 'true' || formSubmitRes.data?.success === true) {
          return { sent: true };
        }
        if (formSubmitRes.data?.message) {
          return { sent: true, notice: formSubmitRes.data.message };
        }
      } catch {}
    }

    return { sent: false };
  };

  const handleRequestCode = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMessage('Please enter your registered Email Address or ID Number.');
      return;
    }

    setIsLoading(true);
    try {
      let masked = '';
      let noticeMsg = '';

      try {
        const res = await authApi.requestPasswordReset(cleanId);
        masked = res?.masked_email || '';
        noticeMsg = res?.detail || '';
      } catch (apiErr) {
        console.warn('Backend requestPasswordReset notice:', apiErr);
      }

      const account = resolveAccountFromStorage(cleanId);
      const finalMasked = masked || maskEmailAddress(account.email || cleanId);

      setResolvedUsername(account.username);
      setResolvedEmail(account.email);
      setMaskedEmail(finalMasked);
      setOtpDigits(['', '', '', '', '', '']);
      setStep('verify');
      setResendCooldown(60);
      setInfoMessage(
        noticeMsg ||
          `A 6-digit verification code has been sent to ${finalMasked}.`
      );
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail ||
          'Failed to request verification code. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index, value) => {
    const raw = value.replace(/\D/g, '');
    if (raw.length > 1) {
      // Handles autofill or paste where multiple digits are injected into a single field
      const nextDigits = [...otpDigits];
      for (let i = 0; i < 6 - index && i < raw.length; i += 1) {
        nextDigits[index + i] = raw[i];
      }
      setOtpDigits(nextDigits);
      setErrorMessage('');
      const focusIndex = Math.min(index + raw.length, 5);
      otpInputRefs.current[focusIndex]?.focus();
      return;
    }

    const digit = raw.slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    setOtpDigits(nextDigits);
    setErrorMessage('');

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const nextDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < 6; i += 1) {
      nextDigits[i] = pasted[i] || '';
    }
    setOtpDigits(nextDigits);
    const focusIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  };

  const handleVerifyCode = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.verifyPasswordResetOtp(identifier.trim(), fullOtp);
      setStep('reset');
    } catch (apiErr) {
      const errMsg =
        apiErr.response?.data?.detail ||
        (typeof apiErr.response?.data === 'string' ? apiErr.response.data : null) ||
        'Invalid or expired verification code. Please check your email and try again.';
      setErrorMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation password do not match.');
      return;
    }

    const fullOtp = otpDigits.join('');
    setIsLoading(true);
    try {
      await authApi.confirmPasswordReset(
        identifier.trim(),
        fullOtp,
        newPassword.trim()
      );

      // Also update local cache so offline or cached profiles use the updated password
      const cleanId = identifier.trim();
      const customPasswords = JSON.parse(
        localStorage.getItem('regquest_custom_passwords') || '{}'
      );
      const record = {
        newPassword: newPassword.trim(),
        updatedAt: new Date().toISOString(),
      };
      customPasswords[cleanId] = record;
      customPasswords[cleanId.toLowerCase()] = record;
      if (resolvedUsername) {
        customPasswords[resolvedUsername] = record;
        customPasswords[String(resolvedUsername).toLowerCase()] = record;
      }
      localStorage.setItem(
        'regquest_custom_passwords',
        JSON.stringify(customPasswords)
      );

      if (typeof onPasswordResetSuccess === 'function') {
        onPasswordResetSuccess();
      }
      setStep('success');
    } catch (apiErr) {
      const errMsg =
        apiErr.response?.data?.detail ||
        (typeof apiErr.response?.data === 'string' ? apiErr.response.data : null) ||
        'Failed to reset password. Please check your verification code and try again.';
      setErrorMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishSuccess = () => {
    const loginUser = resolvedUsername || identifier.trim();
    handleClose();
    if (onPasswordResetSuccess) {
      onPasswordResetSuccess(loginUser);
    }
  };

  const stepIndex =
    step === 'request' ? 1 : step === 'verify' ? 2 : step === 'reset' ? 3 : 4;

  return createPortal(
    <div className="forgot-pw-overlay" onClick={handleClose}>
      <div className="forgot-pw-card" onClick={(e) => e.stopPropagation()}>
        <div className="forgot-pw-header-banner">
          <button
            type="button"
            onClick={handleClose}
            className="forgot-pw-close-btn"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="forgot-pw-header-icon">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>

          <h2 className="forgot-pw-title">Forgot Password</h2>
          <p className="forgot-pw-subtitle">
            {step === 'request' && 'Enter your email address to receive a verification code.'}
            {step === 'verify' && `Enter the 6-digit code sent to ${maskedEmail || 'your email'}.`}
            {step === 'reset' && 'Create a new secure password for your RegQuest account.'}
            {step === 'success' && 'Your password has been updated successfully.'}
          </p>
        </div>

        {step !== 'success' && (
          <div className="forgot-pw-steps-bar">
            <div
              className={`forgot-pw-step-item ${
                stepIndex === 1
                  ? 'forgot-pw-step-item-active'
                  : stepIndex > 1
                  ? 'forgot-pw-step-item-done'
                  : ''
              }`}
            >
              <span
                className={`forgot-pw-step-badge ${
                  stepIndex === 1
                    ? 'forgot-pw-step-badge-active'
                    : stepIndex > 1
                    ? 'forgot-pw-step-badge-done'
                    : ''
                }`}
              >
                {stepIndex > 1 ? '✓' : '1'}
              </span>
              <span>Account</span>
            </div>

            <div className="h-px flex-1 bg-slate-200 mx-2" />

            <div
              className={`forgot-pw-step-item ${
                stepIndex === 2
                  ? 'forgot-pw-step-item-active'
                  : stepIndex > 2
                  ? 'forgot-pw-step-item-done'
                  : ''
              }`}
            >
              <span
                className={`forgot-pw-step-badge ${
                  stepIndex === 2
                    ? 'forgot-pw-step-badge-active'
                    : stepIndex > 2
                    ? 'forgot-pw-step-badge-done'
                    : ''
                }`}
              >
                {stepIndex > 2 ? '✓' : '2'}
              </span>
              <span>Verify Code</span>
            </div>

            <div className="h-px flex-1 bg-slate-200 mx-2" />

            <div
              className={`forgot-pw-step-item ${
                stepIndex === 3 ? 'forgot-pw-step-item-active' : ''
              }`}
            >
              <span
                className={`forgot-pw-step-badge ${
                  stepIndex === 3 ? 'forgot-pw-step-badge-active' : ''
                }`}
              >
                3
              </span>
              <span>New Password</span>
            </div>
          </div>
        )}

        <div className="forgot-pw-body">
          {errorMessage && (
            <div className="forgot-pw-alert-error">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 'request' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label htmlFor="reset-identifier" className="forgot-pw-label">
                  Email Address
                </label>
                <div className="forgot-pw-input-wrap">
                  <div className="forgot-pw-input-icon">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                      />
                    </svg>
                  </div>
                  <input
                    id="reset-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={isLoading}
                    placeholder="Enter your email address"
                    className="forgot-pw-input"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  We will send a 6-digit verification code to your email address via SMTP.
                </p>
              </div>

              <div className="pt-1 space-y-2">
                <button type="submit" disabled={isLoading} className="forgot-pw-primary-btn">
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Sending Verification Code...</span>
                    </>
                  ) : (
                    <span>Send Verification Code</span>
                  )}
                </button>
                <button type="button" onClick={handleClose} className="forgot-pw-secondary-btn">
                  Back to Log In
                </button>
              </div>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-3">
              {infoMessage && (
                <div className="forgot-pw-alert-success">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{infoMessage}</span>
                </div>
              )}

              <div>
                <label className="forgot-pw-label text-center">
                  Enter 6-Digit Verification Code
                </label>
                <div className="forgot-pw-otp-grid" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      disabled={isLoading}
                      className="forgot-pw-otp-box"
                      autoFocus={idx === 0}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setErrorMessage('');
                  }}
                  className="forgot-pw-link-btn"
                >
                  Change Email
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || isLoading}
                  onClick={handleRequestCode}
                  className="forgot-pw-link-btn"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <div className="pt-1">
                <button type="submit" disabled={isLoading} className="forgot-pw-primary-btn">
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-new-password" className="forgot-pw-label">
                  New Password
                </label>
                <div className="forgot-pw-input-wrap">
                  <div className="forgot-pw-input-icon">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <input
                    id="reset-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="At least 6 characters"
                    className="forgot-pw-input-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="forgot-pw-eye-btn"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reset-confirm-password" className="forgot-pw-label">
                  Confirm New Password
                </label>
                <div className="forgot-pw-input-wrap">
                  <div className="forgot-pw-input-icon">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                      />
                    </svg>
                  </div>
                  <input
                    id="reset-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="Re-enter your new password"
                    className="forgot-pw-input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="forgot-pw-eye-btn"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-1 space-y-2">
                <button type="submit" disabled={isLoading} className="forgot-pw-primary-btn">
                  {isLoading ? 'Updating Password...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center py-3">
              <div className="forgot-pw-success-icon">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                Password Reset Complete!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                Your password has been updated. You can now sign in with your new password.
              </p>
              <button
                type="button"
                onClick={handleFinishSuccess}
                className="forgot-pw-primary-btn"
              >
                Continue to Log In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

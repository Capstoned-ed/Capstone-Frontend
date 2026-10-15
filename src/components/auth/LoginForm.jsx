import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function LoginForm({ onSuccess }) {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeModal, setNoticeModal] = useState(null); // 'forgot' | 'register' | null

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password) {
      setErrorMessage('Please enter both your Student ID / Email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(username.trim(), password);
      if (onSuccess) {
        onSuccess(result.user);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setErrorMessage(
          err.response?.data?.detail || 'Invalid credentials. Please check your Student ID / Email and password.'
        );
      } else if (err.response?.data) {
        const errorData = err.response.data;
        if (typeof errorData === 'string') {
          setErrorMessage(errorData);
        } else if (errorData.detail) {
          setErrorMessage(errorData.detail);
        } else if (errorData.non_field_errors) {
          setErrorMessage(errorData.non_field_errors.join(' '));
        } else {
          setErrorMessage('Login failed. Please verify your credentials and try again.');
        }
      } else {
        setErrorMessage('Unable to connect to the authentication server. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Title & Subtitle */}
      <h1 className="text-2xl sm:text-[28px] font-bold text-[#1a237e] tracking-tight">
        Log In
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 mt-1.5 mb-7">
        Please enter your credentials to continue
      </p>

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2 animate-fadeIn">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="leading-tight">{errorMessage}</span>
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Username / Student ID / Email Field */}
        <div>
          <label
            htmlFor="username"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Student ID / Email Address
          </label>
          <div className="relative flex items-center">
            {/* Mail Icon */}
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              placeholder="Enter your Student ID / Email"
              className="w-full bg-[#f8fafc] border border-slate-200 rounded-lg py-2.5 sm:py-3 pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#fbb643] focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Password
          </label>
          <div className="relative flex items-center">
            {/* Lock Icon */}
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Enter your password"
              className="w-full bg-[#f8fafc] border border-slate-200 rounded-lg py-2.5 sm:py-3 pl-10 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#fbb643] focus:border-transparent transition-all"
            />
            {/* Toggle Password Visibility */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
            >
              {showPassword ? (
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

        {/* Submit Button (Amber / Warm Yellow) */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-6 py-3 px-4 rounded-lg text-white font-bold text-sm sm:text-base tracking-wide bg-[#fbb643] hover:bg-[#fcae2b] active:scale-[0.99] transition-all duration-150 shadow-sm flex items-center justify-center space-x-2 disabled:opacity-75 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Logging in...</span>
            </>
          ) : (
            <span>Log In</span>
          )}
        </button>
      </form>

      {/* Footer Link */}
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={() => setNoticeModal('forgot')}
          className="text-xs font-semibold text-[#1a237e] hover:underline focus:outline-none"
        >
          Forgot password?
        </button>
      </div>

      {/* Institutional Account Recovery Notice Modal */}
      {noticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-[#1a237e] mx-auto flex items-center justify-center text-xl font-bold mb-3">
              🏛️
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Account Recovery
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
              RegQuest passwords can only be reset by institutional staff or campus administrators. Please visit your Registrar office or submit an institutional ticket.
            </p>
            <button
              type="button"
              onClick={() => setNoticeModal(null)}
              className="w-full py-2.5 px-4 rounded-lg bg-[#1a237e] text-white text-xs sm:text-sm font-semibold hover:bg-[#141b63] transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

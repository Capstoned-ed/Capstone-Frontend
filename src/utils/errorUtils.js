/**
 * Formats and extracts a clean, user-friendly error message from API errors.
 * Strictly prevents raw HTML error pages (e.g., 500 error pages starting with
 * '<!doctype html>' or '<html') from ever leaking into toast notifications.
 */
export function extractApiErrorMessage(
  err,
  fallback = 'An unexpected error occurred. Please try again.'
) {
  if (!err) return fallback;

  // If passed directly as a string
  if (typeof err === 'string') {
    const trimmed = err.trim();
    if (isHtmlString(trimmed)) {
      return 'A server error occurred. Please try again later.';
    }
    return trimmed || fallback;
  }

  const response = err.response;
  const status = response?.status;
  const data = response?.data;

  // If response body is a raw HTML string (e.g. Django 500 HTML debug page)
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (isHtmlString(trimmed)) {
      if (status >= 500) {
        return 'Server error encountered. Please try again later.';
      }
      if (status === 404) {
        return 'The requested resource was not found.';
      }
      if (status === 403) {
        return 'You do not have permission to perform this action.';
      }
      return 'An error occurred while communicating with the server.';
    }
    return trimmed || fallback;
  }

  if (data && typeof data === 'object') {
    // 1. Explicit O.R. / Payment reference error
    if (data.or_number) {
      const msg = Array.isArray(data.or_number) ? data.or_number[0] : data.or_number;
      if (msg && !isHtmlString(msg)) return String(msg);
    }
    if (data.receipt_reference_number) {
      const msg = Array.isArray(data.receipt_reference_number)
        ? data.receipt_reference_number[0]
        : data.receipt_reference_number;
      if (msg && !isHtmlString(msg)) return String(msg);
    }

    // 2. Unavailable credential error
    if (data.credential_type) {
      const msg = Array.isArray(data.credential_type)
        ? data.credential_type[0]
        : data.credential_type;
      if (msg && !isHtmlString(msg)) return String(msg);
    }

    // 3. Detail or message
    if (data.detail && !isHtmlString(data.detail)) {
      return String(data.detail);
    }
    if (data.message && !isHtmlString(data.message)) {
      return String(data.message);
    }

    // 4. Non-field errors
    if (data.non_field_errors) {
      const msg = Array.isArray(data.non_field_errors)
        ? data.non_field_errors[0]
        : data.non_field_errors;
      if (msg && !isHtmlString(msg)) return String(msg);
    }

    // 5. Any first field array
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        if (!isHtmlString(val[0])) {
          return `${val[0]}`;
        }
      } else if (typeof val === 'string' && val.trim() && !isHtmlString(val)) {
        return val.trim();
      }
    }
  }

  // Axios message
  if (err.message && typeof err.message === 'string' && !isHtmlString(err.message)) {
    if (err.message === 'Network Error') {
      return 'Network connection error. Please check your internet connection.';
    }
    return err.message;
  }

  return fallback;
}

function isHtmlString(str) {
  if (typeof str !== 'string') return false;
  const s = str.trim().toLowerCase();
  return (
    s.startsWith('<!doctype') ||
    s.startsWith('<html') ||
    s.includes('<head>') ||
    s.includes('<body>') ||
    s.includes('</div>') ||
    /<[a-z][\s\S]*>/i.test(str)
  );
}

export default extractApiErrorMessage;


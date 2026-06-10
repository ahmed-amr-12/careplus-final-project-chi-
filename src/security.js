// ═══════════════════════════════════════════════════
//  CarePlus — Security Utilities
//  دا الملف المسؤول عن كل حاجة أمانية في الفرونت إند
// ═══════════════════════════════════════════════════

// ─── XSS Sanitization ────────────────────────────
export function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .trim();
}

export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') clean[k] = sanitizeInput(v);
    else if (typeof v === 'object' && v !== null) clean[k] = sanitizeObject(v);
    else clean[k] = v;
  }
  return clean;
}

// ─── Input Validators ─────────────────────────────
export const validators = {
  username: (v) => /^[a-zA-Z0-9_]{3,30}$/.test(v)
    ? null : 'اسم المستخدم يجب أن يكون 3-30 حرف (أحرف وأرقام وـ فقط)',

  password: (v) => v && v.length >= 6
    ? null : 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',

  email: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    ? null : 'البريد الإلكتروني غير صحيح',

  phone: (v) => !v || /^01[0-2,5]{1}[0-9]{8}$/.test(v)
    ? null : 'رقم الهاتف غير صحيح (يجب أن يبدأ بـ 01)',

  price: (v) => !isNaN(v) && Number(v) >= 0
    ? null : 'السعر يجب أن يكون رقم موجب',

  quantity: (v) => !isNaN(v) && Number(v) >= 0 && Number.isInteger(Number(v))
    ? null : 'الكمية يجب أن تكون رقم صحيح موجب',

  barcode: (v) => v && v.trim().length >= 4
    ? null : 'الباركود يجب أن يكون 4 أحرف على الأقل',

  pin: (v) => v && /^\d{4,6}$/.test(v)
    ? null : 'PIN يجب أن يكون 4-6 أرقام',

  required: (v) => v && String(v).trim().length > 0
    ? null : 'هذا الحقل مطلوب',
};

export function validateForm(data, rules) {
  const errors = {};
  for (const [field, validatorKeys] of Object.entries(rules)) {
    for (const key of validatorKeys) {
      const err = validators[key]?.(data[field]);
      if (err) { errors[field] = err; break; }
    }
  }
  return errors;
}

// ─── Secure Token Storage ─────────────────────────
// بنخزن التوكن في memory بدل localStorage لأمان أكبر
// ولكن بنحتفظ بـ localStorage كـ fallback
let _memToken = null;

export const secureStorage = {
  setToken(token) {
    _memToken = token;
    try { localStorage.setItem('cp_token', token); } catch {}
  },
  getToken() {
    return _memToken || localStorage.getItem('cp_token');
  },
  setUser(user) {
    try { localStorage.setItem('cp_user', JSON.stringify(user)); } catch {}
  },
  getUser() {
    try { return JSON.parse(localStorage.getItem('cp_user')); } catch { return null; }
  },
  clear() {
    _memToken = null;
    try {
      localStorage.removeItem('cp_token');
      localStorage.removeItem('cp_user');
      sessionStorage.clear();
    } catch {}
  }
};

// ─── JWT Decoder (بدون verify — ده في الباك إند) ──
export function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

export function isTokenExpired(token) {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  // نضيف 30 ثانية buffer
  return Date.now() >= (payload.exp * 1000) - 30_000;
}

export function getTokenRemainingSeconds(token) {
  const payload = decodeToken(token);
  if (!payload?.exp) return 0;
  return Math.max(0, Math.floor((payload.exp * 1000 - Date.now()) / 1000));
}

// ─── Client-Side Rate Limiting ────────────────────
const _rateLimitStore = {};

export function clientRateLimit(key, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  if (!_rateLimitStore[key]) _rateLimitStore[key] = [];

  // نمسح الطلبات القديمة
  _rateLimitStore[key] = _rateLimitStore[key].filter(t => now - t < windowMs);

  if (_rateLimitStore[key].length >= maxAttempts) {
    const oldest = _rateLimitStore[key][0];
    const waitMs = windowMs - (now - oldest);
    const waitMin = Math.ceil(waitMs / 60000);
    return { blocked: true, message: `تجاوزت الحد المسموح. انتظر ${waitMin} دقيقة.` };
  }

  _rateLimitStore[key].push(now);
  return { blocked: false };
}

export function clearRateLimit(key) {
  delete _rateLimitStore[key];
}

// ─── SQL Injection Prevention ─────────────────────
// نمنع أي إدخال يحتوي على SQL keywords خطيرة
const SQL_PATTERNS = [
  /(\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bINSERT\b|\bUPDATE\b|\bSELECT\b)/i,
  /(--|;|\/\*|\*\/|xp_|UNION|EXEC|EXECUTE)/i,
  /('|('')|(%27)|(%2527))/,
];

export function containsSQLInjection(str) {
  if (typeof str !== 'string') return false;
  return SQL_PATTERNS.some(p => p.test(str));
}

export function validateNoSQLInjection(data) {
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && containsSQLInjection(value)) {
      return { safe: false, field: key };
    }
  }
  return { safe: true };
}

// ─── Session Activity Tracker ─────────────────────
let _activityListeners = [];
let _inactivityTimer = null;
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 دقيقة

export function startActivityWatcher(onTimeout) {
  stopActivityWatcher();

  const reset = () => {
    clearTimeout(_inactivityTimer);
    _inactivityTimer = setTimeout(onTimeout, INACTIVITY_LIMIT);
  };

  const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  events.forEach(ev => {
    const handler = () => reset();
    document.addEventListener(ev, handler, { passive: true });
    _activityListeners.push({ ev, handler });
  });

  reset();
}

export function stopActivityWatcher() {
  clearTimeout(_inactivityTimer);
  _activityListeners.forEach(({ ev, handler }) =>
    document.removeEventListener(ev, handler)
  );
  _activityListeners = [];
}

// ─── Content Security ────────────────────────────
// نمنع فتح روابط خارجية بشكل تلقائي
export function sanitizeUrl(url) {
  if (!url) return '#';
  try {
    const parsed = new URL(url, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '#';
    return parsed.href;
  } catch { return '#'; }
}

// ─── File Upload Security ─────────────────────────
const ALLOWED_SQL_SIGNATURES = ['--', 'SET ', 'CREATE ', 'INSERT ', 'DROP '];

export function validateSQLFile(file) {
  const errors = [];

  // نتحقق من الحجم (ماكس 50MB)
  if (file.size > 50 * 1024 * 1024) {
    errors.push('حجم الملف يتجاوز الحد المسموح (50MB)');
  }

  // نتحقق من الاسم
  if (!file.name.toLowerCase().endsWith('.sql')) {
    errors.push('يجب أن يكون الملف بصيغة .sql');
  }

  // نتحقق من اسم الملف (path traversal)
  if (/[/\\<>|:*?"]/g.test(file.name)) {
    errors.push('اسم الملف يحتوي على رموز غير مسموح بها');
  }

  return { valid: errors.length === 0, errors };
}

export async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsText(file, 'utf-8');
  });
}

// ─── Clipboard Security ───────────────────────────
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Password Strength ───────────────────────────
export function checkPasswordStrength(password) {
  let score = 0;
  const checks = {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /\d/.test(password),
    special:   /[^a-zA-Z0-9]/.test(password),
  };
  score = Object.values(checks).filter(Boolean).length;

  const levels = ['', 'ضعيف جداً', 'ضعيف', 'متوسط', 'قوي', 'قوي جداً'];
  const colors = ['', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#059669'];

  return { score, checks, label: levels[score] || '', color: colors[score] || '' };
}

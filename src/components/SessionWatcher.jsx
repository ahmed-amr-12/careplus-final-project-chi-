import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../AuthContext';
import {
  startActivityWatcher, stopActivityWatcher,
  getTokenRemainingSeconds, isTokenExpired, secureStorage
} from '../security';

const WARN_BEFORE_SECONDS = 5 * 60; // نحذر قبل 5 دقايق

export default function SessionWatcher() {
  const { token, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [barWidth, setBarWidth] = useState(100);
  const [showWarning, setShowWarning] = useState(false);
  const totalSeconds = useRef(0);
  const intervalRef = useRef(null);
  const warnToastRef = useRef(null);

  const doLogout = useCallback((reason = 'انتهت جلستك') => {
    stopActivityWatcher();
    clearInterval(intervalRef.current);
    logoutUser();
    toast.dismiss(warnToastRef.current);
    toast.error(`🔒 ${reason}. يرجى تسجيل الدخول مجدداً.`, { duration: 5000 });
    navigate('/login', { replace: true });
  }, [logoutUser, navigate]);

  useEffect(() => {
    if (!token) return;

    // نحسب الوقت الكلي من التوكن
    const remaining = getTokenRemainingSeconds(token);
    if (remaining <= 0) { doLogout('انتهت صلاحية الجلسة'); return; }
    totalSeconds.current = remaining;

    // نبدأ المراقبة
    startActivityWatcher(() => doLogout('انتهت جلستك بسبب عدم النشاط (30 دقيقة)'));

    // نحدث شريط الجلسة كل ثانية
    intervalRef.current = setInterval(() => {
      if (!secureStorage.getToken() || isTokenExpired(secureStorage.getToken())) {
        doLogout('انتهت صلاحية التوكن');
        return;
      }

      const rem = getTokenRemainingSeconds(secureStorage.getToken());
      const pct = Math.max(0, (rem / totalSeconds.current) * 100);
      setBarWidth(pct);

      // تحذير قبل 5 دقايق
      if (rem <= WARN_BEFORE_SECONDS && rem > 0 && !warnToastRef.current) {
        setShowWarning(true);
        warnToastRef.current = toast(
          (t) => (
            <div style={{ direction: 'rtl', fontFamily: 'Cairo' }}>
              <strong>⚠️ تنبيه:</strong> ستنتهي جلستك خلال {Math.ceil(rem / 60)} دقيقة.
              <br />
              <button
                onClick={() => { toast.dismiss(t.id); warnToastRef.current = null; setShowWarning(false); }}
                style={{ marginTop: '8px', padding: '4px 12px', background: '#1a7f6e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Cairo', fontSize: '13px' }}
              >
                حسناً، شكراً
              </button>
            </div>
          ),
          { duration: 10000 }
        );
      }

      if (rem <= 0) doLogout('انتهت صلاحية الجلسة');
    }, 1000);

    return () => {
      clearInterval(intervalRef.current);
      stopActivityWatcher();
    };
  }, [token, doLogout]);

  if (!token) return null;

  // شريط الجلسة في أعلى الصفحة
  const barColor = barWidth > 50 ? 'var(--primary)' : barWidth > 20 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: '3px', zIndex: 9999,
      background: 'var(--border)',
    }}>
      <div style={{
        height: '100%',
        width: `${barWidth}%`,
        background: barColor,
        transition: 'width 1s linear, background .5s',
        borderRadius: '0 999px 999px 0',
      }} />
    </div>
  );
}

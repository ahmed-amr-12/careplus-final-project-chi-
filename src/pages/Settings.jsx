import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { setupSecurity, getSecurity, dailyClosing, downloadBackup, restoreBackup, resetPin, getTodayReport } from '../api';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';
import {
  Download, Upload, Shield, Lock, AlertTriangle,
  CheckCircle, Eye, EyeOff, RefreshCw, Database
} from 'lucide-react';
import {
  validateSQLFile, validators, checkPasswordStrength,
  clientRateLimit, clearRateLimit
} from '../security';

function PinInput({ value, onChange, length = 6, label }) {
  const inputs = useRef([]);

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !e.target.value && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handleChange = (i, v) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = digit;
    const newVal = arr.join('').slice(0, length);
    onChange(newVal);
    if (digit && i < length - 1) inputs.current[i + 1]?.focus();
  };

  return (
    <div>
      {label && <label className="form-label">{label}</label>}
      <div className="pin-input">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={el => inputs.current[i] = el}
            className="pin-digit"
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={value[i] || ''}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            onFocus={e => e.target.select()}
            style={{ borderColor: value[i] ? 'var(--primary)' : undefined }}
          />
        ))}
      </div>
    </div>
  );
}

function RestoreSection() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const fileRef = useRef();
  const CONFIRM_WORD = 'استعادة';

  const handleFile = (f) => {
    if (!f) return;
    const validation = validateSQLFile(f);
    if (!validation.valid) {
      validation.errors.forEach(e => toast.error(e));
      return;
    }
    setFile(f);
    toast.success(`تم اختيار: ${f.name}`);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  };

  const doRestore = async () => {
    if (confirmText !== CONFIRM_WORD) {
      toast.error(`اكتب "${CONFIRM_WORD}" للتأكيد`);
      return;
    }
    if (!file) { toast.error('لم تختر ملف'); return; }

    const rl = clientRateLimit('restore', 3, 60 * 60 * 1000);
    if (rl.blocked) { toast.error(rl.message); return; }

    setUploading(true);
    setProgress(0);
    setConfirmOpen(false);
    setConfirmText('');

    try {
      const formData = new FormData();
      formData.append('backup', file);

      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 8, 85));
      }, 300);

      await restoreBackup(formData);
      clearInterval(progressInterval);
      setProgress(100);
      clearRateLimit('restore');
      toast.success('✅ تم استعادة قاعدة البيانات بنجاح!');
      setFile(null);
      setTimeout(() => setProgress(0), 2000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل الاستعادة — تأكد من صحة الملف');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'36px', height:'36px', background:'#fee2e2', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Database size={18} color="var(--danger)"/>
          </div>
          <span className="card-title">♻️ استعادة قاعدة البيانات</span>
        </div>
        <span className="badge badge-danger">خطر عالي</span>
      </div>
      <div className="card-body">
        <div className="alert alert-danger">
          <AlertTriangle size={16} style={{ flexShrink:0, marginTop:'1px' }}/>
          <div>
            <strong>تحذير هام:</strong> استعادة النسخة الاحتياطية ستمسح جميع البيانات الحالية وتستبدلها بالبيانات من الملف. هذه العملية لا يمكن التراجع عنها.
          </div>
        </div>

        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
          onClick={() => !file && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input ref={fileRef} type="file" accept=".sql" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
          {file ? (
            <div>
              <CheckCircle size={36} color="var(--success)" style={{ margin:'0 auto 12px', display:'block' }}/>
              <div style={{ fontWeight:'700', fontSize:'15px', color:'var(--success)' }}>{file.name}</div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>
                {(file.size / 1024).toFixed(1)} KB
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop:'12px', color:'var(--danger)' }} onClick={e => { e.stopPropagation(); setFile(null); }}>
                ✕ إزالة الملف
              </button>
            </div>
          ) : (
            <div>
              <Upload size={36} color="var(--text-muted)" style={{ margin:'0 auto 12px', display:'block' }}/>
              <div style={{ fontWeight:'600', color:'var(--text-secondary)' }}>اسحب ملف .sql هنا أو اضغط للاختيار</div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'6px' }}>فقط ملفات .sql — حتى 50MB</div>
            </div>
          )}
        </div>

        {progress > 0 && (
          <div style={{ marginTop:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'6px' }}>
              <span style={{ color:'var(--text-muted)' }}>جاري الاستعادة...</span>
              <span style={{ fontWeight:'700', color:'var(--primary)' }}>{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width:`${progress}%`, background:`linear-gradient(90deg, var(--primary), var(--accent))` }}/>
            </div>
          </div>
        )}

        <button
          className="btn btn-danger"
          style={{ marginTop:'16px', width:'100%', justifyContent:'center' }}
          disabled={!file || uploading}
          onClick={() => setConfirmOpen(true)}
        >
          {uploading ? <><span className="spinner"/> جاري الاستعادة...</> : <><RefreshCw size={16}/>بدء الاستعادة</>}
        </button>
      </div>

      {confirmOpen && createPortal(
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmOpen(false)}>
          <div className="modal" style={{ maxWidth:'440px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ color:'var(--danger)', display:'flex', alignItems:'center', gap:'8px' }}>
                <AlertTriangle size={20}/> تأكيد نهائي
              </span>
            </div>
            <div className="modal-body">
              <div className="alert alert-danger">
                ستُمسح <strong>جميع بيانات النظام الحالية</strong> ويتم استبدالها من الملف. هذا لا يمكن التراجع عنه.
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">اكتب كلمة "<strong>{CONFIRM_WORD}</strong>" للتأكيد</label>
                <input
                  className="form-control"
                  placeholder={`اكتب "${CONFIRM_WORD}"`}
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setConfirmOpen(false); setConfirmText(''); }}>إلغاء</button>
              <button
                className="btn btn-danger"
                disabled={confirmText !== CONFIRM_WORD}
                onClick={doRestore}
              >
                <RefreshCw size={15}/> تأكيد الاستعادة
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function BackupSection() {
  const [loading, setLoading] = useState(false);

  const handleBackup = async () => {
    setLoading(true);
    try {
      const { data } = await downloadBackup();
      const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `careplus_backup_${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('✅ تم تحميل النسخة الاحتياطية');
    } catch { toast.error('فشل تحميل النسخة الاحتياطية'); }
    finally { setLoading(false); }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'36px', height:'36px', background:'#dbeafe', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Download size={18} color="var(--info)"/>
          </div>
          <span className="card-title">💾 النسخ الاحتياطي</span>
        </div>
      </div>
      <div className="card-body">
        <p style={{ fontSize:'14px', color:'var(--text-secondary)', marginBottom:'16px', lineHeight:'1.7' }}>
          قم بتحميل نسخة احتياطية شاملة من قاعدة البيانات بصيغة SQL. يُنصح بعمل نسخة يومية.
        </p>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'16px', fontSize:'13px', color:'var(--text-muted)', background:'var(--bg)', padding:'10px 14px', borderRadius:'8px' }}>
          <CheckCircle size={14} color="var(--success)"/>
          يشمل: الأدوية، المبيعات، الموظفين، الموردين، والسجلات
        </div>
        <button className="btn btn-primary" disabled={loading} onClick={handleBackup} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {loading ? <span className="spinner"/> : <Download size={16}/>}
          {loading ? 'جاري التحميل...' : 'تحميل النسخة الاحتياطية'}
        </button>
      </div>
    </div>
  );
}

function SecuritySection({ security, onRefresh }) {
  const [form, setForm] = useState({ pin: '', recoveryEmail: '', recoveryPhone: '' });
  const [saving, setSaving] = useState(false);

  const handleSetup = async () => {
    const pinErr = validators.pin(form.pin);
    if (pinErr) { toast.error(pinErr); return; }
    const emailErr = validators.email(form.recoveryEmail);
    if (emailErr) { toast.error(emailErr); return; }

    setSaving(true);
    try {
      await setupSecurity(form);
      toast.success('✅ تم إعداد الأمان بنجاح');
      setForm({ pin:'', recoveryEmail:'', recoveryPhone:'' });
      onRefresh();
    } catch(err) { toast.error(err.response?.data?.error || 'خطأ'); }
    finally { setSaving(false); }
  };

  if (security?.setupComplete) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">🔐 إعداد الأمان</span>
          <span className="badge badge-success"><CheckCircle size={11}/> مُفعَّل</span>
        </div>
        <div className="card-body" style={{ textAlign:'center', padding:'32px' }}>
          <CheckCircle size={52} color="var(--success)" style={{ margin:'0 auto 12px', display:'block' }}/>
          <div style={{ fontWeight:'700', fontSize:'16px', marginBottom:'6px' }}>الأمان مُفعَّل بنجاح</div>
          <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>PIN وبيانات الاسترداد محفوظة بأمان</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">🔐 إعداد رمز الأمان (PIN)</span>
        <span className="badge badge-warning">غير مُعَدّ</span>
      </div>
      <div className="card-body">
        <div className="alert alert-warning" style={{ marginBottom:'20px' }}>
          <Shield size={15} style={{ flexShrink:0 }}/>
          <span>يجب إعداد الـ PIN قبل إمكانية تقفيل اليوم والعمليات الحساسة.</span>
        </div>
        <PinInput value={form.pin} onChange={v => setForm({...form, pin:v})} label="رمز PIN (4-6 أرقام)" length={6}/>
        <div className="form-group" style={{ marginTop:'16px' }}>
          <label className="form-label">بريد الاسترداد</label>
          <input className="form-control" type="email" value={form.recoveryEmail} onChange={e => setForm({...form, recoveryEmail:e.target.value})} placeholder="email@example.com" maxLength={100}/>
        </div>
        <div className="form-group">
          <label className="form-label">هاتف الاسترداد</label>
          <input className="form-control" value={form.recoveryPhone} onChange={e => setForm({...form, recoveryPhone:e.target.value})} placeholder="01xxxxxxxxx" maxLength={11}/>
        </div>
        <button className="btn btn-primary" disabled={saving || form.pin.length < 4} onClick={handleSetup} style={{ width:'100%', justifyContent:'center' }}>
          {saving ? <span className="spinner"/> : <><Shield size={15}/>حفظ إعدادات الأمان</>}
        </button>
      </div>
    </div>
  );
}

function DailyClosingSection() {
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [closing, setClosing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadPreview = async () => {
    setLoadingPreview(true);
    try { const { data } = await getTodayReport(); setPreview(data); }
    catch { toast.error('خطأ في تحميل بيانات اليوم'); }
    finally { setLoadingPreview(false); }
  };

  useEffect(() => { loadPreview(); }, []);

  const handleClose = async () => {
    if (!pin.trim()) { toast.error('أدخل كلمة المرور'); return; }
    const rl = clientRateLimit('closing', 3, 5 * 60 * 1000);
    if (rl.blocked) { toast.error(rl.message); return; }
    setClosing(true);
    try {
      const { data: r } = await getTodayReport();
      await dailyClosing({
        date: new Date().toISOString().split('T')[0],
        totals: r.totals,
        grandTotal: r.grandTotal,
        salesCount: r.salesCount,
        closedByName: user.username,
        closedById: user.id,
        pin,
      });
      clearRateLimit('closing');
      toast.success('✅ تم تقفيل اليوم بنجاح');
      setPin('');
    } catch(err) { toast.error(err.response?.data?.error || 'كلمة المرور غير صحيحة'); }
    finally { setClosing(false); }
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">🔒 تقفيل اليوم</span>
        <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>{new Date().toLocaleDateString('ar-EG', { weekday:'long', day:'numeric', month:'long' })}</span>
      </div>
      <div className="card-body">
        {loadingPreview ? (
          <div className="skeleton" style={{ height:'80px', borderRadius:'8px', marginBottom:'16px' }}/>
        ) : preview && (
          <div style={{ background:'var(--bg)', borderRadius:'10px', padding:'14px', marginBottom:'16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            {[
              ['إجمالي المبيعات', `${Number(preview.grandTotal||0).toFixed(2)} ج`],
              ['عدد الفواتير', preview.salesCount||0],
              ['نقدي', `${Number(preview.totals?.cash||0).toFixed(2)} ج`],
              ['كارت', `${Number(preview.totals?.card||0).toFixed(2)} ج`],
            ].map(([k,v]) => (
              <div key={k} style={{ textAlign:'center' }}>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'3px' }}>{k}</div>
                <div style={{ fontSize:'16px', fontWeight:'800', color:'var(--primary)' }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        
        <div className="form-group" style={{ marginBottom: '0' }}>
          <label className="form-label">أدخل كلمة المرور للتأكيد</label>
          <input
            className="form-control"
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="كلمة المرور الخاصة بحسابك..."
          />
        </div>

        <button className="btn btn-accent" disabled={closing || !pin.trim()} onClick={handleClose} style={{ width:'100%', justifyContent:'center', marginTop:'16px', fontWeight:'700' }}>
          {closing ? <><span className="spinner dark"/>&nbsp;جاري التقفيل...</> : '🔒 تقفيل اليوم'}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const [security, setSecurity] = useState(null);
  const { user, isAdmin } = useAuth();

  const loadSecurity = async () => {
    try { const { data } = await getSecurity(); setSecurity(data); }
    catch {}
  };

  useEffect(() => { loadSecurity(); }, []);

  // التحقق مما إذا كان المستخدم أدمن أو صيدلي للسماح بدخول الصفحة
  const isManager = isAdmin || user?.role === 'pharmacist';

  if (!isManager) return (
    <div className="empty-state" style={{ padding:'80px' }}>
      <Shield size={56}/>
      <h3>غير مصرح</h3>
      <p>هذه الصفحة للمشرفين فقط</p>
    </div>
  );

  return (
    <div className="animate-in">
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'800' }}>⚙️ الإعدادات</h1>
        <p style={{ color:'var(--text-muted)', fontSize:'14px', marginTop:'2px' }}>إدارة النظام والأمان والبيانات</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
        {/* تظهر فقط للأدمن */}
        {isAdmin && <SecuritySection security={security} onRefresh={loadSecurity}/>}
        
        {/* تظهر للأدمن وللصيدلي */}
        <DailyClosingSection/>
        
        {/* تظهر فقط للأدمن */}
        {isAdmin && <BackupSection/>}
        {isAdmin && <RestoreSection/>}
      </div>
    </div>
  );
}
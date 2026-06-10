import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getUsers, addUser, updateUser, deleteUser } from '../api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Users as UsersIcon, Search, CheckCircle, Circle, Eye, EyeOff } from 'lucide-react';

const emptyForm = { username:'', fullName:'', email:'', phone:'', role:'cashier', password:'', dailyHours:8, expectedDays:24, active:1 };
const roles = { admin:'مدير', pharmacist:'صيدلي', cashier:'كاشير' };
const roleBadge = { admin:'badge-danger', pharmacist:'badge-info', cashier:'badge-success' };

const F = ({ label, name, type='text', form, setForm, ...rest }) => {
  const handleChange = (e) => {
    let val = e.target.value;

    // فلترة الأرقام والكسور فقط لأي حقل كان نوعه number
    if (type === 'number') {
      // السماح بالأرقام والنقطة العشرية فقط
      val = val.replace(/[^0-9.]/g, ''); 
      // منع كتابة أكثر من نقطة عشرية واحدة (مثلاً 15.5.5 مرفوضة)
      const parts = val.split('.');
      if (parts.length > 2) {
        val = parts[0] + '.' + parts.slice(1).join('');
      }
      setForm({ ...form, [name]: val });
    } 
    // فلترة إضافية لرقم التليفون (أرقام صحيحة فقط بدون كسور)
    else if (name === 'phone') {
      val = val.replace(/[^0-9]/g, '');
      setForm({ ...form, [name]: val });
    } 
    // باقي الحقول العادية (نصوص)
    else {
      setForm({ ...form, [name]: val });
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {type === 'select' ? (
        <select className="form-control" value={form[name]} onChange={handleChange} {...rest}>
          {rest.children}
        </select>
      ) : (
        <input 
          className="form-control" 
          // تحويل الـ type لـ text دائماً في الـ HTML لإخفاء الأسهم المزعجة
          type={type === 'number' ? 'text' : type} 
          // تفعيل لوحة الأرقام في الموبايل
          inputMode={type === 'number' || name === 'phone' ? 'decimal' : undefined}
          value={form[name]} 
          onChange={handleChange} 
          {...rest} 
        />
      )}
    </div>
  );
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);

  // الـ Regex الخاص بالباك إند
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/-]).{8,}$/;

  const load = async () => {
    setLoading(true);
    try { 
      const {data} = await getUsers(); 
      const cleanedData = data.map(u => {
        let isActive = 1;
        if (u.active && typeof u.active === 'object' && u.active.data) {
          isActive = u.active.data[0];
        } else if (u.active === 0 || u.active === '0' || u.active === false) {
          isActive = 0;
        }
        return { ...u, active: isActive };
      });
      setUsers(cleanedData); 
    } catch { 
      toast.error('فشل تحميل الموظفين'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { 
    setEditing(null); 
    setForm(emptyForm); 
    setShowPassword(false); 
    setShowModal(true); 
  };
  const openEdit = (u) => { 
    setEditing(u); 
    setForm({...u, password:''}); 
    setShowPassword(false); 
    setShowModal(true); 
  };

  const handleSave = async () => {
    if (!editing && !passwordRegex.test(form.password)) {
      toast.error('كلمة المرور لا تستوفي جميع الشروط المطلوبة');
      return;
    }
    if (editing && form.password && !passwordRegex.test(form.password)) {
      toast.error('كلمة المرور الجديدة لا تستوفي جميع الشروط المطلوبة');
      return;
    }

    setSaving(true);
    try {
      // تحويل القيم النصية التي تحتوي على أرقام إلى أرقام فعلية للباك إند
      const payload = {
        ...form,
        dailyHours: form.dailyHours ? Number(form.dailyHours) : 8,
        expectedDays: form.expectedDays ? Number(form.expectedDays) : 24
      };

      if (editing) {
        const { id, ...updatePayload } = payload;
        await updateUser(editing.id, updatePayload);
        toast.success('تم التعديل بنجاح');
      } else { 
        const { active, ...addPayload } = payload;
        await addUser(addPayload); 
        toast.success('تم إضافة الموظف بنجاح'); 
      }
      setShowModal(false); 
      load();
    } catch(err) { 
      toast.error(err.response?.data?.error || 'خطأ'); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleDelete = async () => {
    try { await deleteUser(deleteId); toast.success('تم الحذف'); setDeleteId(null); load(); }
    catch(err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const filtered = users.filter(u =>
    u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const pwd = form.password || '';
  const reqs = {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    numSpec: /(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/-])/.test(pwd)
  };

  return (
    <div className="animate-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'800' }}>👥 الموظفون</h1>
          <p style={{ color:'var(--text-muted)', fontSize:'14px', marginTop:'2px' }}>إدارة حسابات الموظفين</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/>إضافة موظف</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-box" style={{flex:1,maxWidth:'300px'}}>
            <Search className="search-icon" size={16}/>
            <input className="form-control" placeholder="بحث بالاسم..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingRight:'42px'}}/>
          </div>
          <span style={{color:'var(--text-muted)',fontSize:'13px'}}>{users.length} موظف</span>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div style={{padding:'40px',display:'flex',flexDirection:'column',gap:'12px'}}>
              {[...Array(4)].map((_,i)=><div key={i} className="skeleton" style={{height:'44px',borderRadius:'6px'}}/>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><UsersIcon size={48}/><h3>لا يوجد موظفون</h3></div>
          ) : (
            <table>
              <thead><tr><th>الموظف</th><th>اسم المستخدم</th><th>الدور</th><th>البريد</th><th>ساعات/يوم</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
              <tbody>
                {filtered.map(u=>(
                  <tr key={u.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,var(--primary),var(--primary-light))',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'700',fontSize:'15px',flexShrink:0}}>
                          {u.fullName?.charAt(0)||'؟'}
                        </div>
                        <span style={{fontWeight:'600'}}>{u.fullName}</span>
                      </div>
                    </td>
                    <td><code style={{fontSize:'13px',background:'var(--bg)',padding:'2px 8px',borderRadius:'4px'}}>{u.username}</code></td>
                    <td><span className={`badge ${roleBadge[u.role]||'badge-gray'}`}>{roles[u.role]||u.role}</span></td>
                    <td style={{fontSize:'13px',color:'var(--text-muted)'}}>{u.email}</td>
                    <td style={{textAlign:'center'}}>{u.dailyHours} ساعة</td>
                    <td><span className={`badge ${u.active?'badge-success':'badge-danger'}`}>{u.active?'نشط':'موقوف'}</span></td>
                    <td>
                      <div style={{display:'flex',gap:'6px'}}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(u)}><Edit2 size={15}/></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{color:'var(--danger)'}} onClick={()=>setDeleteId(u.id)}><Trash2 size={15}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && createPortal(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal" style={{maxWidth:'600px'}}>
            <div className="modal-header">
              <span className="modal-title">{editing?'تعديل موظف':'إضافة موظف جديد'}</span>
              <button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 20px'}}>
                <input type="text" style={{ display: 'none' }} />
                <input type="password" style={{ display: 'none' }} />

                <F label="الاسم الكامل *" name="fullName" placeholder="الاسم بالكامل" form={form} setForm={setForm} autoComplete="off" />
                <F label="اسم المستخدم *" name="username" placeholder="username" form={form} setForm={setForm} autoComplete="off" />
                <F label="البريد الإلكتروني *" name="email" type="email" placeholder="example@gmail.com" form={form} setForm={setForm} autoComplete="off" />
                <F label="رقم الهاتف *" name="phone" placeholder="01xxxxxxxxx (11 رقم)" form={form} setForm={setForm} maxLength={11} autoComplete="off" />
                <F label="الدور *" name="role" type="select" form={form} setForm={setForm}>
                  <option value="cashier">كاشير</option>
                  <option value="pharmacist">صيدلي</option>
                  <option value="admin">مدير</option>
                </F>
                
                <F label="ساعات العمل اليومية" name="dailyHours" type="number" form={form} setForm={setForm} autoComplete="off" />
                
                <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                  <label className="form-label">{editing ? 'كلمة مرور جديدة (اتركها فارغة إذا لم ترد التغيير)' : 'كلمة المرور *'}</label>
                  
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-control"
                      type={showPassword ? "text" : "password"}
                      placeholder="أدخل كلمة المرور (8 رموز فقط)..."
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      maxLength={8} 
                      autoComplete="new-password"
                      style={{ paddingLeft: '40px' }} 
                    />
                    
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px'
                      }}
                      title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  
                  {(!editing || form.password.length > 0) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: reqs.length ? '#16a34a' : '#64748b', transition: 'color 0.2s' }}>
                        {reqs.length ? <CheckCircle size={14} /> : <Circle size={14} />} 8 أحرف بالضبط
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: reqs.upper ? '#16a34a' : '#64748b', transition: 'color 0.2s' }}>
                        {reqs.upper ? <CheckCircle size={14} /> : <Circle size={14} />} حرف إنجليزي كبير
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: reqs.lower ? '#16a34a' : '#64748b', transition: 'color 0.2s' }}>
                        {reqs.lower ? <CheckCircle size={14} /> : <Circle size={14} />} حرف إنجليزي صغير
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: reqs.numSpec ? '#16a34a' : '#64748b', transition: 'color 0.2s' }}>
                        {reqs.numSpec ? <CheckCircle size={14} /> : <Circle size={14} />} رقم ورمز خاص (!@#$)
                      </div>
                    </div>
                  )}
                </div>

                <F label="الأيام المتوقعة شهرياً" name="expectedDays" type="number" form={form} setForm={setForm} autoComplete="off" />
              </div>
              
              {editing && (
                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label className="form-label">الحالة</label>
                  <select className="form-control" value={form.active} onChange={e=>setForm({...form,active:parseInt(e.target.value)})}>
                    <option value={1}>نشط</option>
                    <option value={0}>موقوف</option>
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>إلغاء</button>
              <button className="btn btn-primary" disabled={saving || (!editing && !passwordRegex.test(form.password)) || (editing && form.password && !passwordRegex.test(form.password))} onClick={handleSave}>
                {saving?<span className="spinner"/>:(editing?'حفظ التعديلات':'إضافة الموظف')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteId && createPortal(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDeleteId(null)}>
          <div className="modal" style={{maxWidth:'400px'}}>
            <div className="modal-header"><span className="modal-title" style={{color:'var(--danger)'}}>⚠️ تأكيد الحذف</span></div>
            <div className="modal-body"><p style={{color:'var(--text-secondary)'}}>هل أنت متأكد من حذف هذا الموظف؟</p></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setDeleteId(null)}>إلغاء</button>
              <button className="btn btn-danger" onClick={handleDelete}>تأكيد الحذف</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getMedicines, addMedicine, updateMedicine, deleteMedicine, getSuppliers, analyzeMedicineImage } from '../api';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Package, Camera, ImagePlus, X as XIcon, Send, AlertCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression'; 

const emptyForm = {
  name:'', barcode:'', expiryDate:'', quantity:0, purchasePrice:0,
  sellingPrice:0, requiresPrescription:false, supplierId:'',
  pillCount:0, stripCount:0, manufacturer:'', genericName:'', medicineForm:''
};

// تم التعديل هنا: منع إدخال الحروف وإلغاء أسهم الأرقام
const F = ({ label, name, type='text', form, setForm, ...rest }) => {
  const handleChange = (e) => {
    if (type === 'checkbox') {
      setForm({ ...form, [name]: e.target.checked });
    } else if (type === 'number') {
      let val = e.target.value;
      // السماح بالأرقام والنقطة العشرية فقط
      val = val.replace(/[^0-9.]/g, ''); 
      // منع كتابة أكثر من نقطة عشرية (مثال: 15.5.5 غير مسموح)
      const parts = val.split('.');
      if (parts.length > 2) {
        val = parts[0] + '.' + parts.slice(1).join('');
      }
      setForm({ ...form, [name]: val });
    } else {
      setForm({ ...form, [name]: e.target.value });
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {type === 'select' ? (
        <select className="form-control" value={form[name]} onChange={handleChange} {...rest}>
          {rest.children}
        </select>
      ) : type === 'checkbox' ? (
        <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
          <input type="checkbox" checked={form[name]} onChange={handleChange} style={{width:'16px',height:'16px'}} />
          <span style={{fontSize:'14px'}}>{rest.checkLabel}</span>
        </label>
      ) : (
        <input 
          className="form-control" 
          // تحويل الـ type لـ text دائماً في الـ HTML لإخفاء الأسهم
          type={type === 'number' ? 'text' : type} 
          // فتح كيبورد الأرقام في الموبايل
          inputMode={type === 'number' ? 'decimal' : undefined}
          value={form[name]} 
          onChange={handleChange} 
          {...rest} 
        />
      )}
    </div>
  );
};

export default function Medicines() {
  const [medicines, setMedicines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page:1, totalPages:1, total:0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');
  
  const [analyzing, setAnalyzing] = useState(false);
  const [compressing, setCompressing] = useState(false); 
  const [selectedImages, setSelectedImages] = useState([]);

  const load = useCallback(async (page=1) => {
    setLoading(true);
    try {
      const { data } = await getMedicines({ page, limit:20 });
      setMedicines(data.data);
      setPagination(data.pagination);
    } catch { toast.error('فشل تحميل الأدوية'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    getSuppliers().then(r => setSuppliers(r.data)).catch(() => {});
  }, [load]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (m) => { setEditing(m); setForm({ ...m, supplierId: m.supplierId || '' }); setShowModal(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      // تحويل القيم النصية لأرقام فعلية قبل إرسالها للـ API
      const payload = {
        ...form,
        quantity: form.quantity ? Number(form.quantity) : 0,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : 0,
        sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : 0,
        pillCount: form.pillCount ? Number(form.pillCount) : 0,
        stripCount: form.stripCount ? Number(form.stripCount) : 0,
      };

      if (editing) { await updateMedicine(editing.id, payload); toast.success('تم التعديل بنجاح'); }
      else { await addMedicine(payload); toast.success('تم الإضافة بنجاح'); }
      setShowModal(false);
      load(pagination.page);
    } catch(err) { toast.error(err.response?.data?.error || 'خطأ'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteMedicine(deleteId);
      toast.success('تم الحذف');
      setDeleteId(null);
      load(pagination.page);
    } catch(err) { toast.error(err.response?.data?.error || 'خطأ في الحذف'); }
  };

  const handleAddImages = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setCompressing(true);
    const toastId = toast.loading('جاري ضغط وتجهيز الصور... ⏳');

    const options = {
      maxSizeMB: 1,             
      maxWidthOrHeight: 1920,   
      useWebWorker: true        
    };

    try {
      const compressedPromises = files.map(async (file) => {
        try {
          const compressedFile = await imageCompression(file, options);
          return { 
            file: compressedFile, 
            previewUrl: URL.createObjectURL(compressedFile), 
            id: Math.random().toString(36).slice(2) 
          };
        } catch (err) {
          console.error('فشل ضغط صورة، هيتم استخدام الأصلية', err);
          return { 
            file, 
            previewUrl: URL.createObjectURL(file), 
            id: Math.random().toString(36).slice(2) 
          };
        }
      });

      const newImgs = await Promise.all(compressedPromises);
      setSelectedImages(prev => [...prev, ...newImgs]);
      
      toast.success('تم تجهيز الصور بنجاح', { id: toastId });
    } catch (error) {
      toast.error('حصلت مشكلة أثناء تجهيز الصور', { id: toastId });
    } finally {
      setCompressing(false);
      e.target.value = ''; 
    }
  };

  const removeImage = (id) => {
    setSelectedImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const handleAnalyze = async () => {
    if (!selectedImages.length) return;
    const formData = new FormData();
    selectedImages.forEach(img => formData.append('medicineImages', img.file));
    setAnalyzing(true);
    const tid = toast.loading('الذكاء الاصطناعي بيقرأ العلبة... 🤖');
    try {
      const { data } = await analyzeMedicineImage(formData);
      setForm(prev => ({
        ...prev,
        name: data.name || prev.name,
        barcode: data.barcode || prev.barcode,
        genericName: data.genericName || prev.genericName,
        manufacturer: data.manufacturer || prev.manufacturer,
        medicineForm: data.medicineForm || prev.medicineForm,
        expiryDate: data.expiryDate || prev.expiryDate,
        stripCount: data.stripCount || prev.stripCount,
        pillCount: data.pillCount || prev.pillCount,
      }));
      toast.success('تم استخراج البيانات بنجاح! راجعها وضيف السعر والكمية.', { id: tid });
      setSelectedImages([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل تحليل الصورة، حاول بصورة أوضح', { id: tid });
    } finally { setAnalyzing(false); }
  };

  const filtered = medicines.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.barcode?.includes(search)
  );

  const expiryStatus = (date) => {
    const diff = Math.ceil((new Date(date) - new Date()) / (1000*60*60*24));
    if (diff < 0) return { label:'منتهي', cls:'badge-danger' };
    if (diff <= 30) return { label:'ينتهي قريباً', cls:'badge-warning' };
    return { label:'صالح', cls:'badge-success' };
  };

  return (
    <div className="animate-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'800' }}>💊 الأدوية</h1>
          <p style={{ color:'var(--text-muted)', fontSize:'14px', marginTop:'2px' }}>إدارة مخزون الأدوية</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/>إضافة دواء</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-box" style={{ flex:1, maxWidth:'340px' }}>
            <Search className="search-icon" size={16} />
            <input className="form-control" placeholder="بحث بالاسم أو الباركود..." value={search} onChange={e=>setSearch(e.target.value)} style={{ paddingRight:'42px' }} />
          </div>
          <span style={{ color:'var(--text-muted)', fontSize:'13px' }}>الإجمالي: {pagination.total} دواء</span>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding:'40px', display:'flex', flexDirection:'column', gap:'12px' }}>
              {[...Array(5)].map((_,i)=><div key={i} className="skeleton" style={{height:'44px',borderRadius:'6px'}}/>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><Package size={48}/><h3>لا توجد أدوية</h3><p>أضف أول دواء من الزر أعلاه</p></div>
          ) : (
            <table>
              <thead><tr>
                <th>الاسم</th><th>الباركود</th><th>الكمية</th>
                <th>سعر البيع</th><th>تاريخ الانتهاء</th><th>الحالة</th><th>الإجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map(m => {
                  const status = expiryStatus(m.expiryDate);
                  return (
                    <tr key={m.id}>
                      <td><span style={{fontWeight:'600'}}>{m.name}</span>{m.genericName&&<div style={{fontSize:'11px',color:'var(--text-muted)'}}>{m.genericName}</div>}</td>
                      <td><code style={{fontSize:'12px',background:'var(--bg)',padding:'2px 6px',borderRadius:'4px'}}>{m.barcode}</code></td>
                      <td>
                        <span style={{fontWeight:'700',color:m.quantity<=10?'var(--danger)':m.quantity<=20?'var(--warning)':'inherit'}}>
                          {m.quantity}
                        </span>
                      </td>
                      <td style={{fontWeight:'600',color:'var(--primary)'}}>{Number(m.sellingPrice).toFixed(2)} ج</td>
                      <td>{new Date(m.expiryDate).toLocaleDateString('ar-EG')}</td>
                      <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                      <td>
                        <div style={{display:'flex',gap:'6px'}}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(m)} title="تعديل"><Edit2 size={15}/></button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{color:'var(--danger)'}} onClick={()=>setDeleteId(m.id)} title="حذف"><Trash2 size={15}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {pagination.totalPages > 1 && (
          <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)' }}>
            <div className="pagination">
              <button className="page-btn" disabled={pagination.page===1} onClick={()=>load(pagination.page-1)}>السابق</button>
              {[...Array(pagination.totalPages)].map((_,i)=>(
                <button key={i} className={`page-btn${pagination.page===i+1?' active':''}`} onClick={()=>load(i+1)}>{i+1}</button>
              ))}
              <button className="page-btn" disabled={pagination.page===pagination.totalPages} onClick={()=>load(pagination.page+1)}>التالي</button>
            </div>
          </div>
        )}
      </div>

      {showModal && createPortal(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal" style={{maxWidth:'680px'}}>
            <div className="modal-header">
              <span className="modal-title">{editing?'تعديل دواء':'إضافة دواء جديد'}</span>
              <button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              
              {/* منطقة الذكاء الاصطناعي */}
              <div style={{ marginBottom: '20px', background: 'linear-gradient(135deg,#f0faf8,#e8f5f2)', border: '1.5px solid #a7d9d0', borderRadius: 'var(--radius)', padding: '16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                  <span style={{ fontSize:'16px' }}>✨</span>
                  <span style={{ fontWeight:'700', fontSize:'14px', color:'var(--primary-dark)' }}>تعبئة تلقائية بالذكاء الاصطناعي</span>
                </div>

                <div style={{ display:'flex', alignItems:'flex-start', gap:'8px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'8px', padding:'10px 12px', marginBottom:'12px' }}>
                  <AlertCircle size={15} color="#d97706" style={{ flexShrink:0, marginTop:'1px' }} />
                  <p style={{ fontSize:'12px', color:'#92400e', lineHeight:'1.6', margin:0 }}>
                    صوّر العلبة من <strong>أكثر من زاوية</strong> للحصول على أفضل النتائج — يُنصح بـ <strong>5 صور أو أكثر</strong> (الأمام، الخلف، الجانب، الباركود، تاريخ الانتهاء)
                  </p>
                </div>

                <div style={{ display:'flex', gap:'8px', marginBottom: selectedImages.length > 0 ? '12px' : '0' }}>
                  <label style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'7px', padding:'9px', borderRadius:'8px', border:'1.5px dashed var(--primary)', background:'rgba(26,127,110,0.05)', cursor: (analyzing || compressing) ? 'not-allowed' : 'pointer', fontSize:'13px', fontWeight:'600', color:'var(--primary)' }}>
                    <input type="file" accept="image/*" capture="environment" multiple onChange={handleAddImages} style={{ display:'none' }} disabled={analyzing || compressing} />
                    <Camera size={16} /> تصوير
                  </label>
                  <label style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'7px', padding:'9px', borderRadius:'8px', border:'1.5px dashed var(--primary)', background:'rgba(26,127,110,0.05)', cursor: (analyzing || compressing) ? 'not-allowed' : 'pointer', fontSize:'13px', fontWeight:'600', color:'var(--primary)' }}>
                    <input type="file" accept="image/*" multiple onChange={handleAddImages} style={{ display:'none' }} disabled={analyzing || compressing} />
                    <ImagePlus size={16} /> من الصور
                  </label>
                </div>

                {selectedImages.length > 0 && (
                  <div>
                    {selectedImages.length < 5 && (
                      <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px', padding:'7px 10px', background:'rgba(249,115,22,0.08)', borderRadius:'6px' }}>
                        <AlertCircle size={13} color="var(--warning)" />
                        <span style={{ fontSize:'11.5px', color:'var(--warning)' }}>
                          عندك {selectedImages.length} {selectedImages.length === 1 ? 'صورة' : 'صور'} — يُنصح بـ 5 على الأقل ({5 - selectedImages.length} باقيين)
                        </span>
                      </div>
                    )}
                    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px' }}>
                      {selectedImages.map(img => (
                        <div key={img.id} style={{ position:'relative', width:'68px', height:'68px', borderRadius:'8px', overflow:'hidden', border:'2px solid var(--border)', flexShrink:0 }}>
                          <img src={img.previewUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          <button onClick={() => removeImage(img.id)} style={{ position:'absolute', top:'2px', left:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'rgba(239,68,68,0.9)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'white', padding:0 }}>
                            <XIcon size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={handleAnalyze} disabled={analyzing || compressing} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'10px', borderRadius:'8px', border:'none', background: (analyzing || compressing) ? 'var(--border)' : 'var(--primary)', color: (analyzing || compressing) ? 'var(--text-muted)' : 'white', fontFamily:'Cairo', fontWeight:'700', fontSize:'14px', cursor: (analyzing || compressing) ? 'not-allowed' : 'pointer' }}>
                      {analyzing
                        ? <><span className="spinner" style={{ width:'16px', height:'16px' }} /> جاري التحليل...</>
                        : <><Send size={15} /> تحليل {selectedImages.length} {selectedImages.length === 1 ? 'صورة' : 'صور'} بالذكاء الاصطناعي</>
                      }
                    </button>
                  </div>
                )}
              </div>
              <hr className="divider" style={{ margin: '0 0 20px 0' }} />

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 20px'}}>
                <F label="اسم الدواء *" name="name" placeholder="أدخل اسم الدواء" form={form} setForm={setForm} />
                <F label="الباركود *" name="barcode" placeholder="الباركود" form={form} setForm={setForm} />
                <F label="الاسم العلمي" name="genericName" placeholder="Generic Name" form={form} setForm={setForm} />
                <F label="الشكل الدوائي" name="medicineForm" placeholder="أقراص / كبسول / شراب..." form={form} setForm={setForm} />
                <F label="الشركة المصنعة" name="manufacturer" placeholder="اسم الشركة" form={form} setForm={setForm} />
                <F label="تاريخ الانتهاء *" name="expiryDate" type="date" form={form} setForm={setForm} />
                {/* الحقول الرقمية دلوقتي بقت محمية من החروف وبدون أسهم المزعجة */}
                <F label="الكمية *" name="quantity" type="number" min="0" form={form} setForm={setForm} />
                <F label="سعر الشراء *" name="purchasePrice" type="number" min="0" step="0.01" form={form} setForm={setForm} />
                <F label="سعر البيع *" name="sellingPrice" type="number" min="0" step="0.01" form={form} setForm={setForm} />
                
                <F label="المورد" name="supplierId" type="select" form={form} setForm={setForm}>
                  <option value="">-- بدون مورد --</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </F>
                <F label="عدد الأقراص في الشريط" name="pillCount" type="number" min="0" form={form} setForm={setForm} />
                <F label="عدد الشرائط في العلبة" name="stripCount" type="number" min="0" form={form} setForm={setForm} />
              </div>
              <F label="يستلزم وصفة طبية" name="requiresPrescription" type="checkbox" checkLabel="نعم، يستلزم وصفة طبية" form={form} setForm={setForm} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>إلغاء</button>
              <button className="btn btn-primary" disabled={saving || analyzing || compressing} onClick={handleSave}>
                {saving?<span className="spinner"/>:(editing?'حفظ التعديلات':'إضافة الدواء')}
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
            <div className="modal-body"><p style={{color:'var(--text-secondary)'}}>هل أنت متأكد من حذف هذا الدواء؟ لا يمكن التراجع عن هذه العملية.</p></div>
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
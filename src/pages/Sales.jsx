import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { searchMedicine, searchMedicineByName, createSale, getSales, getSaleById } from '../api';
import toast from 'react-hot-toast';
import { Search, Plus, Trash2, ShoppingCart, History, AlertTriangle, Printer } from 'lucide-react';
import { useAuth } from '../AuthContext'; // ✅ استدعاء معلومات اليوزر

export default function Sales() {
  const [tab, setTab] = useState('pos');
  return (
    <div className="animate-in">
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'800' }}>🛒 المبيعات</h1>
          <p style={{ color:'var(--text-muted)', fontSize:'14px', marginTop:'2px' }}>نقطة البيع وسجل المعاملات</p>
        </div>
        <div style={{ display:'flex', background:'var(--bg)', borderRadius:'10px', padding:'4px', marginRight:'auto' }}>
          {[{k:'pos',l:'نقطة البيع'},{k:'history',l:'السجل'}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{
              padding:'8px 20px', borderRadius:'8px', border:'none', cursor:'pointer',
              fontFamily:'Cairo,sans-serif', fontWeight:'600', fontSize:'13px',
              background: tab===t.k ? 'white' : 'transparent',
              color: tab===t.k ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: tab===t.k ? 'var(--shadow-sm)' : 'none',
              transition:'all 0.2s'
            }}>{t.l}</button>
          ))}
        </div>
      </div>
      {tab === 'pos' ? <POS /> : <SaleHistory />}
    </div>
  );
}

function POS() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [interactionWarning, setInteractionWarning] = useState(null);
  const [pendingSaleData, setPendingSaleData] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const isBarcode = (val) => /^\d+$/.test(val.trim());

  useEffect(() => {
    const handler = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!query.trim() || isBarcode(query)) { setSuggestions([]); setShowSuggestions(false); return; }
    if (query.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await searchMedicineByName(query.trim());
        const results = Array.isArray(data) ? data : [];
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch { setSuggestions([]); setShowSuggestions(false); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const addToCart = (item) => {
    const existing = cart.find(i => i.medicineId === item.id);
    if (existing) {
      setCart(cart.map(i => i.medicineId===item.id ? {...i, qty:i.qty+1} : i));
    } else {
      setCart(prev => [...prev, {
        medicineId: item.id, name: item.name,
        genericName: item.genericName, sellingPrice: item.sellingPrice,
        qty: 1, quantityType: 'box', stripCount: item.stripCount, pillCount: item.pillCount,
        availableQty: item.quantity
      }]);
    }
  };

  const selectSuggestion = (item) => {
    addToCart(item);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const searchAndAdd = async () => {
    if (!query.trim()) return;
    if (!isBarcode(query)) return;
    try {
      const { data } = await searchMedicine(query.trim());
      addToCart(data);
      setQuery('');
      inputRef.current?.focus();
    } catch(err) {
      toast.error(err.response?.data?.error || 'الدواء غير موجود');
    }
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) { setCart(cart.filter(i=>i.medicineId!==id)); return; }
    setCart(cart.map(i => i.medicineId===id ? {...i, qty} : i));
  };

  const updateType = (id, quantityType) => setCart(cart.map(i=>i.medicineId===id?{...i,quantityType}:i));

  const total = cart.reduce((sum, i) => {
    let qty = i.qty;
    if (i.quantityType === 'strip') qty = i.stripCount ? i.qty/i.stripCount : i.qty;
    if (i.quantityType === 'pill') qty = i.pillCount ? i.qty/i.pillCount : i.qty;
    return sum + (i.sellingPrice * qty);
  }, 0);

  const checkout = async (force=false) => {
    if (cart.length === 0) { toast.error('السلة فارغة'); return; }
    setLoading(true);
    try {
      const saleData = {
        paymentMethod,
        items: cart.map(i=>({ medicineId:i.medicineId, qty:i.qty, quantityType:i.quantityType, stripCount:i.stripCount, pillCount:i.pillCount })),
        forceInteraction: force
      };
      const { data } = await createSale(saleData);
      setReceiptData({
        id: data.id,
        total: data.total,
        profit: data.profit,
        paymentMethod,
        items: cart,
        ts: new Date().toISOString(),
        cashierName: data.cashierName,
      });
      setCart([]);
      setInteractionWarning(null);
      setPendingSaleData(null);
    } catch(err) {
      if (err.response?.status === 409) {
        setInteractionWarning(err.response.data);
        setPendingSaleData({ paymentMethod, items: cart });
      } else {
        toast.error(err.response?.data?.error || 'فشل البيع');
      }
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'20px', alignItems:'start' }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">🛍️ السلة</span>
          {cart.length > 0 && <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={()=>setCart([])}>مسح الكل</button>}
        </div>
        <div style={{ padding:'16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ position:'relative' }}>
            <div style={{ display:'flex', gap:'10px' }}>
              <div className="search-box" style={{ flex:1, position:'relative' }}>
                <Search className="search-icon" size={16}/>
                {searching && (
                  <span style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)'}}>
                    <span className="spinner" style={{width:'14px',height:'14px'}}/>
                  </span>
                )}
                <input
                  ref={inputRef}
                  className="form-control"
                  placeholder="باركود أو اسم الدواء..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && searchAndAdd()}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  style={{ paddingRight:'42px' }}
                  autoFocus
                />
              </div>
              <button className="btn btn-primary" onClick={searchAndAdd} title="إضافة باركود">
                <Plus size={16}/>
              </button>
            </div>

            {query && (
              <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'5px',paddingRight:'4px'}}>
                {isBarcode(query) ? '🔖 باركود — اضغط Enter للإضافة' : '🔍 بحث بالاسم — اختر من القائمة'}
              </div>
            )}

            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} style={{
                position:'absolute', top:'calc(100% + 4px)', right:0, left:0, zIndex:200,
                background:'#ffffff', border:'1.5px solid var(--primary)', borderRadius:'10px',
                boxShadow:'0 8px 24px rgba(0,0,0,0.13)', maxHeight:'300px', overflowY:'auto'
              }}>
                {suggestions.map((item, idx) => (
                  <div key={item.id||idx}
                    onClick={() => selectSuggestion(item)}
                    style={{
                      padding:'10px 14px', cursor:'pointer',
                      borderBottom: idx < suggestions.length-1 ? '1px solid #f0f0f0' : 'none',
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      background:'#ffffff',
                      transition:'background 0.1s'
                    }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f0faf7'}
                    onMouseLeave={e=>e.currentTarget.style.background='#ffffff'}
                  >
                    <div>
                      <div style={{fontWeight:'700', fontSize:'14px', color:'#1a1a1a'}}>{item.name}</div>
                      {item.genericName && <div style={{fontSize:'11px',color:'#888'}}>{item.genericName}</div>}
                    </div>
                    <div style={{textAlign:'left', flexShrink:0, marginRight:'12px'}}>
                      <div style={{fontWeight:'700', color:'var(--primary)', fontSize:'13px'}}>{Number(item.sellingPrice).toFixed(2)} ج</div>
                      <div style={{fontSize:'11px', color: item.quantity > 0 ? '#16a34a' : '#dc2626'}}>
                        {item.quantity > 0 ? `متاح: ${item.quantity}` : 'نفذ'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showSuggestions && suggestions.length === 0 && query.length >= 2 && !isBarcode(query) && !searching && (
              <div style={{
                position:'absolute', top:'calc(100% + 4px)', right:0, left:0, zIndex:200,
                background:'#ffffff', border:'1.5px solid var(--primary)', borderRadius:'10px',
                padding:'14px', textAlign:'center', color:'#888', fontSize:'13px',
                boxShadow:'0 8px 24px rgba(0,0,0,0.13)'
              }}>لا توجد نتائج</div>
            )}
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="empty-state" style={{padding:'50px 20px'}}>
            <ShoppingCart size={48}/>
            <h3>السلة فارغة</h3>
            <p>ابحث عن دواء بالباركود لإضافته</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>الدواء</th><th>النوع</th><th>الكمية</th><th>السعر</th><th></th></tr></thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.medicineId}>
                    <td>
                      <div style={{fontWeight:'600',fontSize:'14px'}}>{item.name}</div>
                      {item.genericName && <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{item.genericName}</div>}
                    </td>
                    <td>
                      <select className="form-control" style={{padding:'5px 8px',fontSize:'12px',width:'100px'}}
                        value={item.quantityType} onChange={e=>updateType(item.medicineId,e.target.value)}>
                        <option value="box">علبة</option>
                        {item.stripCount>0&&<option value="strip">شريط</option>}
                        {item.pillCount>0&&<option value="pill">قرص</option>}
                      </select>
                    </td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                        <button className="btn btn-ghost btn-icon" style={{width:'26px',height:'26px',padding:0,fontSize:'16px'}} onClick={()=>updateQty(item.medicineId,item.qty-1)}>−</button>
                        <span style={{fontWeight:'700',minWidth:'24px',textAlign:'center'}}>{item.qty}</span>
                        <button className="btn btn-ghost btn-icon" style={{width:'26px',height:'26px',padding:0,fontSize:'16px'}} onClick={()=>updateQty(item.medicineId,item.qty+1)}>+</button>
                      </div>
                    </td>
                    <td style={{fontWeight:'600',color:'var(--primary)'}}>{(item.sellingPrice*(item.quantityType==='strip'&&item.stripCount?item.qty/item.stripCount:item.quantityType==='pill'&&item.pillCount?item.qty/item.pillCount:item.qty)).toFixed(2)} ج</td>
                    <td><button className="btn btn-ghost btn-icon" style={{color:'var(--danger)'}} onClick={()=>setCart(cart.filter(i=>i.medicineId!==item.medicineId))}><Trash2 size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:'16px',position:'sticky',top:'28px'}}>
        <div className="card">
          <div className="card-header"><span className="card-title">💳 إتمام الدفع</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">طريقة الدفع</label>
              <select className="form-control" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>
                <option value="cash">نقدي</option>
                <option value="card">كارت</option>
                <option value="wallet">محفظة إلكترونية</option>
                <option value="insurance">تأمين</option>
              </select>
            </div>
            <div style={{
              background:'var(--bg)', borderRadius:'var(--radius-sm)',
              padding:'16px', marginBottom:'16px'
            }}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',color:'var(--text-muted)',marginBottom:'8px'}}>
                <span>عدد الأصناف</span><span>{cart.length}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'18px',fontWeight:'800',color:'var(--primary)'}}>
                <span>الإجمالي</span><span>{total.toFixed(2)} ج</span>
              </div>
            </div>
            <button className="btn btn-primary btn-lg" style={{width:'100%',justifyContent:'center'}}
              disabled={loading||cart.length===0} onClick={()=>checkout(false)}>
              {loading?<span className="spinner"/>:<><ShoppingCart size={18}/>تأكيد البيع</>}
            </button>
          </div>
        </div>
      </div>

      {interactionWarning && createPortal(
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:'480px'}}>
            <div className="modal-header">
              <span className="modal-title" style={{color:'var(--warning)',display:'flex',alignItems:'center',gap:'8px'}}>
                <AlertTriangle size={20}/>تحذير: تعارض دوائي
              </span>
            </div>
            <div className="modal-body">
              {interactionWarning.interactions?.map((i,idx)=>(
                <div key={idx} style={{background:'#fffaf0',border:'1px solid #f6d860',borderRadius:'8px',padding:'12px',marginBottom:'10px'}}>
                  <div style={{fontWeight:'600',color:'#744210'}}>{i.severity === 'high' ? '🔴 خطر عالي' : '🟡 تحذير'}</div>
                  <div style={{fontSize:'13px',marginTop:'4px',color:'var(--text-secondary)'}}>{i.description}</div>
                </div>
              ))}
              <p style={{fontSize:'13px',color:'var(--text-muted)',marginTop:'10px'}}>{interactionWarning.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>{setInteractionWarning(null);setPendingSaleData(null);}}>إلغاء البيع</button>
              <button className="btn btn-danger" onClick={()=>checkout(true)}>المتابعة رغم التحذير</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {receiptData && createPortal(
        <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} successMode={true} />,
        document.body
      )}
    </div>
  );
}

const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    direction: rtl;
    background: #fff;
    color: #111;
    width: 80mm;
    margin: 0 auto;
    padding: 8mm 6mm;
    font-size: 12px;
  }
  .r-store {
    text-align: center;
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid #111;
  }
  .r-store-name {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .r-store-sub {
    font-size: 10px;
    color: #555;
    line-height: 1.6;
  }
  .r-meta {
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px dashed #aaa;
  }
  .r-meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    line-height: 2;
    color: #333;
  }
  .r-meta-row span:last-child { font-weight: 700; color: #000; }
  .r-invoice-no {
    text-align: center;
    font-size: 11px;
    color: #666;
    margin-bottom: 10px;
    letter-spacing: 0.3px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
  }
  thead tr {
    border-top: 1px solid #111;
    border-bottom: 1px solid #111;
  }
  th {
    font-size: 10px;
    font-weight: 700;
    padding: 5px 2px;
    text-align: right;
    color: #000;
  }
  th.num { text-align: center; }
  th.price { text-align: left; }
  td {
    font-size: 11px;
    padding: 6px 2px;
    border-bottom: 1px dashed #ddd;
    vertical-align: middle;
  }
  td.num { text-align: center; color: #444; }
  td.price { text-align: left; font-weight: 700; }
  .r-medicine-name { font-weight: 700; font-size: 12px; }
  .r-medicine-generic { font-size: 10px; color: #777; margin-top: 1px; }
  .r-subtotals {
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px dashed #aaa;
  }
  .r-subtotals .r-meta-row { font-size: 11px; }
  .r-total-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 2px solid #111;
    font-size: 15px;
    font-weight: 800;
  }
  .r-footer {
    text-align: center;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px dashed #aaa;
    font-size: 10px;
    color: #666;
    line-height: 1.8;
  }
  @media print {
    body { width: 100%; padding: 4mm; }
    @page { margin: 0; size: 80mm auto; }
  }
`;

function buildReceiptHTML(data, isReprint = false) {
  const payLabel = { cash:'نقدي', card:'كارت', wallet:'محفظة الكترونية', insurance:'تأمين' };
  const typeLabel = { box:'علبة', strip:'شريط', pill:'قرص' };
  const calcItemTotal = (item) => {
    let qty = item.qty;
    if (item.quantityType === 'strip' && item.stripCount) qty = item.qty / item.stripCount;
    if (item.quantityType === 'pill' && item.pillCount) qty = item.qty / item.pillCount;
    return item.sellingPrice * qty;
  };
  const items = data.items || [];
  const itemsHTML = items.map(item => `
    <tr>
      <td>
        <div class="r-medicine-name">${item.name}</div>
        ${item.genericName ? `<div class="r-medicine-generic">${item.genericName}</div>` : ''}
      </td>
      <td class="num">${item.qty} ${typeLabel[item.quantityType] || item.quantityType}</td>
      <td class="price">${calcItemTotal(item).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <div class="r-store">
      <div class="r-store-name">الصيدلية</div>
      <div class="r-store-sub">فاتورة مبيعات</div>
    </div>
    ${isReprint ? `<div style="text-align:center;font-size:11px;font-weight:700;color:#856404;background:#fff3cd;border:1px dashed #ffc107;border-radius:4px;padding:4px 8px;margin-bottom:8px;">⚠ إعادة طباعة</div>` : ''}
    ${data.id ? `<div class="r-invoice-no">رقم الفاتورة: ${data.id.slice(0,8).toUpperCase()}</div>` : ''}
    <div class="r-meta">
      <div class="r-meta-row"><span>التاريخ</span><span>${new Date(data.ts).toLocaleDateString('ar-EG')}</span></div>
      <div class="r-meta-row"><span>الوقت</span><span>${new Date(data.ts).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</span></div>
      ${data.cashierName ? `<div class="r-meta-row"><span>الكاشير</span><span>${data.cashierName}</span></div>` : ''}
      <div class="r-meta-row"><span>طريقة الدفع</span><span>${payLabel[data.paymentMethod] || data.paymentMethod}</span></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>الصنف</th>
          <th class="num">الكمية</th>
          <th class="price">السعر</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>
    <div class="r-subtotals">
      <div class="r-meta-row"><span>عدد الاصناف</span><span>${items.length}</span></div>
    </div>
    <div class="r-total-line">
      <span>الاجمالي</span>
      <span>${Number(data.total).toFixed(2)} ج.م</span>
    </div>
    <div class="r-footer">
      شكراً لتعاملكم معنا<br/>
      يسعدنا خدمتكم دائماً
    </div>
  `;
}

function ReceiptModal({ data, onClose, successMode = false, isReprint = false }) {
  const payLabel = { cash:'نقدي', card:'كارت', wallet:'محفظة الكترونية', insurance:'تأمين' };
  const typeLabel = { box:'علبة', strip:'شريط', pill:'قرص' };

  const calcItemTotal = (item) => {
    let qty = item.qty;
    if (item.quantityType === 'strip' && item.stripCount) qty = item.qty / item.stripCount;
    if (item.quantityType === 'pill' && item.pillCount) qty = item.qty / item.pillCount;
    return item.sellingPrice * qty;
  };

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=420,height=700');
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"/><title>فاتورة</title><style>${PRINT_STYLES}</style></head><body>${buildReceiptHTML(data, isReprint)}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const items = data.items || [];

  return (
    <div className="modal-overlay" style={{zIndex:1000}}>
      <div className="modal" style={{maxWidth:'480px', width:'100%', overflow:'hidden'}}>

        {/* Header */}
        <div className="modal-header" style={{
          borderBottom: '1px solid var(--border)',
          padding: '18px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
              <div style={{fontWeight:'800', fontSize:'16px', color: successMode ? 'var(--success)' : 'var(--text-primary)'}}>
                {successMode ? 'تم البيع بنجاح' : 'فاتورة المبيعات'}
              </div>
              {isReprint && (
                <span style={{
                  background:'#fff3cd', color:'#856404', border:'1px solid #ffc107',
                  borderRadius:'6px', fontSize:'10px', fontWeight:'700', padding:'2px 8px'
                }}>إعادة طباعة</span>
              )}
            </div>
            {data.id && (
              <div style={{fontSize:'11px', color:'var(--text-muted)', marginTop:'2px', fontFamily:'monospace', letterSpacing:'0.5px'}}>
                # {data.id.slice(0,8).toUpperCase()}
              </div>
            )}
            <div style={{display:'flex', gap:'12px', marginTop:'4px', fontSize:'11px', color:'var(--text-muted)'}}>
              {data.cashierName && <span>👤 {data.cashierName}</span>}
              {data.ts && <span>🕐 {new Date(data.ts).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text-muted)',
            borderRadius:'8px', width:'32px', height:'32px', cursor:'pointer',
            fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center',
            lineHeight:1
          }}>×</button>
        </div>

        {/* Body - Receipt preview */}
        <div className="modal-body" style={{padding:'0', maxHeight:'65vh', overflowY:'auto'}}>
          <div style={{
            margin: '16px 20px',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            overflow: 'hidden',
            fontFamily: "'Cairo', sans-serif",
            fontSize: '13px',
            direction: 'rtl',
          }}>
            {/* Receipt header */}
            <div style={{
              background: 'var(--bg)',
              padding: '16px',
              textAlign: 'center',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{fontWeight:'800', fontSize:'15px', letterSpacing:'0.3px'}}>الصيدلية</div>
              <div style={{fontSize:'11px', color:'var(--text-muted)', marginTop:'2px'}}>فاتورة مبيعات</div>
            </div>

            {/* Meta info */}
            <div style={{padding:'12px 16px', borderBottom:'1px dashed var(--border)', background:'#fff'}}>
              {[
                ['التاريخ', new Date(data.ts).toLocaleDateString('ar-EG')],
                ['الوقت', new Date(data.ts).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})],
                ...(data.cashierName ? [['الكاشير', data.cashierName]] : []),
                ['طريقة الدفع', payLabel[data.paymentMethod] || data.paymentMethod],
              ].map(([label, val]) => (
                <div key={label} style={{display:'flex', justifyContent:'space-between', fontSize:'12px', lineHeight:'2', color:'#444'}}>
                  <span style={{color:'var(--text-muted)'}}>{label}</span>
                  <span style={{fontWeight:'600', color:'#111'}}>{val}</span>
                </div>
              ))}
            </div>

            {/* Items table */}
            <table style={{width:'100%', borderCollapse:'collapse', background:'#fff'}}>
              <thead>
                <tr style={{background:'var(--bg)', borderBottom:'1px solid var(--border)'}}>
                  <th style={{padding:'8px 16px', textAlign:'right', fontSize:'11px', fontWeight:'700', color:'var(--text-muted)'}}>الصنف</th>
                  <th style={{padding:'8px 8px', textAlign:'center', fontSize:'11px', fontWeight:'700', color:'var(--text-muted)'}}>الكمية</th>
                  <th style={{padding:'8px 16px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'var(--text-muted)'}}>السعر</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{borderBottom:'1px dashed var(--border)'}}>
                    <td style={{padding:'9px 16px'}}>
                      <div style={{fontWeight:'700', fontSize:'13px'}}>{item.name}</div>
                      {item.genericName && <div style={{fontSize:'10px', color:'var(--text-muted)', marginTop:'1px'}}>{item.genericName}</div>}
                    </td>
                    <td style={{padding:'9px 8px', textAlign:'center', fontSize:'12px', color:'var(--text-secondary)'}}>
                      {item.qty} {typeLabel[item.quantityType] || item.quantityType}
                    </td>
                    <td style={{padding:'9px 16px', textAlign:'left', fontWeight:'700', fontSize:'13px', color:'var(--primary)'}}>
                      {calcItemTotal(item).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{padding:'12px 16px', background:'var(--bg)', borderTop:'1px solid var(--border)'}}>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', color:'var(--text-muted)', marginBottom:'8px'}}>
                <span>عدد الاصناف</span><span>{items.length}</span>
              </div>
              <div style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                paddingTop:'10px', borderTop:'2px solid var(--border)',
                fontSize:'16px', fontWeight:'800',
              }}>
                <span>الاجمالي</span>
                <span style={{color:'var(--primary)', fontSize:'18px'}}>{Number(data.total).toFixed(2)} ج.م</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding:'12px 16px', textAlign:'center',
              fontSize:'11px', color:'var(--text-muted)',
              borderTop:'1px dashed var(--border)',
              lineHeight:'1.8', background:'#fff'
            }}>
              شكراً لتعاملكم معنا
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="modal-footer" style={{padding:'14px 20px', gap:'10px'}}>
          <button className="btn btn-ghost" onClick={onClose}>اغلاق</button>
          <button className="btn btn-primary" onClick={handlePrint} style={{gap:'8px'}}>
            طباعة الفاتورة
          </button>
        </div>
      </div>
    </div>
  );
}

function SaleHistory() {
  // ✅ جلب معلومات اليوزر من الـ AuthContext
  const { user } = useAuth();
  
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [date, setDate] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [printReceipt, setPrintReceipt] = useState(null);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      // الباك إند بيفلتر تلقائياً من الـ token — مش محتاجين نبعت cashierId
      const params = { page: p, limit: 20 };
      
      if (date) params.date = date;
      if (nameQuery.trim()) params.medicineName = nameQuery.trim();
      const { data } = await getSales(params);
      setSales(data.data);
      setPagination(data.pagination);
      setPage(p);
    } catch { toast.error('خطأ في تحميل السجل'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const payLabel = { cash: 'نقدي', card: 'كارت', wallet: 'محفظة', insurance: 'تأمين' };
  const payColor = { cash: 'badge-success', card: 'badge-info', wallet: 'badge-warning', insurance: 'badge-gray' };

  const openPrint = async (s) => {
    try {
      const { data } = await getSaleById(s.id);
      setPrintReceipt({
        id: data.id,
        total: data.total,
        profit: data.profit,
        paymentMethod: data.paymentMethod,
        cashierName: data.cashierName,
        ts: data.ts,
        items: (data.items || []).map(i => ({
          name: i.medicineName || '—',
          genericName: i.genericName || '',
          qty: i.qty,
          quantityType: i.quantityType || 'box',
          sellingPrice: i.unitPrice || 0,
          stripCount: i.stripCount,
          pillCount: i.pillCount,
        })),
      });
    } catch {
      toast.error('فشل تحميل تفاصيل الفاتورة');
    }
  };

  return (
    <div className="card animate-in">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <span className="card-title">سجل مبيعاتي</span>
        <div style={{ display: 'flex', gap: '10px', marginRight: 'auto', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', right: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="form-control"
              placeholder="بحث باسم الدواء..."
              style={{ width: '180px', paddingRight: '32px' }}
              value={nameQuery}
              onChange={e => setNameQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load(1)}
            />
          </div>
          <input type="date" className="form-control" style={{ width: '180px' }} value={date} onChange={e => setDate(e.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={() => load(1)}><Search size={14} />بحث</button>
          {(date || nameQuery) && <button className="btn btn-ghost btn-sm" onClick={() => { setDate(''); setNameQuery(''); setTimeout(() => load(1), 0); }}>الغاء الفلتر</button>}
        </div>
      </div>
      <div className="table-wrapper">
        {loading ? (
          <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: '44px', borderRadius: '6px' }} />)}
          </div>
        ) : sales.length === 0 ? (
          <div className="empty-state"><History size={48} /><h3>لا توجد مبيعات</h3></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>الاجمالي</th>
                <th>الربح</th>
                <th>طريقة الدفع</th>
                <th>التاريخ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(s)}>
                  <td><code style={{ fontSize: '11px', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px' }}>{s.id.slice(0, 8)}...</code></td>
                  <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{Number(s.total).toFixed(2)} ج</td>
                  <td style={{ color: 'var(--success)', fontWeight: '600' }}>{Number(s.profit).toFixed(2)} ج</td>
                  <td><span className={`badge ${payColor[s.paymentMethod] || 'badge-gray'}`}>{payLabel[s.paymentMethod] || s.paymentMethod}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(s.ts).toLocaleString('ar-EG')}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-icon" title="طباعة الفاتورة" style={{ color: 'var(--text-muted)' }} onClick={() => openPrint(s)}>
                      <Printer size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pagination.totalPages > 1 && (
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <div className="pagination">
            <button className="page-btn" disabled={page === 1} onClick={() => load(page - 1)}>السابق</button>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>صفحة {page} من {pagination.totalPages}</span>
            <button className="page-btn" disabled={page === pagination.totalPages} onClick={() => load(page + 1)}>التالي</button>
          </div>
        </div>
      )}

      {printReceipt && createPortal(
        <ReceiptModal data={printReceipt} onClose={() => setPrintReceipt(null)} isReprint={true} />,
        document.body
      )}
    </div>
  );
}
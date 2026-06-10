import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  LayoutDashboard, Pill, Users, Truck, ShoppingCart,
  ClipboardList, Bell, Settings, LogOut, Shield, FileText, Menu, X
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'الرئيسية', roles: ['admin', 'pharmacist', 'cashier'] },
  { to: '/medicines', icon: Pill, label: 'الأدوية', roles: ['admin', 'pharmacist'] },
  { to: '/sales', icon: ShoppingCart, label: 'المبيعات', roles: ['admin', 'pharmacist', 'cashier'] },
  { to: '/suppliers', icon: Truck, label: 'الموردين', roles: ['admin', 'pharmacist'] },
  { to: '/users', icon: Users, label: 'الموظفون', roles: ['admin'] },
  { to: '/attendance', icon: ClipboardList, label: 'الحضور والانصراف', roles: ['admin', 'pharmacist', 'cashier'] },
  { to: '/reports', icon: FileText, label: 'التقارير', roles: ['admin', 'pharmacist'] },
  { to: '/logs', icon: Shield, label: 'سجل الأحداث', roles: ['admin'] },
  { to: '/notifications', icon: Bell, label: 'التنبيهات', roles: ['admin', 'pharmacist'] },
  // تم إضافة 'pharmacist' هنا ليظهر زر الإعدادات للصيدلي
  { to: '/settings', icon: Settings, label: 'الإعدادات', roles: ['admin', 'pharmacist'] },
];

// أهم 4 عناصر للـ bottom nav بناءً على الرول
const mobileNavPrimary = {
  admin:      ['/', '/sales', '/medicines', '/reports'],
  pharmacist: ['/', '/sales', '/medicines', '/notifications'],
  cashier:    ['/', '/sales', '/attendance', '/'],
};

function SidebarContent({ allowed, user, onClose, navigate, logoutUser }) {
  const roleLabel = { admin: 'مدير', pharmacist: 'صيدلي', cashier: 'كاشير' };
  return (
    <>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #f0a500, #ffc82e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>💊</div>
          <div>
            <div style={{ color: 'white', fontSize: '15px', fontWeight: '800' }}>CarePlus</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>Pharmacy System</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px' }}>
        {allowed.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to} to={to} end={to === '/'}
            onClick={onClose}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px', borderRadius: '10px',
              textDecoration: 'none', marginBottom: '4px',
              fontSize: '14px', fontWeight: '500',
              transition: 'all 0.15s ease',
              background: isActive ? 'rgba(13,110,94,0.8)' : 'transparent',
              color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
            })}
          >
            {({ isActive }) => (
              <><Icon size={18} strokeWidth={isActive ? 2.5 : 2} /><span>{label}</span></>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #1a7f6e, #22a08d)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '15px', fontWeight: '700', flexShrink: 0 }}>
            {user?.fullName?.charAt(0) || user?.username?.charAt(0) || '؟'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: 'white', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.fullName || user?.username}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{roleLabel[user?.role]}</div>
          </div>
        </div>
        <button
          onClick={() => { logoutUser(); navigate('/login'); }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '8px', border: 'none', background: 'rgba(229,62,62,0.15)', color: '#fc8181', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'Cairo, sans-serif' }}
        >
          <LogOut size={15} />تسجيل الخروج
        </button>
      </div>
    </>
  );
}

export default function Layout({ children }) {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allowed = navItems.filter(item => item.roles.includes(user?.role));
  const primaryPaths = mobileNavPrimary[user?.role] || ['/', '/sales'];
  const mobileItems = [...new Map(
    primaryPaths.map(p => allowed.find(i => i.to === p)).filter(Boolean).map(i => [i.to, i])
  ).values()].slice(0, 4);

  // أضيف "المزيد" لو عنده أكتر من 4 عناصر
  const hasMore = allowed.length > 4;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Desktop Sidebar ── */}
      <aside className="desktop-sidebar" style={{
        width: 'var(--sidebar-width)',
        background: 'var(--bg-sidebar)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, right: 0, bottom: 0,
        zIndex: 100, overflowY: 'auto',
        borderLeft: '1px solid rgba(255,255,255,0.06)'
      }}>
        <SidebarContent allowed={allowed} user={user} navigate={navigate} logoutUser={logoutUser} />
      </aside>

      {/* ── Mobile Header ── */}
      <header className="mobile-header">
        <div className="mobile-header-logo">
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #f0a500, #ffc82e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>💊</div>
          <span>CarePlus</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setDrawerOpen(true)}>
          <Menu size={20} />
        </button>
      </header>

      {/* ── Mobile Drawer ── */}
      {drawerOpen && (
        <div className="mobile-drawer-overlay open" onClick={() => setDrawerOpen(false)}>
          <div className="mobile-drawer" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column' }}>
            <SidebarContent allowed={allowed} user={user} navigate={navigate} logoutUser={logoutUser} onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <main style={{ flex: 1, marginRight: 'var(--sidebar-width)', minHeight: '100vh', overflow: 'auto' }}>
        <div className="mobile-main-wrapper" style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto' }}>
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="mobile-nav">
        <div className="mobile-nav-items">
          {mobileItems.map(({ to, icon: Icon, label }) => {
            const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
            return (
              <NavLink key={to} to={to} className={`mobile-nav-item${isActive ? ' active' : ''}`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span>{label}</span>
              </NavLink>
            );
          })}
          {hasMore && (
            <button className={`mobile-nav-item${drawerOpen ? ' active' : ''}`} onClick={() => setDrawerOpen(true)}>
              <Menu size={22} strokeWidth={2} />
              <span>المزيد</span>
            </button>
          )}
        </div>
      </nav>

    </div>
  );
}
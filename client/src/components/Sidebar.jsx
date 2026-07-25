import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Ticket, 
  Users, 
  Building2, 
  UserCircle, 
  LogOut, 
  ShieldCheck, 
  Headphones, 
  User,
  Laptop
} from 'lucide-react';

export function Sidebar({ currentPage, setCurrentPage, onOpenCreateTicket }) {
  const { user, logout } = useAuth();

  const roleBadges = {
    admin: { label: 'Admin System', icon: ShieldCheck, color: '#dc2626' },
    it_support: { label: 'IT Support Team', icon: Headphones, color: '#2563eb' },
    employee: { label: 'Nhân viên', icon: User, color: '#059669' },
  };

  const currentRole = roleBadges[user?.role] || roleBadges.employee;
  const RoleIcon = currentRole.icon;

  const navItems = [
    { id: 'dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard, roles: ['employee', 'it_support', 'admin'] },
    { id: 'tickets', label: 'Quản lý Ticket', icon: Ticket, roles: ['employee', 'it_support', 'admin'] },
    { id: 'assets', label: 'Quản lý Tài Sản IT', icon: Laptop, roles: ['it_support', 'admin'] },
    { id: 'users', label: 'Quản lý Người dùng', icon: Users, roles: ['admin'] },
    { id: 'departments', label: 'Phòng ban & Danh mục', icon: Building2, roles: ['admin'] },
    { id: 'profile', label: 'Hồ sơ cá nhân', icon: UserCircle, roles: ['employee', 'it_support', 'admin'] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem', textAlign: 'center' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: '#eff6ff',
          color: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.45rem',
        }}>
          <Headphones size={22} />
        </div>
        <span style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: '700', letterSpacing: '0.5px' }}>
          HELPDESK IT
        </span>
      </div>

      {/* Quick Action Button */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button 
          onClick={onOpenCreateTicket}
          className="btn btn-primary" 
          style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.9rem' }}
        >
          + Gửi Yêu Cầu Mới
        </button>
      </div>

      {/* Navigation Menu */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? '#1d4ed8' : 'var(--text-muted)',
                fontWeight: isActive ? '700' : '600',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={20} color={isActive ? '#2563eb' : 'var(--text-subtle)'} />
              <span className="nav-text" style={{ fontSize: '0.9rem' }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="avatar" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="nav-text" style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: 'var(--text-main)' }}>
              {user?.full_name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: currentRole.color, fontWeight: '700' }}>
              <RoleIcon size={13} />
              <span>{currentRole.label}</span>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="btn btn-outline btn-sm"
          style={{ width: '100%', justifyContent: 'center', color: '#dc2626', borderColor: '#fca5a5' }}
        >
          <LogOut size={16} />
          <span className="nav-text">Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}

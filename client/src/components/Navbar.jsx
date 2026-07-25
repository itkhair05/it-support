import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { Bell, Search } from 'lucide-react';

export function Navbar({ title, searchGlobal, setSearchGlobal, onSelectTicket }) {
  const { notifications, unreadCount, markRead } = useNotifications();
  const { user } = useAuth();
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  return (
    <header className="top-navbar">
      {/* Title & Global Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>{title}</h1>
        
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
          <input
            type="text"
            placeholder="Tìm theo Mã Ticket, Tiêu đề, Tên..."
            value={searchGlobal || ''}
            onChange={(e) => setSearchGlobal(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '2.5rem', paddingRight: '1rem', height: '38px', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Department Tag */}
        {user?.department_name && (
          <span style={{ fontSize: '0.8rem', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.35rem 0.8rem', borderRadius: '20px', color: 'var(--text-muted)', fontWeight: '600' }}>
            🏢 {user.department_name}
          </span>
        )}

        {/* Notifications Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            style={{
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-main)',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <Bell size={20} color="var(--text-muted)" />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: '800',
                  borderRadius: '10px',
                  padding: '2px 6px',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Menu */}
          {showNotifMenu && (
            <div
              style={{
                position: 'absolute',
                top: '50px',
                right: 0,
                width: '360px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 60,
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>Thông báo ({unreadCount} chưa đọc)</span>
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.85rem' }}>
                  Không có thông báo mới nào
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      markRead(n.id);
                      if (n.link && n.link.startsWith('/tickets/')) {
                        const ticketId = parseInt(n.link.replace('/tickets/', ''), 10);
                        if (onSelectTicket) onSelectTicket(ticketId);
                      }
                      setShowNotifMenu(false);
                    }}
                    style={{
                      padding: '0.85rem 1rem',
                      borderBottom: '1px solid var(--border-color)',
                      background: n.is_read ? 'transparent' : '#eff6ff',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    <div style={{ fontWeight: '700', color: n.is_read ? 'var(--text-muted)' : '#1d4ed8', marginBottom: '0.2rem' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {!n.is_read && <span style={{ color: '#2563eb', fontWeight: '700' }}>● Mới</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

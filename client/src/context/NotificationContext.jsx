import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  // Fetch initial personal notifications
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await api.getNotifications();
      setNotifications(data || []);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (e) {
      console.error('Error fetching notifications:', e);
    }
  };

  useEffect(() => {
    if (!token || !user) return;
    fetchNotifications();

    // Setup WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('⚡ Personal WebSocket Notification Engine connected for user:', user.full_name);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        // Dispatch window event for page subscribers (realtime chat feed, status updates)
        window.dispatchEvent(new CustomEvent('helpdesk_ws_event', { detail: message }));
        handleWSEvent(message);
      } catch (err) {
        console.error('WS Parse Error:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [token, user]);

  const addToast = (title, message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, message, type }]);

    // Auto dismiss toast after 5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const handleWSEvent = (data) => {
    const { event, payload } = data;
    if (!payload) return;

    // Strict User Isolation Check:
    // If payload contains user_id, it MUST match the current user's ID
    if (payload.user_id && payload.user_id !== user?.id) {
      return; // Do NOT notify users about other people's notifications!
    }

    // Employees do not get notified of other people's NEW_TICKET
    if (event === 'NEW_TICKET' && user?.role === 'employee') {
      return;
    }

    // CHAT_STREAM_UPDATE is for active chat UI feed only, not for toast/notification bell
    if (event === 'CHAT_STREAM_UPDATE') {
      return;
    }

    // Refresh user's personal notifications list from DB
    fetchNotifications();

    // Show Toast Notification to target user
    if (event === 'NEW_TICKET') {
      addToast('Ticket mới khởi tạo', `${payload.reporter} vừa gửi ticket: ${payload.title} (${payload.code})`, 'info');
    } else if (event === 'TICKET_ASSIGNED') {
      addToast('Ticket mới được phân công', payload.message, 'warning');
    } else if (event === 'NEW_COMMENT_MENTION') {
      addToast('Bạn được nhắc tới (@mention)', `${payload.sender} vừa nhắc bạn trong ticket ${payload.code}`, 'purple');
    } else if (event === 'STATUS_CHANGED') {
      addToast('Cập nhật trạng thái Ticket', payload.message, 'success');
    } else if (event === 'NEW_COMMENT') {
      const sender = payload.sender || payload.user_name || 'Người dùng';
      const contentText = payload.content ? (payload.content.length > 35 ? payload.content.substring(0, 35) + '...' : payload.content) : 'bình luận mới';
      addToast('Bình luận mới', `${sender}: ${contentText}`, 'info');
    }
  };

  const markRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, toasts, addToast, markRead, refreshNotifications: fetchNotifications }}>
      {children}
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <div className="toast-icon">⚡</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{toast.title}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{toast.message}</div>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

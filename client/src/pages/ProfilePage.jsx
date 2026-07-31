import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { User, Lock, Save, ShieldCheck, Headphones } from 'lucide-react';

export function ProfilePage() {
  const { user, updateUser } = useAuth();

  // Update Profile Form
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [msgProfile, setMsgProfile] = useState('');
  const [errProfile, setErrProfile] = useState('');

  // Change Password Form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msgPass, setMsgPass] = useState('');
  const [errPass, setErrPass] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMsgProfile('');
    setErrProfile('');

    try {
      await api.updateProfile({ full_name: fullName, avatar_url: user?.avatar_url || '' });
      updateUser({ full_name: fullName });
      setMsgProfile('Cập nhật thông tin thành công!');
    } catch (err) {
      setErrProfile(err.message || 'Lỗi cập nhật hồ sơ');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMsgPass('');
    setErrPass('');

    if (newPassword !== confirmPassword) {
      setErrPass('Mật khẩu mới không trùng khớp');
      return;
    }

    try {
      await api.changePassword({ old_password: oldPassword, new_password: newPassword });
      setMsgPass('Đổi mật khẩu thành công!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrPass(err.message || 'Lỗi đổi mật khẩu');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px' }}>
      
      {/* Header Profile Badge */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div className="avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
          {user?.full_name?.charAt(0) || 'U'}
        </div>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800' }}>{user?.full_name}</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            📧 {user?.email} • 🏢 {user?.department_name || 'Công ty'}
          </div>
          <div style={{ marginTop: '0.4rem' }}>
            {user?.role === 'admin' && <span className="badge badge-rejected">👑 Quản trị viên (Admin)</span>}
            {user?.role === 'it_support' && <span className="badge badge-open">🎧 Nhân viên IT Support</span>}
            {user?.role === 'employee' && <span className="badge badge-resolved">👤 Nhân viên (Employee)</span>}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Module 13: Edit Profile */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} color="#3b82f6" /> Cập Nhật Hồ Sơ Cá Nhân
          </h3>

          {msgProfile && <div style={{ color: '#10b981', fontSize: '0.85rem', marginBottom: '1rem' }}>{msgProfile}</div>}
          {errProfile && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{errProfile}</div>}

          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label className="form-label">Email tài khoản</label>
              <input type="text" value={user?.email || ''} className="form-input" disabled style={{ opacity: 0.6 }} />
            </div>

            <div className="form-group">
              <label className="form-label">Họ và Tên hiển thị *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Save size={16} /> Lưu Thay Đổi
            </button>
          </form>
        </div>

        {/* Module 1 & 13: Change Password */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={18} color="#f59e0b" /> Đổi Mật Khẩu
          </h3>

          {msgPass && <div style={{ color: '#10b981', fontSize: '0.85rem', marginBottom: '1rem' }}>{msgPass}</div>}
          {errPass && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{errPass}</div>}

          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Mật khẩu hiện tại *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mật khẩu mới *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Xác nhận mật khẩu mới *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <button type="submit" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              Xác Nhận Đổi Mật Khẩu
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}

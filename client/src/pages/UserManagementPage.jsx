import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { UserPlus, Lock, Unlock, KeyRound, Search, ShieldCheck, Headphones, User } from 'lucide-react';

export function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add user form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('employee');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uData, dData] = await Promise.all([
        api.getUsers(),
        api.getDepartments(),
      ]);
      setUsers(uData);
      setDepartments(dData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.createUser({
        email,
        password,
        full_name: fullName,
        role,
        department_id: departmentId ? parseInt(departmentId, 10) : undefined,
      });
      setShowAddModal(false);
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('employee');
      setDepartmentId('');
      loadData();
    } catch (err) {
      setError(err.message || 'Lỗi khi tạo tài khoản');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await api.toggleUserStatus(id);
      loadData();
    } catch (err) {
      alert(err.message || 'Lỗi đổi trạng thái');
    }
  };

  const handleResetPassword = async (id, name) => {
    const confirm = window.confirm(`Bạn có chắc muốn đặt lại mật khẩu cho ${name} về mặc định (123456)?`);
    if (!confirm) return;

    try {
      const res = await api.resetUserPassword(id, '123456');
      alert(res.message);
    } catch (err) {
      alert(err.message || 'Lỗi reset mật khẩu');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Quản lý Tài Khoản Người Dùng</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Thêm mới nhân viên, cấp quyền IT Support, khóa/mở khóa tài khoản</p>
        </div>

        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <UserPlus size={18} />Thêm Người Dùng Mới
        </button>
      </div>

      {/* Users Table Card */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải người dùng...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Họ và tên</th>
                  <th style={{ padding: '0.75rem' }}>Email</th>
                  <th style={{ padding: '0.75rem' }}>Vai trò</th>
                  <th style={{ padding: '0.75rem' }}>Phòng ban</th>
                  <th style={{ padding: '0.75rem' }}>Trạng thái</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '700' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div className="avatar">{u.full_name?.charAt(0)}</div>
                        <span>{u.full_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {u.role === 'admin' && <span style={{ color: '#ef4444', fontWeight: '700' }}>👑 Admin</span>}
                      {u.role === 'it_support' && <span style={{ color: '#3b82f6', fontWeight: '700' }}>🎧 IT Support</span>}
                      {u.role === 'employee' && <span style={{ color: '#10b981' }}>👤 Employee</span>}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{u.department_name || 'Chưa gán'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {u.status === 'active' ? (
                        <span className="badge badge-resolved">Hoạt động</span>
                      ) : (
                        <span className="badge badge-rejected">Đã khóa</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleResetPassword(u.id, u.full_name)}
                          className="btn btn-outline btn-sm"
                          title="Đặt lại mật khẩu"
                        >
                          <KeyRound size={14} /> Reset Pass
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-secondary'}`}
                        >
                          {u.status === 'active' ? <Lock size={14} /> : <Unlock size={14} />}
                          {u.status === 'active' ? 'Khóa' : 'Mở khóa'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add User */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem' }}>Thêm Tài Khoản Người Dùng Mới</h3>
            
            {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label className="form-label">Họ và tên *</label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email tài khoản *</label>
                <input
                  type="email"
                  placeholder="user@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mật khẩu ban đầu *</label>
                <input
                  type="password"
                  placeholder="Mật khẩu ít nhất 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Vai trò (Role) *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="form-select"
                  >
                    <option value="employee">👤 Employee (Nhân viên)</option>
                    <option value="it_support">🎧 IT Support (Kỹ thuật viên)</option>
                    <option value="admin">👑 Admin (Quản trị viên)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Phòng ban</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Tạo Tài Khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

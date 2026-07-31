import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Laptop, Plus, Trash2, ShieldCheck, UserCheck } from 'lucide-react';

export function AssetManagementPage() {
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Asset form state
  const [assetTag, setAssetTag] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Laptop');
  const [serialNumber, setSerialNumber] = useState('');
  const [status, setStatus] = useState('active');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showAddModal) {
      api.getUsers().then(data => setUsers(data || [])).catch(console.error);
    }
  }, [showAddModal]);

  const loadData = async () => {
    setLoading(true);
    try {
      const aData = await api.getAssets().catch((err) => {
        console.error('Lỗi getAssets:', err);
        return [];
      });
      const uData = await api.getUsers().catch((err) => {
        console.error('Lỗi getUsers:', err);
        return [];
      });
      setAssets(aData || []);
      setUsers(uData || []);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu asset:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAsset = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.createAsset({
        asset_tag: assetTag,
        name,
        category,
        serial_number: serialNumber,
        status,
        assigned_to_user_id: assignedToUserId ? parseInt(assignedToUserId, 10) : undefined,
      });
      setShowAddModal(false);
      setAssetTag('');
      setName('');
      setCategory('Laptop');
      setSerialNumber('');
      setStatus('active');
      setAssignedToUserId('');
      loadData();
    } catch (err) {
      setError(err.message || 'Lỗi khi tạo thiết bị IT');
    }
  };

  const handleStatusChange = async (assetId, newStatus) => {
    // Cập nhật trạng thái tức thì trên giao diện (Optimistic UI Update)
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, status: newStatus } : a))
    );

    try {
      await api.updateAssetStatus(assetId, newStatus);
    } catch (err) {
      alert(err.message || 'Lỗi cập nhật trạng thái thiết bị');
      loadData(); // Nạp lại nếu có lỗi
    }
  };

  const handleDeleteAsset = async (id, tag) => {
    if (!window.confirm(`Bạn có chắc muốn xóa thiết bị ${tag} khỏi hệ thống?`)) return;

    try {
      await api.deleteAsset(id);
      loadData();
    } catch (err) {
      alert(err.message || 'Lỗi xóa thiết bị');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Laptop size={22} color="#2563eb" /> Quản Lý Tài Sản IT Doanh Nghiệp (IT Asset Management)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Quản lý danh sách máy tính, màn hình, thiết bị IT cấp phát cho nhân viên trong công ty</p>
        </div>

        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={18} />Thêm Thiết Bị IT Mới
        </button>
      </div>

      {/* Assets Table */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải danh sách tài sản...</div>
        ) : assets.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-subtle)' }}>Chưa có thiết bị IT nào được ghi nhận.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Mã Tài Sản</th>
                  <th style={{ padding: '0.75rem' }}>Tên Thiết Bị / Máy Tính</th>
                  <th style={{ padding: '0.75rem' }}>Loại</th>
                  <th style={{ padding: '0.75rem' }}>Số Serial</th>
                  <th style={{ padding: '0.75rem' }}>Người Được Cấp Phát</th>
                  <th style={{ padding: '0.75rem' }}>Trạng Thái</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '800', color: '#2563eb' }}>{a.asset_tag}</td>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>{a.name}</td>
                    <td style={{ padding: '0.75rem' }}>{a.category}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{a.serial_number || 'N/A'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {a.assigned_to_name ? (
                        <span style={{ fontWeight: '700', color: '#1d4ed8' }}>👤 {a.assigned_to_name}</span>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }}>Trong kho IT</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <select
                        value={a.status}
                        onChange={(e) => handleStatusChange(a.id, e.target.value)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          borderRadius: '20px',
                          border: '1px solid var(--border-color)',
                          background: a.status === 'active' ? '#dcfce7' : a.status === 'repairing' ? '#fef9c3' : '#f1f5f9',
                          color: a.status === 'active' ? '#15803d' : a.status === 'repairing' ? '#a16207' : '#475569',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="active">🟢 Đang sử dụng</option>
                        <option value="repairing">🟡 Đang bảo trì</option>
                        <option value="decommissioned">⚪ Thanh lý</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteAsset(a.id, a.asset_tag)}
                        className="btn btn-danger btn-sm"
                      >
                        <Trash2 size={14} /> Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add Asset */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem' }}>Khai Báo Thiết Bị IT Mới</h3>
            
            {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

            <form onSubmit={handleCreateAsset}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Mã Tài Sản (Asset Tag) *</label>
                  <input
                    type="text"
                    placeholder="VD: LAPTOP-IT-005"
                    value={assetTag}
                    onChange={(e) => setAssetTag(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Loại Thiết Bị *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="form-select"
                  >
                    <option value="Laptop">💻 Laptop</option>
                    <option value="Máy tính bàn">🖥️ Máy tính bàn (PC)</option>
                    <option value="Màn hình">🖥️ Màn hình</option>
                    <option value="Máy in">🖨️ Máy in / Photo</option>
                    <option value="Mạng & VPN">🌐 Thiết bị Mạng / Router</option>
                    <option value="Phụ kiện">🎧 Phụ kiện / Khác</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tên Thiết Bị / Mô tả cấu hình *</label>
                <input
                  type="text"
                  placeholder="VD: Laptop Dell XPS 15 (Core i7, 16GB RAM)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Số Serial (S/N)</label>
                  <input
                    type="text"
                    placeholder="VD: SN-DELL-99210"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Trạng Thái *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="form-select"
                  >
                    <option value="active">🟢 Đang hoạt động / Cấp phát</option>
                    <option value="repairing">🟡 Đang sửa chữa / Bảo hành</option>
                    <option value="decommissioned">⚪ Đã hỏng / Thanh lý</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Cấp phát cho Nhân viên (Người sử dụng thiết bị)</label>
                <select
                  value={assignedToUserId}
                  onChange={(e) => setAssignedToUserId(e.target.value)}
                  className="form-select"
                >
                  <option value="">-- Lưu trong Kho IT (Chưa cấp phát) --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      👤 {u.full_name} {u.department_name ? `• ${u.department_name}` : ''} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu Thiết Bị IT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

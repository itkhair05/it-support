import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, Upload, Zap, Laptop } from 'lucide-react';

export function CreateTicketModal({ isOpen, onClose, onSuccess }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [departmentId, setDepartmentId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [file, setFile] = useState(null);

  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [myAssets, setMyAssets] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.getCategories().then(setCategories).catch(console.error);
      api.getDepartments().then(setDepartments).catch(console.error);
      api.getAssets({ assigned_to_me: 'true' }).then(setMyAssets).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Feature 3: Quick Request Templates
  const handleApplyTemplate = (templateType) => {
    if (templateType === 'vpn') {
      setTitle('Cấp tài khoản VPN kết nối làm việc từ xa');
      setCategoryId(categories.find(c => c.name.includes('Internet'))?.id || '');
      setPriority('medium');
      setDescription('Kính gửi bộ phận IT,\nTôi cần cấp tài khoản VPN công ty để làm việc ngoài văn phòng / công tác.\nThời gian cần cấp: Từ hôm nay đến hết tháng.');
    } else if (templateType === 'pass') {
      setTitle('Yêu cầu đặt lại mật khẩu Email / Tài khoản PC');
      setCategoryId(categories.find(c => c.name.includes('Tài khoản'))?.id || '');
      setPriority('high');
      setDescription('Kính gửi bộ phận IT,\nTài khoản của tôi bị khóa hoặc không nhớ mật khẩu đăng nhập. Nhờ IT hỗ trợ reset mật khẩu về mặc định.');
    } else if (templateType === 'software') {
      setTitle('Yêu cầu cài đặt phần mềm bản quyền');
      setCategoryId(categories.find(c => c.name.includes('Phần mềm'))?.id || '');
      setPriority('medium');
      setDescription('Kính gửi bộ phận IT,\nNhờ IT hỗ trợ cài đặt các phần mềm phục vụ công việc:\n- Tên phần mềm: Microsoft Office 365 / Adobe Photoshop\n- Mục đích sử dụng: Phục vụ công việc phòng ban.');
    } else if (templateType === 'printer') {
      setTitle('Sự cố máy in phòng ban bị kẹt giấy / hết mực');
      setCategoryId(categories.find(c => c.name.includes('Máy in'))?.id || '');
      setPriority('high');
      setDescription('Kính gửi bộ phận IT,\nMáy in phòng ban hiện tại đang gặp sự cố khi in ấn tài liệu. Nhờ IT kiểm tra và khắc phục giúp.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !description.trim() || !categoryId) {
      setError('Vui lòng điền đầy đủ Tiêu đề, Mô tả và chọn Danh mục IT');
      return;
    }

    setSubmitting(true);
    try {
      const ticketRes = await api.createTicket({
        title,
        description,
        category_id: parseInt(categoryId, 10),
        priority,
        department_id: departmentId ? parseInt(departmentId, 10) : undefined,
        asset_id: assetId ? parseInt(assetId, 10) : undefined,
      });

      if (file && ticketRes.id) {
        const formData = new FormData();
        formData.append('file', file);
        await api.uploadAttachment(ticketRes.id, formData);
      }

      onSuccess();
      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setCategoryId('');
      setPriority('medium');
      setAssetId('');
      setFile(null);
    } catch (err) {
      setError(err.message || 'Lỗi khi gửi ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)' }}>Tạo Yêu Cầu Hỗ Trợ IT Mới</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Quick Request Templates Bar */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.85rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Zap size={14} color="#f59e0b" /> Mẫu Gửi Yêu Cầu Nhanh (1-Click Template)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <button type="button" onClick={() => handleApplyTemplate('vpn')} className="btn btn-outline btn-sm" style={{ background: '#ffffff', fontSize: '0.75rem' }}>
              🔑 Cấp VPN
            </button>
            <button type="button" onClick={() => handleApplyTemplate('pass')} className="btn btn-outline btn-sm" style={{ background: '#ffffff', fontSize: '0.75rem' }}>
              📧 Reset Pass
            </button>
            <button type="button" onClick={() => handleApplyTemplate('software')} className="btn btn-outline btn-sm" style={{ background: '#ffffff', fontSize: '0.75rem' }}>
              💻 Cài Software
            </button>
            <button type="button" onClick={() => handleApplyTemplate('printer')} className="btn btn-outline btn-sm" style={{ background: '#ffffff', fontSize: '0.75rem' }}>
              🖨️ Sự cố Máy in
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tiêu đề yêu cầu *</label>
            <input
              type="text"
              placeholder="VD: Máy in phòng Kế toán kẹt giấy liên tục"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Danh mục sự cố *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="form-select"
                required
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Mức độ ưu tiên *</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="form-select"
              >
                <option value="low">Thấp (Low)</option>
                <option value="medium">Trung bình (Medium)</option>
                <option value="high">Cao (High)</option>
                <option value="urgent">🚨 KHẨN CẤP (Urgent)</option>
              </select>
            </div>
          </div>

          {/* Feature 1: IT Asset Selector */}
          {myAssets.length > 0 && (
            <div className="form-group">
              <label className="form-label">Thiết bị IT gặp sự cố (Tài sản được cấp phát)</label>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="form-select"
              >
                <option value="">-- Chọn thiết bị IT (Tùy chọn) --</option>
                {myAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    💻 [{a.asset_tag}] {a.name} ({a.category})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Phòng ban tạo yêu cầu</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="form-select"
            >
              <option value="">-- Chọn phòng ban (Tùy chọn) --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả chi tiết sự cố *</label>
            <textarea
              rows={4}
              placeholder="Mô tả hoàn cảnh, mã lỗi hiển thị trên màn hình..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
              required
            />
          </div>

          {/* File Upload Attachment */}
          <div className="form-group">
            <label className="form-label">Tệp đính kèm (Ảnh chụp màn hình, Log, Tài liệu PDF/Zip...)</label>
            <div style={{ border: '2px dashed var(--border-color)', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: 'var(--bg-primary)' }}>
              <input
                type="file"
                id="file-input"
                onChange={(e) => setFile(e.target.files[0] || null)}
                style={{ display: 'none' }}
                accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip"
              />
              <label htmlFor="file-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={24} color="#2563eb" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {file ? file.name : 'Nhấp để chọn tệp (Hỗ trợ PDF, DOCX, XLSX, PNG, JPG, ZIP)'}
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Hủy bỏ
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Đang gửi...' : 'Gửi Yêu Cầu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Building2, Plus, Trash2, Layers } from 'lucide-react';

export function DepartmentManagementPage() {
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dData, cData] = await Promise.all([
        api.getDepartments(),
        api.getCategories(),
      ]);
      setDepartments(dData);
      setCategories(cData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    if (!deptName.trim()) return;

    try {
      await api.createDepartment({ name: deptName, description: deptDesc });
      setDeptName('');
      setDeptDesc('');
      loadData();
    } catch (err) {
      alert(err.message || 'Lỗi thêm phòng ban');
    }
  };

  const handleDeleteDepartment = async (id, name) => {
    if (!window.confirm(`Xác nhận xóa phòng ban "${name}"?`)) return;

    try {
      await api.deleteDepartment(id);
      loadData();
    } catch (err) {
      alert(err.message || 'Lỗi xóa phòng ban');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Module 9: Department Management */}
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.4rem' }}>Quản lý Danh Mục Phòng Ban & Phân Loại Sự Cố</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cấu hình danh mục cơ cấu tổ chức và các loại yêu cầu sự cố IT trong doanh nghiệp</p>
      </div>

      <div className="grid-2">
        {/* Create Department Form */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} color="#3b82f6" /> Thêm Phòng Ban Mới
          </h3>

          <form onSubmit={handleCreateDepartment}>
            <div className="form-group">
              <label className="form-label">Tên Phòng Ban *</label>
              <input
                type="text"
                placeholder="VD: Phòng Kế Toán"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mô tả chức năng</label>
              <textarea
                rows={3}
                placeholder="Mô tả công việc phòng ban..."
                value={deptDesc}
                onChange={(e) => setDeptDesc(e.target.value)}
                className="form-textarea"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Plus size={18} /> Thêm Phòng Ban
            </button>
          </form>
        </div>

        {/* Existing Departments List */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>Danh Sách Phòng Ban Doanh Nghiệp ({departments.length})</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto' }}>
            {departments.map((d) => (
              <div
                key={d.id}
                style={{
                  padding: '0.85rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{d.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.description || 'Chưa có mô tả'}</div>
                </div>

                <button
                  onClick={() => handleDeleteDepartment(d.id, d.name)}
                  className="btn btn-danger btn-sm"
                  style={{ padding: '0.3rem 0.5rem' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* IT Categories List Preview */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} color="#8b5cf6" /> Danh Mục Sự Cố IT Mặc Định (Core Categories)
        </h3>

        <div className="grid-4">
          {categories.map((c) => (
            <div key={c.id} style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: '700', color: '#60a5fa', marginBottom: '0.2rem' }}>📁 {c.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.description}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

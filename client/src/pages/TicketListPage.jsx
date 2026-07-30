import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { Search, Filter, Plus, ArrowRight, MessageSquare, Paperclip, Calendar } from 'lucide-react';

export function TicketListPage({ onSelectTicket, onOpenCreateTicket, globalSearch }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState(globalSearch || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'my_assigned', 'unassigned'

  useEffect(() => {
    if (globalSearch !== undefined) {
      setSearch(globalSearch);
    }
  }, [globalSearch]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadTickets();
  }, [search, statusFilter, priorityFilter, categoryFilter, activeTab]);

  const loadCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category_id = categoryFilter;

      if (activeTab === 'my_assigned') {
        params.my_tickets = 'true';
      } else if (activeTab === 'unassigned') {
        params.unassigned = 'true';
      }

      const data = await api.getTickets(params);
      setTickets(data);
    } catch (err) {
      console.error('Lỗi lấy danh sách ticket:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (tickets.length === 0) {
      alert('Không có dữ liệu ticket để xuất báo cáo');
      return;
    }

    const headers = ['Mã Ticket', 'Tiêu Đề', 'Người Gửi', 'Phòng Ban', 'Danh Mục', 'Ưu Tiên', 'Trạng Thái', 'Chuyên Viên IT', 'Ngày Tạo'];
    const rows = tickets.map((t) => [
      t.code,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.reporter_name || ''}"`,
      `"${t.department_name || ''}"`,
      `"${t.category_name || ''}"`,
      t.priority,
      t.status,
      `"${t.assignee_name || 'Chưa gán'}"`,
      new Date(t.created_at).toLocaleString(),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `HelpDesk_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Role Specific Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '0.35rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'all' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'all' ? 'white' : 'var(--text-muted)',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Tất Cả Ticket ({tickets.length})
          </button>
          
          {(user?.role === 'it_support' || user?.role === 'admin') && (
            <>
              <button
                onClick={() => setActiveTab('my_assigned')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'my_assigned' ? 'var(--primary)' : 'transparent',
                  color: activeTab === 'my_assigned' ? 'white' : 'var(--text-muted)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Ticket Của Tôi Giao
              </button>

              <button
                onClick={() => setActiveTab('unassigned')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'unassigned' ? 'var(--primary)' : 'transparent',
                  color: activeTab === 'unassigned' ? 'white' : 'var(--text-muted)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Hàng Chờ Chưa Giao (Open Queue)
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={handleExportCSV} className="btn btn-secondary" title="Xuất báo cáo Excel / CSV">
            📊 Xuất Báo Cáo Excel
          </button>
          <button onClick={onOpenCreateTicket} className="btn btn-primary">
            <Plus size={18} /> Gửi Yêu Cầu Mới
          </button>
        </div>
      </div>

      {/* Module 12: Filter Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'center' }}>
          
          {/* Keyword search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Từ khóa, ID (TIC-100x)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.25rem', height: '38px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
              style={{ height: '38px', fontSize: '0.85rem' }}
            >
              <option value="">-- Tất cả trạng thái --</option>
              <option value="open">Open (Mới tạo)</option>
              <option value="assigned">Assigned (Đã giao)</option>
              <option value="in_progress">In Progress (Đang xử lý)</option>
              <option value="waiting">Waiting (Đang chờ)</option>
              <option value="resolved">Resolved (Hoàn thành)</option>
              <option value="closed">Closed (Đã đóng)</option>
              <option value="rejected">Rejected (Từ chối)</option>
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="form-select"
              style={{ height: '38px', fontSize: '0.85rem' }}
            >
              <option value="">-- Tất cả độ ưu tiên --</option>
              <option value="urgent">🚨 Urgent (Khẩn cấp)</option>
              <option value="high">High (Cao)</option>
              <option value="medium">Medium (Trung bình)</option>
              <option value="low">Low (Thấp)</option>
            </select>
          </div>

          {/* Category filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-select"
              style={{ height: '38px', fontSize: '0.85rem' }}
            >
              <option value="">-- Tất cả danh mục --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear filters button */}
          {(search || statusFilter || priorityFilter || categoryFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setPriorityFilter('');
                setCategoryFilter('');
              }}
              className="btn btn-outline btn-sm"
              style={{ height: '38px', justifyContent: 'center' }}
            >
              Xóa bộ lọc
            </button>
          )}

        </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải danh sách ticket...</div>
      ) : tickets.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-subtle)' }}>
          Không tìm thấy Ticket nào phù hợp với bộ lọc.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {tickets.map((t) => (
            <div
              key={t.id}
              className="card card-interactive"
              onClick={() => onSelectTicket(t.id)}
              style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
            >
              <div style={{ flex: 1, minWidth: '300px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: '800', color: '#60a5fa', fontSize: '0.95rem' }}>{t.code}</span>
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                  {t.title}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span>👤 {t.reporter_name}</span>
                  {t.department_name && <span>🏢 {t.department_name}</span>}
                  <span>📁 {t.category_name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={14} /> {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                {t.assignee_name ? (
                  <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                    <div style={{ color: 'var(--text-subtle)' }}>Người xử lý:</div>
                    <div style={{ fontWeight: '700', color: '#a78bfa' }}>🎧 {t.assignee_name}</div>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: '600' }}>
                    Chưa gán IT
                  </span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <MessageSquare size={16} /> {t.comments_count || 0}
                  </span>
                  <ArrowRight size={18} color="var(--primary)" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

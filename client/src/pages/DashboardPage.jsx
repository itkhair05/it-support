import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  TrendingUp, 
  Users, 
  Layers, 
  ArrowRight,
  Headphones
} from 'lucide-react';

export function DashboardPage({ onSelectTicket, onOpenCreateTicket }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, ticketsData] = await Promise.all([
        api.getStats(),
        api.getTickets({ my_tickets: user?.role === 'employee' ? 'true' : 'false' }),
      ]);
      setStats(statsData);
      setRecentTickets(ticketsData.slice(0, 5));
    } catch (err) {
      console.error('Lỗi tải dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải dữ liệu Bảng điều khiển...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Welcome Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #eff6ff, #f3e8ff)', borderColor: '#bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.4rem', color: '#1e3a8a' }}>
            Xin chào, {user?.full_name} 👋
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {user?.role === 'admin' && 'Bảng tổng quan điều hành toàn hệ thống HelpDesk IT.'}
            {user?.role === 'it_support' && 'Danh sách hàng chờ Ticket & các công việc IT được giao.'}
            {user?.role === 'employee' && 'Theo dõi trạng thái và tiến độ xử lý các sự cố IT của bạn.'}
          </p>
        </div>
        <button onClick={onOpenCreateTicket} className="btn btn-primary">
          + Gửi Yêu Cầu IT Mới
        </button>
      </div>

      {/* Module 2: Role-based KPI Stat Cards */}
      <div className="grid-4">
        {user?.role === 'employee' ? (
          <>
            <StatCard title="Ticket của tôi" value={stats?.total_tickets || 0} icon={Ticket} color="#2563eb" bg="#eff6ff" />
            <StatCard title="Đang xử lý" value={stats?.in_progress || 0} icon={Clock} color="#0284c7" bg="#e0f2fe" />
            <StatCard title="Đã hoàn thành" value={stats?.resolved_tickets || 0} icon={CheckCircle2} color="#059669" bg="#ecfdf5" />
            <StatCard title="Bị từ chối" value={stats?.rejected_tickets || 0} icon={XCircle} color="#dc2626" bg="#fef2f2" />
          </>
        ) : user?.role === 'it_support' ? (
          <>
            <StatCard title="Ticket được giao" value={stats?.assigned_tickets || 0} icon={Headphones} color="#7c3aed" bg="#f3e8ff" />
            <StatCard title="Đang xử lý" value={stats?.in_progress || 0} icon={Clock} color="#0284c7" bg="#e0f2fe" />
            <StatCard title="Ticket quá hạn SLA" value={stats?.overdue_tickets || 0} icon={AlertTriangle} color="#dc2626" bg="#fef2f2" />
            <StatCard title="Ưu tiên Cao / Khẩn" value={stats?.urgent_tickets || 0} icon={TrendingUp} color="#d97706" bg="#fffbeb" />
          </>
        ) : (
          <>
            <StatCard title="Tổng Ticket" value={stats?.total_tickets || 0} icon={Ticket} color="#2563eb" bg="#eff6ff" />
            <StatCard title="Ticket mới (Open)" value={stats?.open_tickets || 0} icon={Clock} color="#7c3aed" bg="#f3e8ff" />
            <StatCard title="Đang xử lý" value={stats?.in_progress || 0} icon={Layers} color="#0284c7" bg="#e0f2fe" />
            <StatCard title="Ticket quá hạn" value={stats?.overdue_tickets || 0} icon={AlertTriangle} color="#dc2626" bg="#fef2f2" />
          </>
        )}
      </div>

      {/* Module 10: Analytics Charts Visualizer */}
      {user?.role === 'admin' && stats && (
        <div className="grid-2">
          {/* Department Breakdown */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
              <Users size={18} color="#2563eb" /> Ticket theo Phòng Ban
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {stats.by_department?.map((d, i) => {
                const pct = stats.total_tickets ? Math.round((d.count / stats.total_tickets) * 100) : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-main)' }}>
                      <span>{d.department_name}</span>
                      <span style={{ fontWeight: '700' }}>{d.count} ticket ({pct}%)</span>
                    </div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(to right, #2563eb, #7c3aed)', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Priority Breakdown */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
              <TrendingUp size={18} color="#d97706" /> Phân bố theo Mức độ Ưu tiên
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {stats.by_priority?.map((p, i) => {
                const pct = stats.total_tickets ? Math.round((p.count / stats.total_tickets) * 100) : 0;
                const colors = { urgent: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#64748b' };
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-main)' }}>
                      <span style={{ textTransform: 'capitalize' }}><PriorityBadge priority={p.priority} /></span>
                      <span style={{ fontWeight: '700' }}>{p.count} ticket ({pct}%)</span>
                    </div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: colors[p.priority] || '#2563eb', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent Tickets Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1e293b' }}>Ticket Gần Đây</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cập nhật mới nhất</span>
        </div>

        {recentTickets.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-subtle)' }}>
            Chưa có ticket nào được gửi.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Mã</th>
                  <th style={{ padding: '0.75rem' }}>Tiêu đề Yêu cầu</th>
                  <th style={{ padding: '0.75rem' }}>Người gửi</th>
                  <th style={{ padding: '0.75rem' }}>Danh mục</th>
                  <th style={{ padding: '0.75rem' }}>Ưu tiên</th>
                  <th style={{ padding: '0.75rem' }}>Trạng thái</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '700', color: '#2563eb' }}>{t.code}</td>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>{t.title}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{t.reporter_name}</td>
                    <td style={{ padding: '0.75rem' }}>{t.category_name}</td>
                    <td style={{ padding: '0.75rem' }}><PriorityBadge priority={t.priority} /></td>
                    <td style={{ padding: '0.75rem' }}><StatusBadge status={t.status} /></td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <button
                        onClick={() => onSelectTicket(t.id)}
                        className="btn btn-outline btn-sm"
                      >
                        Chi tiết <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }) {
  return (
    <div className="card card-interactive" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
      <div style={{ background: bg || '#eff6ff', border: `1px solid ${color}30`, padding: '0.9rem', borderRadius: '12px', color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={28} />
      </div>
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>{title}</div>
        <div style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1.2, color: 'var(--text-main)' }}>{value}</div>
      </div>
    </div>
  );
}

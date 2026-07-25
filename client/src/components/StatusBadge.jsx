import React from 'react';

export function StatusBadge({ status }) {
  const statusLabels = {
    open: 'Mới tạo (Open)',
    assigned: 'Đã giao (Assigned)',
    in_progress: 'Đang xử lý (In Progress)',
    waiting: 'Đang chờ (Waiting)',
    resolved: 'Đã hoàn thành (Resolved)',
    closed: 'Đã đóng (Closed)',
    rejected: 'Bị từ chối (Rejected)',
  };

  return (
    <span className={`badge badge-${status || 'open'}`}>
      {statusLabels[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const labels = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    urgent: '🚨 KHẨN CẤP',
  };

  return (
    <span className={`priority-${priority || 'medium'}`} style={{ fontSize: '0.85rem', fontWeight: '700' }}>
      {labels[priority] || priority}
    </span>
  );
}

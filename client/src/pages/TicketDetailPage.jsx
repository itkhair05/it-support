import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { 
  ArrowLeft, 
  Send, 
  Paperclip, 
  Clock, 
  UserCheck, 
  History, 
  MessageSquare, 
  Download, 
  FileText,
  Printer,
  CornerDownRight,
  XCircle,
  AlertTriangle
} from 'lucide-react';

export function TicketDetailPage({ ticketId, onBack }) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [itUsers, setItUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('discussion'); // 'discussion' or 'logs'
  const [loading, setLoading] = useState(true);

  // Comment input
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sendingComment, setSendingComment] = useState(false);
  const [mentionMenu, setMentionMenu] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  // File upload inline
  const [uploading, setUploading] = useState(false);

  // Rating (reporter only, after resolution)
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    loadTicketDetails();
  }, [ticketId]);

  // Realtime WebSocket listener for instant comment & status updates
  useEffect(() => {
    const handleWSEvent = (e) => {
      const { event, payload } = e.detail || {};
      if (!payload) return;

      const currentTID = parseInt(ticketId, 10);

      if ((event === 'CHAT_STREAM_UPDATE' || event === 'NEW_COMMENT') && payload.ticket_id === currentTID) {
        const commentObj = payload.comment || payload;
        if (commentObj && commentObj.id) {
          setComments((prev) => {
            if (prev.some((c) => c.id === commentObj.id)) return prev;
            return [...prev, commentObj];
          });
        }
      } else if ((event === 'STATUS_CHANGED' || event === 'TICKET_ASSIGNED') && payload.ticket_id === currentTID) {
        loadTicketDetails();
      }
    };

    window.addEventListener('helpdesk_ws_event', handleWSEvent);
    return () => window.removeEventListener('helpdesk_ws_event', handleWSEvent);
  }, [ticketId]);

  const loadTicketDetails = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const tData = await api.getTicketDetail(ticketId);
      setTicket(tData);

      const cData = await api.getComments(ticketId).catch((e) => {
        console.error('Lỗi nạp comments:', e);
        return [];
      });
      const lData = await api.getActivityLogs(ticketId).catch((e) => {
        console.error('Lỗi nạp logs:', e);
        return [];
      });
      setComments(cData || []);
      setActivityLogs(lData || []);

      if (user?.role === 'admin' || user?.role === 'it_support') {
        const usersData = await api.getUsers('it_support').catch(() => []);
        setItUsers(usersData || []);
      }

      const allU = await api.getUsers().catch(() => []);
      setAllUsers(allU || []);

    } catch (err) {
      console.error('Lỗi chi tiết ticket:', err);
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.updateTicketStatus(ticketId, newStatus);
      loadTicketDetails();
    } catch (err) {
      alert(err.message || 'Lỗi đổi trạng thái');
    }
  };

  const handleCancelTicket = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn HỦY yêu cầu hỗ trợ này không?')) return;
    try {
      await api.updateTicketStatus(ticketId, 'rejected');
      loadTicketDetails();
    } catch (err) {
      alert(err.message || 'Lỗi khi hủy ticket');
    }
  };

  const handleAssign = async (assigneeId) => {
    try {
      await api.assignTicket(ticketId, parseInt(assigneeId, 10));
      loadTicketDetails();
    } catch (err) {
      alert(err.message || 'Lỗi phân công ticket');
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSendingComment(true);
    try {
      const createdCm = await api.createComment(ticketId, {
        content: commentText,
        parent_id: replyTo ? replyTo.id : undefined,
      });
      setCommentText('');
      setReplyTo(null);

      if (createdCm && createdCm.id) {
        setComments((prev) => (prev.some((c) => c.id === createdCm.id) ? prev : [...prev, createdCm]));
      }

      const lData = await api.getActivityLogs(ticketId);
      setActivityLogs(lData || []);
    } catch (err) {
      alert(err.message || 'Lỗi khi gửi bình luận. Vui lòng thử lại.');
    } finally {
      setSendingComment(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.uploadAttachment(ticketId, formData);
      loadTicketDetails();
    } catch (err) {
      alert(err.message || 'Lỗi đính kèm file');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (rating < 1) return;
    setSubmittingRating(true);
    try {
      await api.rateTicket(ticketId, {
        rating,
        rating_comment: ratingComment,
      });
      loadTicketDetails();
    } catch (err) {
      alert(err.message || 'Lỗi gửi đánh giá');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setCommentText(val);

    if (val.endsWith('@')) {
      setMentionMenu(true);
    } else if (!val.includes('@')) {
      setMentionMenu(false);
    }
  };

  const insertMention = (userName) => {
    setCommentText((prev) => prev.slice(0, prev.lastIndexOf('@')) + `@${userName} `);
    setMentionMenu(false);
  };

  const handleReplyClick = (commentItem) => {
    setReplyTo(commentItem);
    const mentionTag = `@${commentItem.user_name} `;
    if (!commentText.includes(mentionTag)) {
      setCommentText(mentionTag + commentText);
    }
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải thông tin ticket...</div>;
  }

  if (!ticket) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>Không tìm thấy thông tin Ticket.</div>;
  }

  const isReporter = ticket.reporter_id === user?.id;

  // SLA Calculation
  let slaBadge = null;
  if (ticket.deadline && ticket.status !== 'resolved' && ticket.status !== 'closed' && ticket.status !== 'rejected') {
    const now = new Date();
    const deadlineDate = new Date(ticket.deadline);
    const diffMinutes = Math.round((deadlineDate - now) / (1000 * 60));
    
    if (diffMinutes < 0) {
      slaBadge = (
        <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <AlertTriangle size={14} /> 🚨 QUÁ HẠN SLA ({Math.abs(Math.round(diffMinutes / 60))} giờ)
        </span>
      );
    } else {
      const hoursLeft = Math.floor(diffMinutes / 60);
      const minsLeft = diffMinutes % 60;
      slaBadge = (
        <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <Clock size={14} /> ⏳ SLA Còn: {hoursLeft}h {minsLeft}m
        </span>
      );
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Bar Navigation & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onBack} className="btn btn-outline btn-sm">
            <ArrowLeft size={16} /> Quay lại danh sách
          </button>
          
          <button onClick={() => window.print()} className="btn btn-secondary btn-sm" title="In phiếu yêu cầu IT">
            <Printer size={16} /> In Phiếu Yêu Cầu
          </button>

          {/* Employee Cancel Ticket when status is OPEN */}
          {ticket.status === 'open' && (isReporter || user?.role === 'admin') && (
            <button onClick={handleCancelTicket} className="btn btn-danger btn-sm">
              <XCircle size={16} /> Hủy Yêu Cầu Này
            </button>
          )}
        </div>

        {/* Quick Action Controls for IT & Admin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          
          {(user?.role === 'admin' || user?.role === 'it_support') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Gán IT:</span>
              <select
                value={ticket.assignee_id || ''}
                onChange={(e) => handleAssign(e.target.value)}
                className="form-select"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
              >
                <option value="">-- Chọn IT Support --</option>
                {itUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {user?.role === 'it_support' && !ticket.assignee_id && (
            <button onClick={() => handleAssign(user.id)} className="btn btn-primary btn-sm">
              <UserCheck size={16} /> Nhận Ticket Này (Claim)
            </button>
          )}

          {(user?.role === 'admin' || user?.role === 'it_support') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Đổi trạng thái:</span>
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="form-select"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', fontWeight: '700' }}
              >
                <option value="open">Open (Mới tạo)</option>
                <option value="assigned">Assigned (Đã giao)</option>
                <option value="in_progress">In Progress (Đang xử lý)</option>
                <option value="waiting">Waiting (Đang chờ)</option>
                <option value="resolved">Resolved (Hoàn thành)</option>
                <option value="closed">Closed (Đã đóng)</option>
                <option value="rejected">Rejected (Từ chối / Hủy)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Ticket Info Header Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#2563eb' }}>{ticket.code}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {slaBadge}
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)' }}>{ticket.title}</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div>Tạo lúc: <strong>{new Date(ticket.created_at).toLocaleString()}</strong></div>
            {ticket.deadline && (
              <div style={{ color: '#d97706', marginTop: '0.2rem' }}>
                ⏳ SLA Deadline: <strong>{new Date(ticket.deadline).toLocaleString()}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Reporter & Assignee Metadata Grid */}
        <div className="grid-3" style={{ fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: 'var(--text-subtle)' }}>Người gửi yêu cầu:</span>
            <div style={{ fontWeight: '700', marginTop: '0.2rem', color: 'var(--text-main)' }}>👤 {ticket.reporter_name}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-subtle)' }}>Phòng ban & Danh mục:</span>
            <div style={{ fontWeight: '700', marginTop: '0.2rem', color: 'var(--text-main)' }}>🏢 {ticket.department_name || 'N/A'} • 📁 {ticket.category_name}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-subtle)' }}>Chuyên viên IT đảm nhận:</span>
            <div style={{ fontWeight: '700', marginTop: '0.2rem', color: ticket.assignee_name ? '#6b21a8' : '#dc2626' }}>
              🎧 {ticket.assignee_name || 'Chưa gán người xử lý'}
            </div>
          </div>
        </div>
      </div>

      {/* Rating Card: reporter rates resolved work; others see the result */}
      {ticket.rating > 0 ? (
        <div className="card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>⭐ Đánh giá chất lượng hỗ trợ IT</h4>
              <div style={{ fontSize: '1.3rem', color: '#f59e0b', letterSpacing: '0.15rem' }}>
                {'★'.repeat(ticket.rating)}{'☆'.repeat(5 - ticket.rating)}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem', letterSpacing: 'normal' }}>
                  {ticket.rating}/5 từ {ticket.reporter_name}
                </span>
              </div>
            </div>
            {ticket.rating_comment && (
              <div style={{ flex: 1, minWidth: '220px', fontSize: '0.85rem', color: 'var(--text-main)', fontStyle: 'italic', borderLeft: '3px solid #f59e0b', paddingLeft: '0.75rem' }}>
                "{ticket.rating_comment}"
              </div>
            )}
          </div>
        </div>
      ) : isReporter && (ticket.status === 'resolved' || ticket.status === 'closed') && (
        <div className="card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            ⭐ Đánh giá chất lượng hỗ trợ IT của bạn thế nào?
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1.8rem', cursor: 'pointer', userSelect: 'none', color: '#f59e0b', letterSpacing: '0.15rem' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  onClick={() => setRating(star)}
                  style={{ color: star <= rating ? '#f59e0b' : '#d1d5db', transition: 'color 0.15s' }}
                  title={`${star} sao`}
                >
                  ★
                </span>
              ))}
            </div>
            <input
              type="text"
              className="form-input"
              placeholder="Nhận xét thêm (tùy chọn)..."
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              style={{ flex: 1, minWidth: '200px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
            />
            <button onClick={handleSubmitRating} className="btn btn-primary btn-sm" disabled={submittingRating || rating < 1}>
              {submittingRating ? 'Đang gửi...' : 'Gửi đánh giá'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs Menu: Discussion vs Activity Log */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('discussion')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'discussion' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'discussion' ? '#2563eb' : 'var(--text-muted)',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          <MessageSquare size={18} /> Trao đổi & Bình luận ({comments.length})
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'logs' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'logs' ? '#2563eb' : 'var(--text-muted)',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          <History size={18} /> Lịch sử thao tác ({activityLogs.length})
        </button>
      </div>

      {/* TAB CONTENT: Discussion & Messenger Comments */}
      {activeTab === 'discussion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Ticket Original Description & Attachments Box */}
          <div className="card" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Mô tả chi tiết sự cố:</h4>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '0.95rem', color: 'var(--text-main)' }}>{ticket.description}</p>

            {/* Attachments Section */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Paperclip size={16} /> Tệp đính kèm ({ticket.attachments.length}):
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {ticket.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`${att.file_path}?token=${localStorage.getItem('helpdesk_token')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card"
                      style={{
                        padding: '0.6rem 0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        fontSize: '0.8rem',
                        textDecoration: 'none',
                        color: 'var(--text-main)',
                        background: '#ffffff',
                        borderColor: '#cbd5e1',
                      }}
                    >
                      <FileText size={18} color="#2563eb" />
                      <div>
                        <div style={{ fontWeight: '600' }}>{att.file_name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>{(att.file_size / 1024).toFixed(1)} KB</div>
                      </div>
                      <Download size={14} color="var(--text-muted)" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Module 4: Messenger Stream Comments */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>Bình luận trao đổi</h3>
              
              <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                <Paperclip size={16} /> {uploading ? 'Đang tải tệp...' : '+ Đính kèm file'}
                <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
              </label>
            </div>

            {comments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-subtle)', fontSize: '0.85rem' }}>
                Chưa có bình luận nào. Hãy gửi phản hồi đầu tiên!
              </div>
            ) : (
              <div className="chat-container">
                {comments.map((c) => {
                  const isMine = c.user_id === user?.id;
                  const isIT = c.user_role === 'it_support' || c.user_role === 'admin';
                  
                  const parentComment = c.parent_id ? comments.find((p) => p.id === c.parent_id) : null;

                  return (
                    <div key={c.id} className={`chat-bubble ${isMine ? 'own' : ''}`}>
                      <div className="avatar" style={{ background: isIT ? '#dbeafe' : '#f1f5f9', color: isIT ? '#1d4ed8' : '#475569' }}>
                        {c.user_name?.charAt(0) || 'U'}
                      </div>
                      <div className="chat-content">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.8rem' }}>{c.user_name}</span>
                          {isIT && <span style={{ fontSize: '0.65rem', background: '#2563eb', color: 'white', padding: '1px 5px', borderRadius: '4px' }}>IT</span>}
                          <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {parentComment && (
                          <div style={{ background: isMine ? 'rgba(255, 255, 255, 0.2)' : '#e2e8f0', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '0.4rem', borderLeft: '3px solid #2563eb' }}>
                            <CornerDownRight size={12} style={{ display: 'inline', marginRight: '4px' }} />
                            Trả lời <strong>{parentComment.user_name}</strong>: "{parentComment.content.substring(0, 30)}..."
                          </div>
                        )}

                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {c.content}
                        </div>

                        <button
                          onClick={() => handleReplyClick(c)}
                          style={{ background: 'none', border: 'none', color: isMine ? '#e0f2fe' : '#2563eb', fontSize: '0.75rem', cursor: 'pointer', marginTop: '0.3rem', padding: 0, fontWeight: '600' }}
                        >
                          Trả lời
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Comment Form Input */}
            <form onSubmit={handleSendComment} style={{ marginTop: '1rem', position: 'relative' }}>
              {replyTo && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#1d4ed8' }}>Đang trả lời: <strong>{replyTo.user_name}</strong> ("{replyTo.content.substring(0, 30)}...")</span>
                  <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: '700' }}>Xóa</button>
                </div>
              )}

              {mentionMenu && (
                <div style={{ position: 'absolute', bottom: '60px', left: 0, background: 'var(--bg-card)', border: '1px solid var(--primary)', borderRadius: '8px', zIndex: 10, width: '240px', maxHeight: '150px', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                  <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', fontWeight: '700' }}>
                    Nhắc tới thành viên:
                  </div>
                  {allUsers.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => insertMention(u.full_name)}
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      @{u.full_name} <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>({u.role})</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Nhập nội dung bình luận (Gõ @ để nhắc tới thành viên)..."
                  value={commentText}
                  onChange={handleTextChange}
                  className="form-input"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={sendingComment}>
                  <Send size={16} /> Gửi
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* Module 11: Activity Log Timeline Tab */}
      {activeTab === 'logs' && (
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.25rem', color: 'var(--text-main)' }}>Lịch sử thao tác Ticket (Audit Log)</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', paddingLeft: '1.5rem' }}>
            <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: 'var(--border-color)' }} />

            {activityLogs.map((log) => (
              <div key={log.id} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-1.5rem', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--primary)', border: '3px solid var(--bg-card)' }} />
                
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <span style={{ fontWeight: '700', color: '#1d4ed8' }}>{log.user_name}</span> - 
                  <strong style={{ marginLeft: '0.3rem' }}>{log.action}</strong>
                </div>
                
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                  {log.details}
                </div>

                <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
                  <Clock size={12} style={{ display: 'inline', marginRight: '3px' }} />
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

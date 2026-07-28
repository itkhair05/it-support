import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Headphones, User, Lock, Mail, ArrowRight, UserPlus } from 'lucide-react';

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        await register({ email, password, full_name: fullName });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || (mode === 'register' ? 'Không thể đăng ký tài khoản' : 'Email hoặc mật khẩu không chính xác'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setPassword('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #eff6ff, #f8fafc)', padding: '1.5rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-lg)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: '#eff6ff',
            color: '#2563eb',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
          }}>
            <Headphones size={28} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.25rem', color: '#1e293b' }}>HelpDesk IT</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Hệ thống hỗ trợ kỹ thuật nội bộ</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '0.35rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="btn btn-sm"
            style={{
              justifyContent: 'center',
              background: mode === 'login' ? '#ffffff' : 'transparent',
              color: mode === 'login' ? '#1d4ed8' : 'var(--text-muted)',
              border: mode === 'login' ? '1px solid #bfdbfe' : '1px solid transparent',
              boxShadow: mode === 'login' ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
              fontWeight: 700,
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className="btn btn-sm"
            style={{
              justifyContent: 'center',
              background: mode === 'register' ? '#ffffff' : 'transparent',
              color: mode === 'register' ? '#1d4ed8' : 'var(--text-muted)',
              border: mode === 'register' ? '1px solid #bfdbfe' : '1px solid transparent',
              boxShadow: mode === 'register' ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
              fontWeight: 700,
            }}
          >
            Đăng ký
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', textAlign: 'center', fontWeight: '600' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Họ và tên</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email tài khoản</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
              <input
                type="password"
                placeholder={mode === 'register' ? 'Ít nhất 5 ký tự' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                minLength={5}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', marginTop: '1rem', fontSize: '0.95rem' }} disabled={loading}>
            {loading
              ? (mode === 'register' ? 'Đang tạo tài khoản...' : 'Đang xác thực...')
              : (mode === 'register' ? <>Đăng ký <UserPlus size={18} /></> : <>Đăng nhập <ArrowRight size={18} /></>)}
          </button>
        </form>

        {mode === 'register' && (
          <p style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            Tài khoản đăng ký sẽ có quyền nhân viên. Chỉ tài khoản admin mới được cấp quyền IT.
          </p>
        )}
      </div>
    </div>
  );
}

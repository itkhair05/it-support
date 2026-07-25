import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { CreateTicketModal } from './components/CreateTicketModal';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TicketListPage } from './pages/TicketListPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { DepartmentManagementPage } from './pages/DepartmentManagementPage';
import { ProfilePage } from './pages/ProfilePage';
import { AssetManagementPage } from './pages/AssetManagementPage';

function MainLayout() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        Đang tải hệ thống HelpDesk IT...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const pageTitles = {
    dashboard: 'Bảng Điều Khiển IT Support',
    tickets: 'Quản Lý Danh Sách Ticket Yêu Cầu',
    ticket_detail: 'Chi Tiết Ticket & Tiến Độ',
    assets: 'Quản Lý Tài Sản IT Doanh Nghiệp',
    users: 'Quản Lý Tài Khoản Người Dùng',
    departments: 'Quản Lý Phòng Ban & Danh Mục IT',
    profile: 'Hồ Sơ Cá Nhân',
  };

  const handleSelectTicket = (id) => {
    setSelectedTicketId(id);
    setCurrentPage('ticket_detail');
  };

  const handleBackToList = () => {
    setCurrentPage('tickets');
    setSelectedTicketId(null);
  };

  return (
    <NotificationProvider>
      <div className="app-container">
        {/* Sidebar */}
        <Sidebar
          currentPage={currentPage}
          setCurrentPage={(page) => {
            setCurrentPage(page);
            setSelectedTicketId(null);
          }}
          onOpenCreateTicket={() => setIsCreateModalOpen(true)}
        />

        {/* Main Content Area */}
        <div className="main-content">
          <Navbar
            title={pageTitles[currentPage] || 'HelpDesk IT'}
            searchGlobal={globalSearch}
            setSearchGlobal={(val) => {
              setGlobalSearch(val);
              if (currentPage !== 'tickets') {
                setCurrentPage('tickets');
              }
            }}
            onSelectTicket={handleSelectTicket}
          />

          <main className="page-body">
            {currentPage === 'dashboard' && (
              <DashboardPage
                onSelectTicket={handleSelectTicket}
                onOpenCreateTicket={() => setIsCreateModalOpen(true)}
              />
            )}

            {currentPage === 'tickets' && (
              <TicketListPage
                onSelectTicket={handleSelectTicket}
                onOpenCreateTicket={() => setIsCreateModalOpen(true)}
                globalSearch={globalSearch}
              />
            )}

            {currentPage === 'ticket_detail' && (
              <TicketDetailPage
                ticketId={selectedTicketId}
                onBack={handleBackToList}
              />
            )}

            {currentPage === 'assets' && <AssetManagementPage />}

            {currentPage === 'users' && <UserManagementPage />}

            {currentPage === 'departments' && <DepartmentManagementPage />}

            {currentPage === 'profile' && <ProfilePage />}
          </main>
        </div>

        {/* Global Create Ticket Modal */}
        <CreateTicketModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            if (currentPage === 'tickets') {
              window.location.reload();
            } else {
              setCurrentPage('tickets');
            }
          }}
        />
      </div>
    </NotificationProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

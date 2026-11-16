import React, { useState, useEffect } from 'react';
import { AdminDataProvider, useAdmin } from './AdminDataContext';
import { FinanceProvider } from './context/FinanceContext';
import { AdminLogin } from './components/AdminLogin';
import { AdminLayout } from './components/AdminLayout';
import { AdminForgotPassword } from './components/AdminForgotPassword';
import { AdminResetPassword } from './components/AdminResetPassword';
import { AdminAccessGateway } from './components/AdminAccessGateway';
import { ADMIN_CONFIG, getAdminSubpath } from '../config/adminRoutes';

interface AdminAppContentProps {
  onExitAdmin?: () => void;
}

type AuthRoute = 'LOGIN' | 'GATEWAY' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD';

const AdminAppContent: React.FC<AdminAppContentProps> = ({ onExitAdmin }) => {
  const { isAuthenticated, isAuthChecking, setCurrentView } = useAdmin();

  // Determine subroute from window.location
  const getInitialAuthRoute = (): { route: AuthRoute; token?: string } => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token') || '';

      if (path.endsWith('/gateway')) {
        return { route: 'GATEWAY' };
      }
      if (path.endsWith('/forgot-password')) {
        return { route: 'FORGOT_PASSWORD' };
      }
      if (path.endsWith('/reset-password') || token) {
        return { route: 'RESET_PASSWORD', token };
      }
    }
    return { route: 'LOGIN' };
  };

  const [authRouteState, setAuthRouteState] = useState<{ route: AuthRoute; token?: string }>(getInitialAuthRoute);

  // Sync route on popstate
  useEffect(() => {
    const handlePopState = () => {
      setAuthRouteState(getInitialAuthRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update URL to dashboard upon successful authentication
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (path.endsWith('/account/security')) {
        setCurrentView('ACCOUNT_SECURITY');
      } else if (path === ADMIN_CONFIG.ADMIN_PATH || path.endsWith('/login') || path.endsWith('/gateway')) {
        if (window.history.replaceState) {
          window.history.replaceState(null, '', getAdminSubpath('dashboard'));
        }
      }
    }
  }, [isAuthenticated, setCurrentView]);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#0d0d12] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-neutral-400">Verifying session credentials...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authRouteState.route === 'FORGOT_PASSWORD') {
      return (
        <AdminForgotPassword
          onBackToLogin={() => {
            if (typeof window !== 'undefined' && window.history.pushState) {
              window.history.pushState(null, '', getAdminSubpath('login'));
            }
            setAuthRouteState({ route: 'LOGIN' });
          }}
          onNavigateToReset={(token) => {
            if (typeof window !== 'undefined' && window.history.pushState) {
              window.history.pushState(null, '', `${getAdminSubpath('reset-password')}?token=${token}`);
            }
            setAuthRouteState({ route: 'RESET_PASSWORD', token });
          }}
        />
      );
    }

    if (authRouteState.route === 'RESET_PASSWORD') {
      return (
        <AdminResetPassword
          token={authRouteState.token || ''}
          onSuccess={() => {
            if (typeof window !== 'undefined' && window.history.pushState) {
              window.history.pushState(null, '', getAdminSubpath('login'));
            }
            setAuthRouteState({ route: 'LOGIN' });
          }}
          onBackToLogin={() => {
            if (typeof window !== 'undefined' && window.history.pushState) {
              window.history.pushState(null, '', getAdminSubpath('login'));
            }
            setAuthRouteState({ route: 'LOGIN' });
          }}
        />
      );
    }

    if (authRouteState.route === 'GATEWAY') {
      return (
        <AdminAccessGateway
          mode="landing"
          onProceedToLogin={() => {
            if (typeof window !== 'undefined' && window.history.pushState) {
              window.history.pushState(null, '', getAdminSubpath('login'));
            }
            setAuthRouteState({ route: 'LOGIN' });
          }}
          onReturnToStorefront={onExitAdmin}
        />
      );
    }

    return (
      <AdminLogin
        onBackToStore={onExitAdmin}
        onSuccessLogin={() => {
          if (typeof window !== 'undefined' && window.history.pushState) {
            window.history.pushState(null, '', getAdminSubpath('dashboard'));
          }
        }}
        onForgotPassword={() => {
          if (typeof window !== 'undefined' && window.history.pushState) {
            window.history.pushState(null, '', getAdminSubpath('forgot-password'));
          }
          setAuthRouteState({ route: 'FORGOT_PASSWORD' });
        }}
      />
    );
  }

  return <AdminLayout onExitAdmin={onExitAdmin} />;
};

interface AdminAppProps {
  onExitAdmin?: () => void;
}

export const AdminApp: React.FC<AdminAppProps> = ({ onExitAdmin }) => {
  return (
    <AdminDataProvider>
      <FinanceProvider>
        <AdminAppContent onExitAdmin={onExitAdmin} />
      </FinanceProvider>
    </AdminDataProvider>
  );
};

export default AdminApp;

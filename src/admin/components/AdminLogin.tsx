import React, { useState } from 'react';
import { useAdmin } from '../AdminDataContext';
import {
  Shield,
  Smartphone,
  Lock,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { OfficialToriwearLogo } from '../../components/OfficialToriwearLogo';
import { platformApi } from '../services/platformService';
import { ADMIN_CONFIG, getAdminSubpath } from '../../config/adminRoutes';
import { AdminAccessGateway } from './AdminAccessGateway';

interface AdminLoginProps {
  onBackToStore?: () => void;
  onForgotPassword?: () => void;
  onSuccessLogin?: (role?: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onBackToStore, onForgotPassword, onSuccessLogin }) => {
  const { loginWithSession } = useAdmin();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // 2FA Challenge state (only shown if optional TOTP was enabled for this account)
  const [requires2FA, setRequires2FA] = useState(false);
  const [temp2FAToken, setTemp2FAToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await platformApi.login(identifier, password, rememberMe);
      setLoading(false);

      if (!res.success) {
        setErrorMsg(res.error || 'Authentication failed. Please verify credentials.');
        return;
      }

      if (res.requires2FA && res.tempToken) {
        setRequires2FA(true);
        setTemp2FAToken(res.tempToken);
        setTwoFactorCode('');
        return;
      }

      // Complete login in context using authoritative server session
      if (res.user) {
        loginWithSession(res.user);
        if (onSuccessLogin) onSuccessLogin(res.user.role);
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Error communicating with authentication service.');
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode) return;

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await platformApi.verify2FA(temp2FAToken, twoFactorCode, rememberMe);
      setLoading(false);

      if (!res.success) {
        setErrorMsg(res.error || 'Invalid 2FA verification code.');
        return;
      }

      if (res.user) {
        loginWithSession(res.user);
        if (onSuccessLogin) onSuccessLogin(res.user.role);
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Verification error.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d12] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans text-neutral-200">
      {/* Background glow accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-red-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-80 h-80 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Top Header bar */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <button
          type="button"
          onClick={() => setGatewayModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 hover:text-white mb-6 transition-colors cursor-pointer whitespace-nowrap"
          title="Inspect unique VITE_ADMIN_PATH access URL"
        >
          <Shield className="w-3.5 h-3.5 text-red-500" />
          <span className="font-mono font-medium tracking-wider">
            GATEWAY: {ADMIN_CONFIG.ADMIN_PATH}
          </span>
        </button>
        
        <div className="flex items-center justify-center">
          <OfficialToriwearLogo className="h-14 sm:h-16 w-auto max-w-[200px] object-contain" />
        </div>
        <p className="mt-2 text-xs uppercase tracking-widest text-neutral-400 font-medium font-mono">
          Enterprise Business Control Center
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-[#14141c] border border-neutral-800/90 py-8 px-6 sm:px-10 shadow-2xl rounded-2xl">
          {!requires2FA ? (
            /* STEP 1: Email or User ID & Password */
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Admin & Partner Sign In</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Sign in with your User ID or official email and password to access the operations console.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  User ID or Email
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-900/90 border border-neutral-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors placeholder-neutral-500"
                    placeholder="TORI-001 or saif@toriwear.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (onForgotPassword) {
                        onForgotPassword();
                      } else {
                        window.location.assign(getAdminSubpath('forgot-password'));
                      }
                    }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-900/90 border border-neutral-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors placeholder-neutral-500 font-mono pr-10"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <span className="text-xs text-neutral-300">Remember this workstation</span>
                </label>
                <div className="flex items-center gap-1 text-[11px] text-neutral-500 font-mono">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  <span>PBKDF2-SHA512</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="animate-pulse">Verifying Credentials...</span>
                ) : (
                  <>
                    <span>Authenticate Session</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: Two-Factor Authentication (TOTP) */
            <form onSubmit={handle2FASubmit} className="space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-red-600/10 border border-red-500/30 flex items-center justify-center mb-3">
                  <Smartphone className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">Two-Factor Authentication</h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                  Enter the 6-digit TOTP security code from your Authenticator application for <span className="text-white font-mono">{identifier}</span>.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2 text-center">
                  Security Passcode or Recovery Code
                </label>
                <input
                  type="text"
                  maxLength={24}
                  required
                  autoFocus
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/[\s]/g, ''))}
                  className="w-full text-center tracking-[0.2em] font-mono text-xl py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="000000 or RECOVERY-CODE"
                />
                <p className="text-[11px] text-neutral-400 text-center mt-1.5 font-mono">
                  Enter the 6-digit code from Google Authenticator or a saved single-use recovery code
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || twoFactorCode.length < 6}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Verifying Code...' : 'Verify & Enter Console'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRequires2FA(false);
                    setTwoFactorCode('');
                    setErrorMsg('');
                  }}
                  className="text-xs text-neutral-400 hover:text-white cursor-pointer"
                >
                  Back to User ID & password
                </button>
              </div>
            </form>
          )}

          {/* Production-safe login: no demo accounts, preset passwords, or recovery codes are exposed in the client. */}
          <p className="mt-6 pt-5 border-t border-neutral-800/80 text-center text-[11px] text-neutral-500">
            Authorized admin, partner, and staff login with User ID &amp; Password (optional 2FA can be configured post-launch).
          </p>

          {/* Gateway Access URL Link & Customer Storefront Link */}
          <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setGatewayModalOpen(true)}
              className="text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Gateway Access URL
            </button>
            {onBackToStore && (
              <button
                type="button"
                onClick={onBackToStore}
                className="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                ← Return to Storefront
              </button>
            )}
          </div>
        </div>
      </div>

      <AdminAccessGateway
        mode="modal"
        isOpen={gatewayModalOpen}
        onClose={() => setGatewayModalOpen(false)}
        onReturnToStorefront={onBackToStore}
      />
    </div>
  );
};

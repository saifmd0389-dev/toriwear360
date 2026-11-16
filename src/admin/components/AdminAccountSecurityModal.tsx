import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  ShieldCheck,
  Smartphone,
  Clock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  QrCode,
  AlertTriangle,
} from 'lucide-react';
import { platformApi } from '../services/platformService';
import { PlatformUser, ActiveSession, PlatformAuditEntry } from '../../../server/rbacTypes';

interface AdminAccountSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  initialTab?: 'PROFILE' | 'PASSWORD' | '2FA' | 'SESSIONS' | 'HISTORY';
  asCardView?: boolean;
}

export const AdminAccountSecurityModal: React.FC<AdminAccountSecurityModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  initialTab = 'PROFILE',
  asCardView = false,
}) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'PASSWORD' | '2FA' | 'SESSIONS' | 'HISTORY'>(initialTab);
  const [currentUser, setCurrentUser] = useState<PlatformUser | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [securityLogs, setSecurityLogs] = useState<PlatformAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoutOtherSessions, setLogoutOtherSessions] = useState(true);

  // 2FA Setup
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret?: string; manualKey: string; qrUri: string; qrDataUrl?: string } | null>(null);
  const [twoFactorInputCode, setTwoFactorInputCode] = useState('');
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);

  const loadData = async () => {
    try {
      const user = await platformApi.getCurrentUser();
      setCurrentUser(user);
      const sessRes = await platformApi.getSessions();
      setSessions(sessRes.sessions || user.activeSessions || []);
      const logs = await platformApi.getAuditLogs({ limit: 30 });
      setSecurityLogs(logs.filter((l) => l.userId === user.id || l.module === 'auth' || l.module === 'security'));
    } catch (err) {
      console.error('Error loading account security data:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setActiveTab(initialTab);
      setMessage(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const triggerMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      triggerMessage('error', 'New password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      triggerMessage('error', 'New password must contain at least one uppercase letter and one number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      triggerMessage('error', 'New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await platformApi.changePassword(currentPassword, newPassword, logoutOtherSessions);
      setLoading(false);
      if (res.success) {
        triggerMessage('success', 'Password successfully changed and cryptographically hashed.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        await loadData();
      } else {
        triggerMessage('error', res.error || 'Failed to change password.');
      }
    } catch (err: any) {
      setLoading(false);
      triggerMessage('error', err.message || 'Error updating password.');
    }
  };

  const handleStart2FASetup = async () => {
    try {
      const res = await platformApi.setup2FA();
      if (res.success) {
        setTwoFactorSetup(res);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorInputCode || twoFactorInputCode.length !== 6) return;
    try {
      const res = await platformApi.confirm2FA(twoFactorInputCode);
      if (res.success) {
        triggerMessage('success', 'Two-Factor Authentication (TOTP) activated on your account.');
        setTwoFactorSetup(null);
        setTwoFactorInputCode('');
        if (res.recoveryCodes && Array.isArray(res.recoveryCodes) && res.recoveryCodes.length > 0) {
          setNewRecoveryCodes(res.recoveryCodes);
        }
        await loadData();
      } else {
        triggerMessage('error', res.error || 'Failed to verify code.');
      }
    } catch (err: any) {
      triggerMessage('error', err.message || 'Error confirming 2FA.');
    }
  };

  const handleDisable2FA = async () => {
    try {
      const res = await platformApi.disable2FA();
      if (res.success) {
        triggerMessage('success', 'Two-factor authentication disabled.');
        await loadData();
      }
    } catch (err: any) {
      triggerMessage('error', err.message || 'Error disabling 2FA.');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await platformApi.revokeSession(sessionId);
      if (res.success) {
        triggerMessage('success', 'Session revoked.');
        await loadData();
      }
    } catch (err: any) {
      triggerMessage('error', err.message || 'Error revoking session.');
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    try {
      const res = await platformApi.revokeAllOtherSessions();
      if (res.success) {
        triggerMessage('success', 'All other active sessions have been terminated.');
        await loadData();
      }
    } catch (err: any) {
      triggerMessage('error', err.message || 'Error revoking sessions.');
    }
  };

  const cardContent = (
    <div className={`bg-white rounded-3xl ${asCardView ? 'max-w-4xl w-full border border-slate-200 shadow-sm' : 'max-w-3xl w-full border border-slate-200 shadow-2xl max-h-[92vh]'} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
            {currentUser?.name.charAt(0) || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{currentUser?.name}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-red-100 text-red-800 border border-red-200">
                {currentUser?.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">{currentUser?.email} · {currentUser?.employeeId}</p>
          </div>
        </div>

        {!asCardView && (
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

        {/* Feedback Alert */}
        {message && (
          <div className={`p-3 text-xs flex items-center gap-2 font-medium ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-red-50 text-red-800 border-b border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-2 border-b border-slate-200 bg-white text-xs overflow-x-auto">
          {[
            { id: 'PROFILE', label: 'My Profile', icon: User },
            { id: 'PASSWORD', label: 'Change Password', icon: Lock },
            { id: '2FA', label: 'Two-Factor TOTP', icon: ShieldCheck },
            { id: 'SESSIONS', label: 'Active Sessions', icon: Smartphone },
            { id: 'HISTORY', label: 'Security History', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isSelected ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* TAB 1: PROFILE */}
          {activeTab === 'PROFILE' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Personal Information & Account Roles</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Unique Internal User ID</span>
                  <span className="font-mono text-slate-900 font-bold">{currentUser?.id}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Employee / Staff ID</span>
                  <span className="font-mono text-slate-900 font-bold">{currentUser?.employeeId || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                  <span className="font-semibold text-slate-900">{currentUser?.department || 'Executive Leadership'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Designation</span>
                  <span className="font-semibold text-slate-900">{currentUser?.designation || 'Partner'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Account Status</span>
                  <span className="font-bold text-emerald-600">{currentUser?.accountStatus || 'ACTIVE'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Last Password Change</span>
                  <span className="font-mono text-slate-600">{currentUser?.lastPasswordChange ? new Date(currentUser.lastPasswordChange).toLocaleDateString('en-IN') : 'Default Seed'}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHANGE PASSWORD */}
          {activeTab === 'PASSWORD' && (
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Change Account Password</h3>
                <p className="text-slate-500 text-[11px]">
                  All passwords are cryptographically salted and hashed using PBKDF2 with SHA-512.
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Current Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 pr-10"
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Confirm New Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Confirm new password"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={logoutOtherSessions}
                  onChange={(e) => setLogoutOtherSessions(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <span className="text-slate-700 font-medium">Log out all other active workstations and mobile sessions</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Re-hashing & Updating...' : 'Update Password'}
              </button>
            </form>
          )}

          {/* TAB 3: TWO-FACTOR AUTHENTICATION */}
          {activeTab === '2FA' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Two-Factor Authentication (TOTP)</h3>
                  <p className="text-slate-500 text-[11px]">
                    Protects your account with an Authenticator app (Google Authenticator, Microsoft Authenticator, 1Password).
                  </p>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  currentUser?.twoFactorEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {currentUser?.twoFactorEnabled ? 'ACTIVE (ENABLED)' : 'OFF (OPTIONAL)'}
                </span>
              </div>

              {twoFactorSetup ? (
                <form onSubmit={handleConfirm2FA} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 max-w-md">
                  <div>
                    <span className="font-bold text-slate-900 block mb-1">
                      {currentUser?.twoFactorEnabled ? '1. Scan New QR Code to Re-enroll' : '1. Scan QR Code with Authenticator App'}
                    </span>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Use Google Authenticator, Microsoft Authenticator, Authy, or 1Password to scan this barcode:
                    </p>
                    {twoFactorSetup.qrDataUrl ? (
                      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200 mb-2 shadow-xs">
                        <img
                          src={twoFactorSetup.qrDataUrl}
                          alt="Scan with Authenticator App"
                          className="w-48 h-48 object-contain"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 font-mono">RFC 6238 · SHA-1 · 6 Digits · 30s</span>
                      </div>
                    ) : null}
                    <span className="text-[11px] font-semibold text-slate-700 block mb-1">Or enter key manually:</span>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-mono text-center text-slate-900 tracking-widest font-bold text-xs select-all">
                      {twoFactorSetup.manualKey}
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      2. Enter 6-digit code from Authenticator App:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={twoFactorInputCode}
                      onChange={(e) => setTwoFactorInputCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[0.3em] font-mono text-xl py-2 rounded-xl border border-slate-300 bg-white"
                      placeholder="000000"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shadow-sm text-xs"
                    >
                      Verify & Activate 2FA
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFactorSetup(null);
                        setTwoFactorInputCode('');
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 cursor-pointer text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : currentUser?.twoFactorEnabled ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>Your Account is Protected with Two-Factor Authentication</span>
                  </div>
                  <p className="text-emerald-800 text-[11px] leading-relaxed">
                    A 6-digit TOTP token is verified on every login. Google Authenticator and standard RFC 6238 apps are fully supported.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleStart2FASetup}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Re-enroll Authenticator App</span>
                    </button>
                    <button
                      onClick={handleDisable2FA}
                      className="px-3 py-1.5 rounded-xl bg-white border border-red-300 text-red-700 font-semibold text-xs hover:bg-red-50 cursor-pointer"
                    >
                      Disable 2FA
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                    Google Authenticator (2FA) is currently <strong>optional</strong>. Your account uses User ID / Email &amp; Password to sign in. You can enable 2-step verification here anytime after launch.
                  </div>
                  <button
                    onClick={handleStart2FASetup}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm flex items-center gap-2 cursor-pointer text-xs"
                  >
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    <span>Enable Authenticator App (Optional)</span>
                  </button>
                </div>
              )}

                  {newRecoveryCodes && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 max-w-md">
                      <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Save Your Backup Recovery Codes Now</span>
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed">
                        These recovery codes are shown only ONCE. If you lose your phone or authenticator app, each code can be used exactly once to sign in.
                      </p>
                      <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-xl border border-amber-200 font-mono text-center font-bold text-xs tracking-wider text-slate-900">
                        {newRecoveryCodes.map((c, idx) => (
                          <div key={idx} className="p-1.5 bg-slate-50 rounded border border-slate-100 select-all">
                            {c}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewRecoveryCodes(null)}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                      >
                        I have securely saved these backup codes
                      </button>
                    </div>
                  )}
            </div>
          )}

          {/* TAB 4: ACTIVE SESSIONS */}
          {activeTab === 'SESSIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Active Workstations & Devices</h3>
                  <p className="text-slate-500 text-[11px]">
                    Manage signed-in browsers, terminals, and mobile devices.
                  </p>
                </div>

                <button
                  onClick={handleRevokeAllOtherSessions}
                  className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold cursor-pointer"
                >
                  Log Out All Other Sessions
                </button>
              </div>

              <div className="space-y-2">
                {sessions.map((sess, idx) => (
                  <div key={sess.sessionId || idx} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <span>{sess.device}</span>
                          {sess.isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              CURRENT SESSION
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          IP: {sess.ipAddress} · {sess.location}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Login: {sess.loginTime} · Last active: {sess.lastActivity}
                        </div>
                      </div>
                    </div>

                    {!sess.isCurrent && (
                      <button
                        onClick={() => handleRevokeSession(sess.sessionId)}
                        className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium cursor-pointer"
                      >
                        Terminate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY AUDIT HISTORY */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Account Security & Login Audit History</h3>
              
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {securityLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-2 text-[11px]">
                    <div>
                      <div className="font-semibold text-slate-800">{log.action}</div>
                      <div className="text-slate-500">{log.newValue || log.recordAffected}</div>
                    </div>
                    <div className="text-right text-slate-400 font-mono shrink-0">
                      <div>{log.ipAddress}</div>
                      <div>{new Date(log.timestamp).toLocaleTimeString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out of Session</span>
          </button>

          {!asCardView && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer text-xs"
            >
              Close
            </button>
          )}
        </div>
      </div>
  );

  if (asCardView) {
    return (
      <div className="w-full max-w-4xl mx-auto py-2">
        {cardContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {cardContent}
    </div>
  );
};

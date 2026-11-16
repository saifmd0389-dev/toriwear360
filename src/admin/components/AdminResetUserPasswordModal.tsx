import React, { useState } from 'react';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { platformApi } from '../services/platformService';
import { PlatformUser } from '../../../server/rbacTypes';

interface AdminResetUserPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: PlatformUser | null;
  onSuccess?: () => void;
}

export const AdminResetUserPasswordModal: React.FC<AdminResetUserPasswordModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requireChangeOnNextLogin, setRequireChangeOnNextLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    password: string;
    message: string;
    copied: boolean;
  } | null>(null);

  // Recovery codes reissue state
  const [reissuingCodes, setReissuingCodes] = useState(false);
  const [freshRecoveryCodes, setFreshRecoveryCodes] = useState<string[] | null>(null);
  const [codesCopied, setCodesCopied] = useState(false);

  if (!isOpen || !targetUser) return null;

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let res = 'Tori@';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    res += '2026!';
    setNewPassword(res);
    setErrorMsg(null);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await platformApi.adminSetPassword(
        targetUser.id,
        newPassword,
        requireChangeOnNextLogin
      );

      setLoading(false);
      if (res.success) {
        setSuccessResult({
          password: newPassword,
          message: res.message || `Password for ${targetUser.name} updated successfully.`,
          copied: false,
        });
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || 'Failed to update password.');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Error updating password.');
    }
  };

  const handleCopyCredentials = () => {
    if (!successResult) return;
    const text = `TORIWEAR Executive Portal Credentials\nName: ${targetUser.name}\nEmail: ${targetUser.email}\nEmployee ID: ${targetUser.employeeId || 'N/A'}\nPassword: ${successResult.password}\nPortal: ${window.location.origin}/admin`;
    navigator.clipboard.writeText(text);
    setSuccessResult({ ...successResult, copied: true });
    setTimeout(() => {
      setSuccessResult((prev) => (prev ? { ...prev, copied: false } : null));
    }, 3000);
  };

  const handleReissueCodes = async () => {
    setReissuingCodes(true);
    setErrorMsg(null);
    try {
      const res = await platformApi.adminReissueRecoveryCodes(targetUser.id);
      setReissuingCodes(false);
      if (res.success && res.recoveryCodes) {
        setFreshRecoveryCodes(res.recoveryCodes);
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || 'Failed to reissue recovery codes.');
      }
    } catch (err: any) {
      setReissuingCodes(false);
      setErrorMsg(err.message || 'Error reissuing recovery codes.');
    }
  };

  const handleCopyAllCodes = () => {
    if (!freshRecoveryCodes) return;
    const text = `TORIWEAR 2FA Emergency Backup Codes for ${targetUser.name} (${targetUser.email}):\n` +
      freshRecoveryCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      '\n\nNote: Each recovery code works exactly once. Keep them stored safely.';
    navigator.clipboard.writeText(text);
    setCodesCopied(true);
    setTimeout(() => setCodesCopied(false), 3000);
  };

  const handleClose = () => {
    setNewPassword('');
    setErrorMsg(null);
    setSuccessResult(null);
    setFreshRecoveryCodes(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Account Credentials & Access</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-100 text-red-800 border border-red-200">
                  {targetUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                {targetUser.name} · {targetUser.email}
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success State */}
          {successResult ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{successResult.message}</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                The new password is active immediately across the enterprise database. All prior sessions for this user have been terminated.
              </p>

              <div className="p-3 bg-white rounded-xl border border-emerald-200 font-mono text-xs text-slate-900 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Account Credentials:</div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-bold">{targetUser.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Password:</span>
                  <span className="font-bold text-red-600">{successResult.password}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{successResult.copied ? 'Copied to Clipboard!' : 'Copy Credentials to Share'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSuccessResult(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Set New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter or generate new password"
                    className="w-full pl-9 pr-20 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-mono focus:bg-white focus:outline-none focus:border-red-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Generate Strong Password</span>
                </button>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={requireChangeOnNextLogin}
                    onChange={(e) => setRequireChangeOnNextLogin(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <span>Require change on first login</span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !newPassword}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{loading ? 'Updating Password...' : 'Save & Overwrite Password'}</span>
                </button>
              </div>
            </form>
          )}

          {/* 2FA Emergency Backup Codes Management */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Emergency 2FA Recovery Codes</span>
                <span className="text-[11px] text-slate-500">
                  If the partner loses their phone or cannot receive codes, reissue fresh single-use recovery codes.
                </span>
              </div>
              <button
                type="button"
                onClick={handleReissueCodes}
                disabled={reissuingCodes}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${reissuingCodes ? 'animate-spin' : ''}`} />
                <span>{reissuingCodes ? 'Generating...' : 'Reissue 5 Fresh Codes'}</span>
              </button>
            </div>

            {freshRecoveryCodes && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 text-[11px] uppercase tracking-wider">
                    5 New Single-Use Recovery Codes Active:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAllCodes}
                    className="text-[11px] text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{codesCopied ? 'Copied!' : 'Copy All'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {freshRecoveryCodes.map((code, idx) => (
                    <div 
                      key={idx} 
                      className="p-1.5 bg-white rounded border border-amber-200 font-mono text-center font-bold text-[11px] text-slate-900 select-all"
                    >
                      {code}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-amber-800 leading-tight">
                  Hand these codes to {targetUser.name}. Each code works exactly once in place of the 6-digit TOTP.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

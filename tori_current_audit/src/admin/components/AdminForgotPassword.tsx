import React, { useState } from 'react';
import { OfficialToriwearLogo } from '../../components/OfficialToriwearLogo';
import { ArrowLeft, Mail, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { platformApi } from '../services/platformService';
import { getAdminSubpath } from '../../config/adminRoutes';

interface AdminForgotPasswordProps {
  onBackToLogin: () => void;
  onNavigateToReset?: (token: string) => void;
}

export const AdminForgotPassword: React.FC<AdminForgotPasswordProps> = ({ onBackToLogin, onNavigateToReset }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await platformApi.forgotPassword(email);
      setLoading(false);
      if (res.success) {
        setSubmitted(true);
        const link = res.devResetLink || res.resetLink;
        if (res.token) {
          setIssuedToken(res.token);
        } else if (typeof link === 'string' && link.includes('token=')) {
          const parsedToken = new URLSearchParams(link.split('?')[1] || '').get('token');
          if (parsedToken) setIssuedToken(parsedToken);
        }
      } else {
        setErrorMsg(res.error || 'Unable to process reset request.');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Network error.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d12] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans text-neutral-200">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-red-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 mb-6">
          <Shield className="w-3.5 h-3.5 text-red-500" />
          <span className="font-mono">SECURITY CREDENTIAL RECOVERY</span>
        </div>

        <div className="flex items-center justify-center">
          <OfficialToriwearLogo className="h-14 sm:h-16 w-auto max-w-[200px] object-contain" />
        </div>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-white">Reset Account Password</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Enter your registered enterprise email address to receive a secure single-use recovery link.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-[#14141c] border border-neutral-800 py-8 px-6 sm:px-10 shadow-2xl rounded-2xl space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Registered Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="partner@toriwear.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Issuing Cryptographic Link...' : 'Send Password Reset Link'}
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Link Issued</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  A single-use cryptographically signed reset token has been issued for <strong className="text-white">{email}</strong>. It will automatically expire in 1 hour.
                </p>
              </div>

              {issuedToken && (
                <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl text-left text-xs space-y-2">
                  <div className="text-[11px] text-neutral-400 uppercase font-mono tracking-wider">
                    Direct Reset Link (Demonstration Mode):
                  </div>
                  <button
                    onClick={() => onNavigateToReset ? onNavigateToReset(issuedToken) : window.location.assign(`${getAdminSubpath('reset-password')}?token=${issuedToken}`)}
                    className="w-full text-left py-2 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 font-mono text-[11px] break-all border border-red-500/40 cursor-pointer"
                  >
                    Click to Open Reset Form: {getAdminSubpath('reset-password')}?token={issuedToken.slice(0, 16)}...
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-neutral-800 flex justify-center">
            <button
              onClick={onBackToLogin}
              className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin Login</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

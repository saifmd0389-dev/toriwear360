import React, { useState } from 'react';
import { OfficialToriwearLogo } from '../../components/OfficialToriwearLogo';
import { platformApi } from '../services/platformService';
import { AlertCircle, CheckCircle2, Shield } from 'lucide-react';

export const AdminActivateAccount: React.FC<{ token: string; onSuccess: () => void }> = ({ token, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) { setError('Use at least 10 characters, including an uppercase letter, a number and a special character.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try { const result = await platformApi.activateAccount(token, password); if (!result.success) throw new Error(result.error || 'Activation failed.'); setDone(true); setTimeout(onSuccess, 1800); }
    catch (err: any) { setError(err.message || 'Activation failed. Request a new invitation.'); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-[#0d0d12] flex flex-col justify-center items-center p-5 text-neutral-200">
    <div className="text-center mb-6"><OfficialToriwearLogo className="h-14 w-auto mx-auto"/><div className="mt-5 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-400"><Shield className="w-3.5 h-3.5 text-red-500"/> SECURE ACCOUNT ACTIVATION</div><h1 className="mt-4 text-xl font-bold text-white">Set your account password</h1><p className="mt-1 text-xs text-neutral-400">Create a strong password to activate your Tori-Wear staff account.</p></div>
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-neutral-800 bg-[#14141c] p-6 space-y-4">
      {error && <div className="flex gap-2 rounded-lg border border-red-900 bg-red-950/30 p-3 text-xs text-red-300"><AlertCircle className="w-4 h-4 shrink-0"/>{error}</div>}
      {done ? <div className="text-center py-5"><CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto"/><p className="mt-3 text-white font-semibold">Account activated</p><p className="text-xs text-neutral-400 mt-1">Redirecting to secure login…</p></div> : <>
        <label className="block text-xs text-neutral-300">New password<input required type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm text-white"/></label>
        <label className="block text-xs text-neutral-300">Confirm password<input required type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm text-white"/></label>
        <p className="text-[11px] text-neutral-500">Minimum 10 characters, uppercase, number and special character. Invitation links expire after 48 hours and can only be used once.</p>
        <button disabled={busy || !token} className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Activating…' : 'Activate account'}</button>
      </>}
    </form>
  </div>;
};

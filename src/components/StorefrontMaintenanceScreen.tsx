import React, { useState } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  Clock,
  Flame,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { OfficialToriwearLogo } from './OfficialToriwearLogo';
import { InstagramIcon, WhatsAppIcon, XTwitterIcon } from './SocialIcons';
import { getAuthoritativeInstagramUrl } from '../utils/socialLinks';

interface StorefrontMaintenanceScreenProps {
  onEnterAdmin?: () => void;
  onBypassForStaff?: () => void;
  isStaffUser?: boolean;
}

export const StorefrontMaintenanceScreen: React.FC<StorefrontMaintenanceScreenProps> = ({
  onEnterAdmin,
  onBypassForStaff,
  isStaffUser = false,
}) => {
  const [notifyContact, setNotifyContact] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(() => {
    try {
      return Boolean(localStorage.getItem('tori_maintenance_notified'));
    } catch {
      return false;
    }
  });

  const handleNotifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyContact.trim()) return;
    try {
      localStorage.setItem('tori_maintenance_notified', notifyContact.trim());
    } catch {}
    setIsSubscribed(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#07070b] text-white flex flex-col justify-between selection:bg-red-600 selection:text-white relative overflow-hidden font-sans">
      {/* Background Cyberpunk Ambient Glow Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-red-950/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#262635_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      {/* Staff Floating Admin Bypass Banner (Visible only if already authenticated as Admin/Owner) */}
      {isStaffUser && (
        <div className="relative z-30 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 backdrop-blur-md">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-bold">ADMIN PREVIEW:</span>
              <span>Maintenance Mode is ON. Public customers see this "Dropping Soon" screen.</span>
            </div>
            <div className="flex items-center gap-2">
              {onBypassForStaff && (
                <button
                  onClick={onBypassForStaff}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Storefront As Staff</span>
                </button>
              )}
              {onEnterAdmin && (
                <button
                  onClick={onEnterAdmin}
                  className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Open Admin Console</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-5 flex items-center justify-between border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <OfficialToriwearLogo className="h-8 sm:h-9 w-auto max-w-[130px] object-contain" />
          <span className="text-neutral-600">|</span>
          <span className="text-[10px] sm:text-xs font-mono text-neutral-400 tracking-widest uppercase">
            Official Brand Portal
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/60 border border-red-500/30 text-[11px] font-mono text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-bold">VAULT LOCKED</span>
          </div>
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 text-center max-w-3xl mx-auto">
        {/* Animated Emblem Badge */}
        <div className="relative mb-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-neutral-900/90 border border-red-500/30 shadow-[0_0_40px_rgba(255,32,40,0.25)] flex items-center justify-center p-3 animate-in zoom-in-95 duration-500">
            <OfficialToriwearLogo className="w-full h-full object-contain" />
          </div>
          <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-mono font-bold uppercase tracking-wider shadow-lg">
            CALIBRATING
          </div>
        </div>

        {/* Status Chip */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-neutral-300 mb-4 tracking-wider uppercase">
          <Clock className="w-3.5 h-3.5 text-red-500" />
          <span>Dropping Soon / Upgrades in Progress</span>
        </div>

        {/* Primary Headline */}
        <h1 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight uppercase leading-none text-white drop-shadow-md">
          WE ARE PREPARING <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-red-600">
            THE NEXT ANIME DROP
          </span>
        </h1>

        {/* Description Copy */}
        <p className="mt-4 sm:mt-5 text-sm sm:text-base text-neutral-400 max-w-xl leading-relaxed">
          Our online vault is temporarily offline while we calibrate brand-new <strong className="text-white">240 GSM heavyweight combed cotton</strong> streetwear drops, character universes, and warehouse upgrades.
        </p>

        {/* Priority Drop Alert Box */}
        <div className="mt-8 w-full max-w-md bg-[#111118]/80 border border-neutral-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-mono mb-3">
            <span className="text-neutral-300 font-bold flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-500" />
              <span>GET PRIORITY ACCESS</span>
            </span>
            <span className="text-[10px] text-red-400 font-bold">100₹ COUPON INCLUDED</span>
          </div>

          {isSubscribed ? (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>You're on the priority drop alert list. We will notify you the moment the vault unlocks!</span>
            </div>
          ) : (
            <form onSubmit={handleNotifySubmit} className="space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter email or WhatsApp number"
                  value={notifyContact}
                  onChange={(e) => setNotifyContact(e.target.value)}
                  className="flex-1 bg-black/60 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono transition"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-mono font-bold uppercase rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0 shadow-lg shadow-red-600/30"
                >
                  <span>NOTIFY ME</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-neutral-500 font-mono text-left">
                No spam. Instant drop alarm only when the vault goes public.
              </p>
            </form>
          )}
        </div>

        {/* Feature Capsules */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg text-left">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] font-mono text-red-400 font-bold uppercase">FABRIC STANDARD</div>
            <div className="text-xs font-semibold text-neutral-200 mt-0.5">240 GSM Combed Cotton</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] font-mono text-amber-400 font-bold uppercase">NEXT DROP</div>
            <div className="text-xs font-semibold text-neutral-200 mt-0.5">Void Walker & Neon Ronin</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-mono text-sky-400 font-bold uppercase">KIDS CAPSULE</div>
            <div className="text-xs font-semibold text-neutral-200 mt-0.5">Bio-Wash Twinning Sets</div>
          </div>
        </div>
      </main>

      {/* Footer / Social Channels / Admin Portal Trigger */}
      <footer className="relative z-20 w-full px-4 sm:px-8 py-5 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-neutral-500">
        <div className="flex items-center gap-4">
          <span>© {new Date().getFullYear()} TORIWEAR CLOTHING LTD.</span>
          <span className="hidden sm:inline text-neutral-700">·</span>
          <span className="hidden sm:inline text-neutral-400">All IP & Character Lore Reserved</span>
        </div>

        {/* Social Links */}
        <div className="flex items-center gap-3">
          <a
            href={getAuthoritativeInstagramUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white hover:border-red-500 transition"
            aria-label="Instagram"
          >
            <InstagramIcon className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://wa.me/919876543210?text=Hi%20TORIWEAR%20Support"
            target="_blank"
            rel="noreferrer"
            className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-[#25D366] hover:border-[#25D366] transition"
            aria-label="WhatsApp"
          >
            <WhatsAppIcon className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://twitter.com/toriwear"
            target="_blank"
            rel="noreferrer"
            className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white hover:border-red-500 transition"
            aria-label="Twitter"
          >
            <XTwitterIcon className="w-3.5 h-3.5" />
          </a>
        </div>
      </footer>
    </div>
  );
};

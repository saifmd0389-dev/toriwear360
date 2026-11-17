import React, { useState } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  Clock,
  Flame,
  ShieldCheck,
  Eye,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { OfficialToriwearLogo } from './OfficialToriwearLogo';
import { InstagramIcon, WhatsAppIcon, XTwitterIcon } from './SocialIcons';
import { getAuthoritativeInstagramUrl } from '../utils/socialLinks';
import { apiClient } from '../services/apiClient';

interface StorefrontMaintenanceScreenProps {
  onEnterAdmin?: () => void;
  onBypassForStaff?: () => void;
  isStaffUser?: boolean;
}

const COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'US / CA (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+61', label: 'Australia (+61)' },
];

export const StorefrontMaintenanceScreen: React.FC<StorefrontMaintenanceScreenProps> = ({
  onEnterAdmin,
  onBypassForStaff,
  isStaffUser = false,
}) => {
  const [channel, setChannel] = useState<'EMAIL' | 'WHATSAPP' | 'BOTH'>('EMAIL');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [whatsappDigits, setWhatsappDigits] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isServiceUnavailable, setIsServiceUnavailable] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<{
    message: string;
    duplicate?: boolean;
    couponCode?: string | null;
    emailMask?: string | null;
    whatsappMask?: string | null;
  } | null>(null);

  const buildE164Phone = (): string | undefined => {
    const raw = whatsappDigits.trim().replace(/[\s\-()]+/g, '');
    if (!raw) return undefined;
    if (raw.startsWith('+')) return raw;
    return `${countryCode}${raw.replace(/^0+/, '')}`;
  };

  const submitRegistration = async () => {
    setErrorMsg(null);
    setIsServiceUnavailable(false);

    const trimmedEmail = email.trim().toLowerCase();
    const fullPhone = buildE164Phone();

    if ((channel === 'EMAIL' || channel === 'BOTH') && !trimmedEmail) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if ((channel === 'EMAIL' || channel === 'BOTH') && !emailConsent) {
      setErrorMsg('Please check the email notification consent box to receive email drop alerts.');
      return;
    }
    if ((channel === 'WHATSAPP' || channel === 'BOTH') && !fullPhone) {
      setErrorMsg('Please enter your WhatsApp phone number with country code.');
      return;
    }
    if ((channel === 'WHATSAPP' || channel === 'BOTH') && !whatsappConsent) {
      setErrorMsg('Please check the WhatsApp opt-in consent box to receive WhatsApp drop alerts.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.registerEarlyAccess({
        email: channel === 'EMAIL' || channel === 'BOTH' ? trimmedEmail : undefined,
        whatsappNumber: channel === 'WHATSAPP' || channel === 'BOTH' ? fullPhone : undefined,
        channel,
        emailConsent: channel === 'EMAIL' || channel === 'BOTH' ? emailConsent : false,
        whatsappConsent: channel === 'WHATSAPP' || channel === 'BOTH' ? whatsappConsent : false,
        registrationSource: 'MAINTENANCE_SCREEN',
      });

      if (!res.success) {
        if (res.statusCode === 503 || res.code === 'DATABASE_UNAVAILABLE' || res.code === 'NETWORK_ERROR') {
          setIsServiceUnavailable(true);
        }
        setErrorMsg(
          res.error || 'Registration could not be saved right now. Please try again shortly.'
        );
        return;
      }

      setRegistrationResult({
        message:
          res.message ||
          'You’re on the priority drop alert list. We will notify you the moment the vault unlocks!',
        duplicate: Boolean(res.duplicate),
        couponCode: res.coupon?.active && res.coupon?.eligible ? res.coupon.code : null,
        emailMask: res.subscriber?.emailMask || null,
        whatsappMask: res.subscriber?.whatsappMask || null,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNotifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitRegistration();
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
            <span className="text-[10px] text-red-400 font-bold">LAUNCH ALERTS</span>
          </div>

          {registrationResult ? (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono text-left space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span className="font-bold text-white">{registrationResult.message}</span>
              </div>
              {(registrationResult.emailMask || registrationResult.whatsappMask) && (
                <div className="text-[11px] text-emerald-200/80 pl-6 space-y-0.5">
                  {registrationResult.emailMask && <div>Email: {registrationResult.emailMask}</div>}
                  {registrationResult.whatsappMask && <div>WhatsApp: {registrationResult.whatsappMask}</div>}
                </div>
              )}
              {registrationResult.couponCode && (
                <div className="mt-2 pt-2 border-t border-emerald-500/20 pl-6 text-[11px] text-neutral-200">
                  Eligible launch code: <strong className="text-red-400 tracking-wider">{registrationResult.couponCode}</strong> (subject to checkout eligibility rules).
                </div>
              )}
              <div className="pl-6 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationResult(null);
                    setErrorMsg(null);
                  }}
                  className="text-[10px] underline text-neutral-400 hover:text-white cursor-pointer"
                >
                  Update contact or add another channel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleNotifySubmit} className="space-y-3 text-left">
              {/* Channel selector */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/60 border border-neutral-800 text-[11px] font-mono">
                {(['EMAIL', 'WHATSAPP', 'BOTH'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setChannel(opt);
                      setErrorMsg(null);
                    }}
                    className={`py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      channel === opt
                        ? 'bg-red-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {opt === 'EMAIL' ? 'Email' : opt === 'WHATSAPP' ? 'WhatsApp' : 'Both'}
                  </button>
                ))}
              </div>

              {(channel === 'EMAIL' || channel === 'BOTH') && (
                <div className="space-y-1.5">
                  <input
                    type="email"
                    placeholder="Enter email address (e.g. you@domain.com)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-black/60 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono transition disabled:opacity-60"
                    required
                  />
                  <label className="flex items-start gap-2 text-[11px] text-neutral-400 font-mono cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={emailConsent}
                      onChange={(e) => setEmailConsent(e.target.checked)}
                      disabled={isSubmitting}
                      className="mt-0.5 accent-red-600 cursor-pointer"
                    />
                    <span>I agree to receive launch notifications & priority drop alerts by Email.</span>
                  </label>
                </div>
              )}

              {(channel === 'WHATSAPP' || channel === 'BOTH') && (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <select
                      aria-label="Country Code"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      disabled={isSubmitting}
                      className="bg-black/60 border border-neutral-700 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500 font-mono cursor-pointer"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      placeholder="WhatsApp number (e.g. 9876543210)"
                      value={whatsappDigits}
                      onChange={(e) => setWhatsappDigits(e.target.value)}
                      disabled={isSubmitting}
                      className="flex-1 bg-black/60 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono transition disabled:opacity-60"
                      required
                    />
                  </div>
                  <label className="flex items-start gap-2 text-[11px] text-neutral-400 font-mono cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={whatsappConsent}
                      onChange={(e) => setWhatsappConsent(e.target.checked)}
                      disabled={isSubmitting}
                      className="mt-0.5 accent-red-600 cursor-pointer"
                    />
                    <span>I opt in to receive WhatsApp launch alerts from TORIWEAR (reply STOP anytime).</span>
                  </label>
                </div>
              )}

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-[11px] font-mono flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                    <span>{errorMsg}</span>
                  </div>
                  {isServiceUnavailable && (
                    <button
                      type="button"
                      onClick={() => void submitRegistration()}
                      disabled={isSubmitting}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-mono font-bold uppercase rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-lg shadow-red-600/30 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <span>{isSubmitting ? 'REGISTERING...' : 'NOTIFY ME'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <p className="text-[10px] text-neutral-500 font-mono text-left">
                No spam. Unsubscribe anytime via the link in every message.
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

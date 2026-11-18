import React, { useEffect, useState } from 'react';
import { X, Mail, Phone, MapPin, Clock, ShieldCheck, Globe, ArrowUpRight, RotateCcw } from 'lucide-react';
import { StoreContactConfig, ContactChannelItem } from '../types';
import { apiClient } from '../services/apiClient';
import {
  InstagramIcon,
  WhatsAppIcon,
  FacebookIcon,
  XTwitterIcon,
  YouTubeIcon,
  DiscordIcon,
} from './SocialIcons';

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function renderSocialChannelIcon(platform: string, className = 'w-4 h-4') {
  const p = (platform || '').toLowerCase();
  if (p.includes('insta')) return <InstagramIcon className={className} />;
  if (p.includes('whatsapp') || p === 'wa') return <WhatsAppIcon className={className} />;
  if (p.includes('facebook') || p === 'fb') return <FacebookIcon className={className} />;
  if (p.includes('twitter') || p === 'x' || p.includes('x /')) return <XTwitterIcon className={className} />;
  if (p.includes('youtube') || p === 'yt') return <YouTubeIcon className={className} />;
  if (p.includes('discord')) return <DiscordIcon className={className} />;
  return <Globe className={className} />;
}

export function buildWhatsAppHref(contact?: StoreContactConfig | null): string | null {
  if (!contact) return null;
  const waChannel = (contact.channels || []).find(
    (c) => c.enabled && (c.platform || '').toLowerCase().includes('whatsapp') && c.url?.trim()
  );
  const msg = encodeURIComponent(contact.whatsappMessage || 'Hi TORIWEAR Concierge! I need quick assistance.');
  const digits = (contact.whatsappNumber || contact.phone || '').replace(/\D/g, '');
  if (digits.length >= 10) {
    const normalized = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${normalized}?text=${msg}`;
  }
  if (waChannel?.url) {
    return waChannel.url;
  }
  return null;
}

export const ContactSupportModal: React.FC<ContactSupportModalProps> = ({ isOpen, onClose }) => {
  const [contact, setContact] = useState<StoreContactConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadContact = () => {
    setIsLoading(true);
    apiClient
      .getStoreContact()
      .then((res) => {
        if (res.success && res.data) {
          setContact(res.data);
        }
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    loadContact();
  }, [isOpen]);

  useEffect(() => {
    const handleSync = () => loadContact();
    window.addEventListener('tori_contact_updated', handleSync);
    return () => window.removeEventListener('tori_contact_updated', handleSync);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const waHref = buildWhatsAppHref(contact);
  const enabledChannels: ContactChannelItem[] = (contact?.channels || [])
    .filter((c) => c.enabled !== false && Boolean(c.url?.trim()))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  return (
    <div
      style={{ zIndex: 9999 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-[#0e0f15] border border-neutral-800 shadow-2xl overflow-hidden text-white animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#14151e] border-b border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#FF2028]">
              TORI-WEAR CONCIERGE
            </span>
            <h2 id="contact-modal-title" className="font-heading text-2xl font-black uppercase tracking-tight">
              CONTACT &amp; SUPPORT
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Contact Modal"
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {isLoading && !contact ? (
            <div className="py-10 text-center text-xs font-mono text-neutral-400">
              Loading official store contact details...
            </div>
          ) : (
            <>
              {/* Direct WhatsApp CTA */}
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full p-4 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-[#25D366]/50 flex items-center justify-between gap-3 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#25D366] text-black flex items-center justify-center shrink-0">
                      <WhatsAppIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-heading text-sm font-black uppercase tracking-wide text-white">
                        CHAT ON WHATSAPP
                      </div>
                      <div className="text-[11px] font-mono text-emerald-300">
                        Instant order help, sizing advice &amp; return queries
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#25D366] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              )}

              {/* Core Support Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                {contact?.supportEmail && (
                  <a
                    href={`mailto:${contact.supportEmail}`}
                    className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 hover:border-[#FF2028]/60 transition flex items-start gap-2.5"
                  >
                    <Mail className="w-4 h-4 text-[#FF2028] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-neutral-400 uppercase">Support Email</div>
                      <div className="text-white font-semibold truncate mt-0.5">{contact.supportEmail}</div>
                    </div>
                  </a>
                )}

                {contact?.phone && (
                  <a
                    href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                    className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 hover:border-emerald-500/60 transition flex items-start gap-2.5"
                  >
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-neutral-400 uppercase">Phone Helpline</div>
                      <div className="text-white font-semibold truncate mt-0.5">{contact.phone}</div>
                    </div>
                  </a>
                )}

                {contact?.operatingHours && (
                  <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-neutral-400 uppercase">Support Hours</div>
                      <div className="text-neutral-200 mt-0.5">{contact.operatingHours}</div>
                    </div>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 flex items-start gap-2.5">
                  <RotateCcw className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] text-neutral-400 uppercase">Return Policy</div>
                    <div className="text-neutral-200 mt-0.5">
                      {contact?.returnWindowDays || 7}-Day Hassle-Free Returns &amp; Exchanges
                    </div>
                  </div>
                </div>
              </div>

              {contact?.businessAddress && (
                <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-start gap-2.5 text-xs font-mono">
                  <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] text-neutral-400 uppercase">Registered Atelier / Dispatch Hub</div>
                    <div className="text-neutral-300 mt-0.5 leading-relaxed">{contact.businessAddress}</div>
                  </div>
                </div>
              )}

              {/* Social Channels */}
              {enabledChannels.length > 0 && (
                <div className="pt-2 border-t border-neutral-800">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2.5">
                    OFFICIAL SOCIAL CHANNELS
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {enabledChannels.map((ch) => (
                      <a
                        key={ch.id || ch.platform}
                        href={ch.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-600 hover:text-white text-neutral-300 text-xs font-mono transition"
                      >
                        {renderSocialChannelIcon(ch.platform, 'w-3.5 h-3.5')}
                        <span>{ch.label || ch.platform}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center gap-2 text-[11px] font-mono text-neutral-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Genuine TORI-WEAR customer support — no third-party resellers.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

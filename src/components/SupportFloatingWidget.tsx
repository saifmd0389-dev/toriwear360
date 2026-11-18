import React, { useState, useEffect } from 'react';
import { MessageCircle, X, PhoneCall, Mail, Clock, ExternalLink } from 'lucide-react';
import { StoreContactConfig } from '../types';
import { apiClient } from '../services/apiClient';
import { WhatsAppIcon } from './SocialIcons';
import { buildWhatsAppHref, renderSocialChannelIcon } from './ContactSupportModal';

interface SupportFloatingWidgetProps {
  onOpenContact: () => void;
}

export const SupportFloatingWidget: React.FC<SupportFloatingWidgetProps> = ({ onOpenContact }) => {
  const [contact, setContact] = useState<StoreContactConfig | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const loadConfig = () => {
    apiClient
      .getStoreContact()
      .then((res) => {
        if (res.success && res.data) {
          setContact(res.data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadConfig();
    window.addEventListener('tori_contact_updated', loadConfig);
    return () => window.removeEventListener('tori_contact_updated', loadConfig);
  }, []);

  const waHref = buildWhatsAppHref(contact);
  const enabledSocials = (contact?.channels || [])
    .filter((c) => c.enabled !== false && Boolean(c.url?.trim()) && !(c.platform || '').toLowerCase().includes('whatsapp'))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end gap-2.5 select-none">
      {/* Expanded Consolidated Support Popover */}
      {isExpanded && (
        <div
          role="region"
          aria-label="TORI-WEAR Support Menu"
          className="w-72 rounded-2xl bg-[#101119]/95 backdrop-blur-xl border border-neutral-700/80 shadow-2xl p-4 text-white space-y-3 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
            <div>
              <div className="text-[10px] font-mono font-bold text-[#FF2028] uppercase tracking-widest">
                TORI-WEAR SUPPORT
              </div>
              <div className="text-xs font-bold text-white mt-0.5">How can we help today?</div>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-label="Minimize support menu"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsExpanded(false)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-black font-bold text-xs flex items-center justify-between transition shadow-md"
              >
                <span className="flex items-center gap-2">
                  <WhatsAppIcon className="w-4 h-4" />
                  <span>Chat on WhatsApp</span>
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                onOpenContact();
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-mono font-bold flex items-center justify-between transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#FF2028]" />
                <span>Contact Info &amp; Hours</span>
              </span>
              <span className="text-neutral-400">→</span>
            </button>

            {contact?.phone && (
              <a
                href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                className="w-full px-3.5 py-2 rounded-xl bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-[11px] font-mono flex items-center gap-2 transition"
              >
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{contact.phone}</span>
              </a>
            )}
          </div>

          {enabledSocials.length > 0 && (
            <div className="pt-2 border-t border-neutral-800/80">
              <div className="text-[10px] font-mono text-neutral-400 uppercase mb-2">Social Channels</div>
              <div className="flex flex-wrap gap-1.5">
                {enabledSocials.map((ch) => (
                  <a
                    key={ch.id || ch.platform}
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={ch.label || ch.platform}
                    aria-label={ch.label || ch.platform}
                    className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-neutral-300 hover:text-white flex items-center justify-center transition"
                  >
                    {renderSocialChannelIcon(ch.platform, 'w-3.5 h-3.5')}
                  </a>
                ))}
              </div>
            </div>
          )}

          {contact?.operatingHours && (
            <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-1.5 pt-1">
              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">{contact.operatingHours}</span>
            </div>
          )}
        </div>
      )}

      {/* Single Consolidated Launcher Button */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-label="Open TORI-WEAR Customer Support"
        aria-expanded={isExpanded}
        className="group flex items-center gap-2.5 bg-[#12131c] hover:bg-[#191b26] border border-neutral-700/80 hover:border-[#25D366]/70 text-white px-3.5 py-2.5 rounded-full shadow-2xl transition-all duration-200 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-full bg-[#25D366] text-black flex items-center justify-center shadow-sm">
          {isExpanded ? <X className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
        </div>
        <span className="hidden sm:inline text-xs font-mono font-bold tracking-wide pr-1">
          {isExpanded ? 'CLOSE' : 'NEED HELP?'}
        </span>
      </button>
    </div>
  );
};

import React, { useState } from 'react';
import { WhatsAppIcon } from './SocialIcons';
import { X } from 'lucide-react';

export const WhatsAppFloatingButton: React.FC = () => {
  const [showTooltip, setShowTooltip] = useState(true);

  const whatsappNumber = '919876543210';
  const defaultMessage = encodeURIComponent(
    'Hi TORIWEAR Concierge! I have a question about drops, sizing, or my order.'
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${defaultMessage}`;

  return (
    <div 
      id="whatsapp-floating-container"
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end gap-2 pointer-events-auto select-none"
    >
      {/* Tooltip / Speech bubble */}
      {showTooltip && (
        <div className="relative bg-[#121216] border border-neutral-700/80 text-white rounded-xl py-2 px-3 shadow-2xl text-xs max-w-[210px] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <button
            onClick={() => setShowTooltip(false)}
            className="absolute -top-1.5 -left-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full p-0.5 border border-neutral-700 shadow"
            aria-label="Dismiss message"
          >
            <X className="w-3 h-3" />
          </button>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#25D366] font-bold uppercase tracking-wider mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-ping" />
            <span>TORI CONCIERGE</span>
          </div>
          <p className="text-[11px] text-neutral-300 leading-snug font-sans">
            Need sizing advice or drop updates? Chat with us on WhatsApp!
          </p>
        </div>
      )}

      {/* Main WhatsApp Floating Action Button */}
      <a
        id="whatsapp-chat-button"
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2.5 bg-[#121216] hover:bg-[#1a1a20] text-white border border-[#25D366]/40 hover:border-[#25D366] px-3.5 py-2.5 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
        aria-label="Chat with TORIWEAR on WhatsApp"
      >
        <div className="relative w-8 h-8 rounded-full bg-[#25D366] text-neutral-950 flex items-center justify-center flex-shrink-0 shadow-md">
          <WhatsAppIcon className="w-5 h-5 text-neutral-950" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#121216] rounded-full" />
        </div>
        <div className="hidden sm:flex flex-col text-left pr-1">
          <span className="text-[11px] font-heading font-black tracking-wider text-white uppercase group-hover:text-[#25D366] transition-colors">
            WHATSAPP CHAT
          </span>
          <span className="text-[9px] font-mono text-neutral-400">
            ONLINE · 24/7 SUPPORT
          </span>
        </div>
      </a>
    </div>
  );
};

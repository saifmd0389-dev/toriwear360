import React, { useState, useEffect } from 'react';
import { ShieldCheck, Truck, RotateCcw, Lock, ArrowUp, Sparkles, Globe, Mail, Phone, MapPin, Clock } from 'lucide-react';
import { InstagramIcon, WhatsAppIcon, FacebookIcon, XTwitterIcon, YouTubeIcon, DiscordIcon } from './SocialIcons';
import { Department, StoreContactConfig } from '../types';
import { MEN_WORLDS, KIDS_WORLDS } from '../data/constants';
import { OfficialToriwearLogo } from './OfficialToriwearLogo';
import { loadFrontPageCmsData } from '../admin/data/frontPageCmsData';
import { normalizeSocialUrl, DEFAULT_INSTAGRAM_URL } from '../utils/socialLinks';
import { apiClient } from '../services/apiClient';
import { buildWhatsAppHref } from './ContactSupportModal';

interface FooterProps {
  onSelectDepartment: (dept: Department | 'ALL') => void;
  onSelectWorld: (world: string) => void;
  onScrollToSection: (sectionId: string) => void;
  onOpenSizeGuide: () => void;
  onOpenTrackOrder: () => void;
  onOpenStory: () => void;
  onOpenContact: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectDepartment,
  onSelectWorld,
  onScrollToSection,
  onOpenSizeGuide,
  onOpenTrackOrder,
  onOpenStory,
  onOpenContact,
}) => {
  const [footerCms, setFooterCms] = useState(() => loadFrontPageCmsData().footer);
  const [contactConfig, setContactConfig] = useState<StoreContactConfig | null>(null);

  useEffect(() => {
    let mounted = true;
    const syncCms = () => setFooterCms(loadFrontPageCmsData().footer);
    const syncContact = () => {
      apiClient
        .getStoreContact()
        .then((res) => {
          if (mounted && res.success && res.data) {
            setContactConfig(res.data);
          }
        })
        .catch(() => {});
    };
    syncContact();
    window.addEventListener('tori-cms-updated', syncCms);
    window.addEventListener('tori_contact_updated', syncContact);
    window.addEventListener('storage', syncCms);
    return () => {
      mounted = false;
      window.removeEventListener('tori-cms-updated', syncCms);
      window.removeEventListener('tori_contact_updated', syncContact);
      window.removeEventListener('storage', syncCms);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer id="main-footer" className="bg-[#060609] text-neutral-400 border-t border-neutral-800/80 pt-16 pb-12 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        {/* Brand Mission & Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10">
          {/* Brand Info Column (2 spans) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-2">
              <OfficialToriwearLogo 
                className="h-12 sm:h-14 w-auto max-w-[200px] object-contain" 
              />
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
              {footerCms?.aboutBlurb || 'Original anime-inspired streetwear created for people who live between imagination and reality. Heavyweight 240–260 GSM combed cotton for Men, ultra-soft 180 GSM bio-washed cotton for Kids.'}
            </p>

            <div className="pt-2">
              <div className="text-[11px] font-heading font-semibold uppercase tracking-[0.1em] text-neutral-300 mb-2">
                CONNECT WITH THE SQUAD
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {(() => {
                  const waDirect = buildWhatsAppHref(contactConfig);
                  const liveChannels =
                    contactConfig?.channels && contactConfig.channels.length > 0
                      ? contactConfig.channels
                          .filter((s) => s.enabled !== false && (s.url?.trim() || (s.platform || '').toLowerCase().includes('whatsapp')))
                          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                      : footerCms?.socialLinks && footerCms.socialLinks.length > 0
                        ? footerCms.socialLinks.filter((s) => s.enabled !== false && s.url?.trim())
                        : [];

                  return liveChannels.map((link: any, idx: number) => {
                    const p = (link.platform || '').toLowerCase();
                    let iconEl = <Globe className="w-4 h-4 group-hover:scale-110 transition-transform" />;
                    let hoverCls = 'hover:text-white hover:border-neutral-500';
                    if (p.includes('insta')) {
                      iconEl = <InstagramIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />;
                      hoverCls = 'hover:text-white hover:border-[#FF2028]';
                    } else if (p.includes('whatsapp') || p.includes('wa')) {
                      iconEl = <WhatsAppIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />;
                      hoverCls = 'hover:text-[#25D366] hover:border-[#25D366]';
                    } else if (p.includes('facebook') || p === 'fb') {
                      iconEl = <FacebookIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />;
                      hoverCls = 'hover:text-sky-400 hover:border-sky-400';
                    } else if (p.includes('twitter') || p === 'x' || p.includes('x /')) {
                      iconEl = <XTwitterIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />;
                      hoverCls = 'hover:text-white hover:border-neutral-500';
                    } else if (p.includes('youtube') || p.includes('yt')) {
                      iconEl = <YouTubeIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />;
                      hoverCls = 'hover:text-[#FF2028] hover:border-[#FF2028]';
                    } else if (p.includes('discord')) {
                      iconEl = <DiscordIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />;
                      hoverCls = 'hover:text-indigo-400 hover:border-indigo-400';
                    }

                    const resolvedHref = p.includes('whatsapp') && waDirect
                      ? waDirect
                      : p.includes('insta')
                        ? normalizeSocialUrl(link.url, DEFAULT_INSTAGRAM_URL)
                        : normalizeSocialUrl(link.url, link.url);

                    if (!resolvedHref) return null;

                    return (
                      <a
                        key={`${link.platform}-${idx}`}
                        href={resolvedHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:bg-neutral-800 transition group ${hoverCls}`}
                        aria-label={link.label || link.platform}
                        title={link.label || link.platform}
                      >
                        {iconEl}
                      </a>
                    );
                  });
                })()}
              </div>

              {/* Direct WhatsApp Concierge Link */}
              {(() => {
                const waHref = buildWhatsAppHref(contactConfig);
                if (!waHref) return null;
                return (
                  <div className="mt-3">
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-[#25D366]/40 text-[#25D366] hover:bg-emerald-900/60 transition text-xs font-mono font-bold"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>WHATSAPP CONCIERGE · 24/7 SUPPORT</span>
                    </a>
                  </div>
                );
              })()}
            </div>

            {/* Support Contact & Atelier Info */}
            {(() => {
              const email = contactConfig?.supportEmail || footerCms?.supportEmail;
              const phone = contactConfig?.phone || footerCms?.supportPhone;
              const hours = contactConfig?.operatingHours || footerCms?.operatingHours;
              const addr = contactConfig?.businessAddress || footerCms?.atelierAddress;
              if (!email && !phone && !hours && !addr) return null;
              return (
                <div className="pt-2 space-y-1.5 text-[11px] font-mono text-neutral-400">
                  {email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#FF2028] shrink-0" />
                      <a href={`mailto:${email}`} className="hover:text-white transition truncate">
                        {email}
                      </a>
                    </div>
                  )}
                  {phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:text-white transition">
                        {phone}
                      </a>
                    </div>
                  )}
                  {hours && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{hours}</span>
                    </div>
                  )}
                  {addr && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>{addr}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* In-House Notice */}
            <div className="pt-2 text-[11px] font-mono text-neutral-400 border-l-2 border-[#FF2028] pl-3 py-1">
              100% In-House Intellectual Property. Handcrafted stories & original character designs.
            </div>
          </div>

          {/* MEN’S WORLDS Column */}
          <div className="space-y-3">
            <h4 className="font-heading text-xs uppercase font-semibold text-white tracking-[0.08em] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF2028]" />
              <span>MEN’S WORLDS</span>
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              {MEN_WORLDS.map((w) => (
                <li key={w.id}>
                  <button
                    onClick={() => {
                      onSelectDepartment('MEN');
                      onSelectWorld(w.id);
                      onScrollToSection('shop-men-section');
                    }}
                    className="hover:text-white hover:text-[#FF2028] transition text-left"
                  >
                    {w.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* KIDS’ WORLDS Column */}
          <div className="space-y-3">
            <h4 className="font-heading text-xs uppercase font-semibold text-white tracking-[0.08em] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>KIDS’ WORLDS</span>
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              {KIDS_WORLDS.map((w) => (
                <li key={w.id}>
                  <button
                    onClick={() => {
                      onSelectDepartment('KIDS');
                      onSelectWorld(w.id);
                      onScrollToSection('shop-kids-section');
                    }}
                    className="hover:text-white hover:text-sky-400 transition text-left"
                  >
                    {w.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* TORI UNIVERSE Column */}
          <div className="space-y-3">
            <h4 className="font-heading text-xs uppercase font-semibold text-white tracking-[0.08em]">
              TORI UNIVERSE
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <button
                  onClick={() => onScrollToSection('choose-your-world-section')}
                  className="hover:text-white transition text-left cursor-pointer"
                >
                  Chapter 01 — Originals
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollToSection('original-characters-section')}
                  className="hover:text-white transition text-left cursor-pointer"
                >
                  The Original Characters
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollToSection('story-behind-designs-section')}
                  className="hover:text-white transition text-left cursor-pointer"
                >
                  Story Behind The Designs
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenStory}
                  className="hover:text-white transition text-left cursor-pointer"
                >
                  Brand Manifesto
                </button>
              </li>
            </ul>
          </div>

          {/* SUPPORT & TRUST Column */}
          <div className="space-y-3">
            <h4 className="font-heading text-xs uppercase font-semibold text-white tracking-[0.08em]">
              SUPPORT & TRUST
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <button
                  onClick={onOpenSizeGuide}
                  className="hover:text-white transition text-left"
                >
                  Size Chart (Men & Kids)
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenTrackOrder}
                  className="hover:text-white transition text-left cursor-pointer"
                >
                  Track Your Order
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenTrackOrder}
                  className="hover:text-white transition text-left cursor-pointer"
                >
                  Returns & Exchanges
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenContact}
                  className="hover:text-white transition text-left"
                >
                  Contact & Support
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollToSection('faq-section')}
                  className="hover:text-white transition text-left cursor-pointer"
                >
                  Frequently Asked Questions
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollToSection('customer-lookbook-section')}
                  className="hover:text-white text-neutral-400 hover:text-[#FF2028] transition text-left cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-[#FF2028]" />
                  <span>Customer Lookbook</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* 4 Trust Badges Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-neutral-800/80 text-xs">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-[#FF2028] flex-shrink-0" />
            <div>
              <div className="text-white font-semibold">{footerCms?.trustBadges?.[3]?.title || 'Free Delivery'}</div>
              <div className="text-neutral-400 text-[11px]">{footerCms?.trustBadges?.[3]?.subtitle || 'All orders above ₹999'}</div>
            </div>
          </div>

          <div 
            onClick={onOpenTrackOrder}
            className="flex items-center gap-3 cursor-pointer group"
            title="Track orders and request hassle-free returns & exchanges"
          >
            <RotateCcw className="w-5 h-5 text-sky-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-white font-semibold group-hover:text-sky-300 transition-colors">
                {footerCms?.trustBadges?.[2]?.title || `${contactConfig?.returnWindowDays || 7}-Day Exchanges`}
              </div>
              <div className="text-neutral-400 text-[11px]">{footerCms?.trustBadges?.[2]?.subtitle || 'Hassle-free doorstep pickup'}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-white font-semibold">{footerCms?.trustBadges?.[0]?.title || '100% Original IP'}</div>
              <div className="text-neutral-400 text-[11px]">{footerCms?.trustBadges?.[0]?.subtitle || 'Original story-driven designs'}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div>
              <div className="text-white font-semibold">{footerCms?.trustBadges?.[1]?.title || 'Secure Checkout'}</div>
              <div className="text-neutral-400 text-[11px]">{footerCms?.trustBadges?.[1]?.subtitle || '256-bit encrypted UPI & cards'}</div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-neutral-800/60 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-sans text-neutral-400">
          <div>
            {footerCms?.copyrightText || `© ${new Date().getFullYear()} TORIWEAR APPAREL PVT. LTD. ALL RIGHTS RESERVED.`}
            <div className="text-[11px] text-neutral-500 mt-1">
              {footerCms?.brandTagline || 'TORIWEAR IS AN INDEPENDENT ORIGINAL ANIME-INSPIRED STREETWEAR BRAND. NOT AFFILIATED WITH MARVEL, DC, DISNEY, OR THIRD-PARTY ANIME FRANCHISES.'}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={scrollToTop}
              className="flex items-center gap-1.5 hover:text-white transition px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800"
            >
              <span>BACK TO TOP</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, User, Menu, X, ChevronDown, Bell } from 'lucide-react';
import { InstagramIcon, WhatsAppIcon, FacebookIcon, XTwitterIcon, YouTubeIcon } from './SocialIcons';
import { Department, MenWorldCategory, KidsWorldCategory, StoreCategory, StoreContactConfig } from '../types';
import { MEN_WORLDS, KIDS_WORLDS } from '../data/constants';
import { OfficialToriwearLogo } from './OfficialToriwearLogo';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { WishlistHeartIcon } from './WishlistHeartIcon';
import { getAuthoritativeInstagramUrl, normalizeSocialUrl } from '../utils/socialLinks';
import { fetchFrontPageCmsDataFromServer } from '../admin/data/frontPageCmsData';
import { apiClient } from '../services/apiClient';
import { buildWhatsAppHref, renderSocialChannelIcon } from './ContactSupportModal';
import { computeNextHeaderScrolledState } from '../utils/headerScrollState';

interface HeaderProps {
  cartCount: number;
  wishlistCount: number;
  activeDepartment: Department | 'ALL';
  isFrontPage?: boolean;
  menCount?: number;
  kidsCount?: number;
  kidsComingSoon?: boolean;
  categories?: StoreCategory[];
  onSelectCategorySlug?: (slug: string) => void;
  onSelectDepartment: (dept: Department | 'ALL') => void;
  onSelectWorld: (world: MenWorldCategory | KidsWorldCategory | string) => void;
  onOpenCart: () => void;
  onOpenSearch: () => void;
  onOpenWishlist: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onOpenTrackOrder: () => void;
  onOpenSizeGuide?: () => void;
  onOpenStory: () => void;
  onOpenContact: () => void;
  onNavigateHome: () => void;
  onScrollToSection: (sectionId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount,
  wishlistCount,
  activeDepartment,
  isFrontPage,
  menCount,
  kidsCount,
  kidsComingSoon = false,
  categories = [],
  onSelectCategorySlug,
  onSelectDepartment,
  onSelectWorld,
  onOpenCart,
  onOpenSearch,
  onOpenWishlist,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onOpenTrackOrder,
  onOpenSizeGuide,
  onOpenStory,
  onOpenContact,
  onNavigateHome,
  onScrollToSection,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collectionsDropdownOpen, setCollectionsDropdownOpen] = useState(false);
  const [moreNavDropdownOpen, setMoreNavDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState<boolean>(() =>
    typeof window !== 'undefined' ? computeNextHeaderScrolledState(false, window.scrollY) : false
  );
  const scrolledRef = useRef<boolean>(scrolled);
  const [contactConfig, setContactConfig] = useState<StoreContactConfig | null>(null);

  const { customer, isLoggedIn, loginWithGoogle, openAuthModal, openAccountModal, logout } = useCustomerAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Front page detection: only logo is shown on front page; navigation panel & utility icons only appear on shop men, shop kids & next pages
  const isFront = isFrontPage !== undefined ? isFrontPage : (activeDepartment === 'ALL');

  // Customer must first log in before accessing any profile features
  const handleRequireLogin = () => {
    setProfileDropdownOpen(false);
    openAuthModal();
  };

  interface TopAnnouncementState {
    hasConfig: boolean;
    ad: {
      headline?: string;
      badge?: string;
      linkUrl?: string;
      ctaText?: string;
      bgColor?: string;
      textColor?: string;
    } | null;
  }

  interface NavTabItem {
    id: string;
    label: string;
    targetLink: string;
    badge?: string;
    enabled: boolean;
    order: number;
    description?: string;
  }

  const parseCmsNavAndAd = (parsed: any) => {
    const allAds = Array.isArray(parsed?.advertisements) ? parsed.advertisements : [];
    const topAds = allAds.filter((a: any) => a.type === 'TOP_ANNOUNCEMENT');
    const activeTopAd = topAds.find((a: any) => a.enabled !== false) || null;
    const rawTabs = Array.isArray(parsed?.tabs) ? parsed.tabs : [];
    const headerTabs: NavTabItem[] = rawTabs
      .filter((t: any) => t.category === 'HEADER_NAV' && t.enabled !== false)
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    return {
      announcement: { hasConfig: topAds.length > 0, ad: activeTopAd } as TopAnnouncementState,
      headerTabs,
    };
  };

  const [announcementState, setAnnouncementState] = useState<TopAnnouncementState>(() => {
    try {
      const raw = localStorage.getItem('tori_admin_frontpage_cms');
      if (raw) {
        return parseCmsNavAndAd(JSON.parse(raw)).announcement;
      }
    } catch {}
    return { hasConfig: false, ad: null };
  });

  const [cmsNavTabs, setCmsNavTabs] = useState<NavTabItem[]>(() => {
    try {
      const raw = localStorage.getItem('tori_admin_frontpage_cms');
      if (raw) {
        return parseCmsNavAndAd(JSON.parse(raw)).headerTabs;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    let isMounted = true;
    fetchFrontPageCmsDataFromServer()
      .then((data) => {
        if (isMounted && data) {
          const parsed = parseCmsNavAndAd(data);
          setAnnouncementState(parsed.announcement);
          setCmsNavTabs(parsed.headerTabs);
        }
      })
      .catch(() => {});

    const handleCmsAdUpdate = (e?: any) => {
      try {
        const data = e?.detail;
        if (data && typeof data === 'object') {
          const parsed = parseCmsNavAndAd(data);
          setAnnouncementState(parsed.announcement);
          setCmsNavTabs(parsed.headerTabs);
          return;
        }
        const raw = localStorage.getItem('tori_admin_frontpage_cms');
        if (raw) {
          const parsed = parseCmsNavAndAd(JSON.parse(raw));
          setAnnouncementState(parsed.announcement);
          setCmsNavTabs(parsed.headerTabs);
        }
      } catch {}
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'tori_admin_frontpage_cms') {
        handleCmsAdUpdate();
      }
    };
    window.addEventListener('tori-cms-updated', handleCmsAdUpdate);
    window.addEventListener('storage', handleStorage);
    return () => {
      isMounted = false;
      window.removeEventListener('tori-cms-updated', handleCmsAdUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    let rafId: number | null = null;

    const evaluateScroll = () => {
      rafId = null;
      const y = window.scrollY || window.pageYOffset || 0;
      const next = computeNextHeaderScrolledState(scrolledRef.current, y);
      if (next !== scrolledRef.current) {
        scrolledRef.current = next;
        setScrolled(next);
      }
    };

    const scheduleScrollCheck = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(evaluateScroll);
    };

    // Initial sync on mount or route mode transition
    evaluateScroll();

    window.addEventListener('scroll', scheduleScrollCheck, { passive: true });
    return () => {
      window.removeEventListener('scroll', scheduleScrollCheck);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isFront]);

  useEffect(() => {
    let mounted = true;
    const loadContact = () => {
      apiClient.getStoreContact().then((res) => {
        if (mounted && res.success && res.data) setContactConfig(res.data);
      }).catch(() => {});
    };
    loadContact();
    window.addEventListener('tori_contact_updated', loadContact);
    return () => {
      mounted = false;
      window.removeEventListener('tori_contact_updated', loadContact);
    };
  }, []);

  const navCategories = categories.filter((c) => c.isActive && c.showInNav !== false);

  const handleCmsLink = (targetLink?: string) => {
    const link = (targetLink || '').trim();
    if (!link) return;
    if (link === '/') {
      onNavigateHome();
    } else if (link.startsWith('/men')) {
      const match = link.match(/world=([^&]+)/i);
      if (match?.[1]) {
        onSelectDepartment('MEN');
        onSelectWorld(decodeURIComponent(match[1].replace(/\+/g, ' ')));
      } else {
        onSelectDepartment('MEN');
      }
    } else if (link.startsWith('/kids')) {
      onSelectDepartment('KIDS');
    } else if (link.startsWith('#')) {
      const id = link.slice(1);
      const sectionAliasMap: Record<string, string> = {
        'tori-universe': 'tori-universe-section',
        'customer-lookbook': 'customer-lookbook-section',
        'twinning-spotlight': 'twinning-spotlight-section',
      };
      onScrollToSection(sectionAliasMap[id] || id);
    } else if (/^https?:\/\//i.test(link)) {
      window.location.href = link;
    }
  };

  const announcementAd = announcementState.ad;
  const shouldRenderAnnouncementBar = !announcementState.hasConfig || Boolean(announcementAd);

  return (
    <header 
      style={{
        position: isFront ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        right: 0,
        isolation: 'isolate',
      }}
      className={`site-header w-full select-none z-30 ${
        isFront 
          ? 'bg-transparent border-transparent shadow-none' 
          : 'bg-[#0a0a0f] border-b border-neutral-800/90 shadow-md'
      }`}
    >
      {/* Front-page frosted scrolled backdrop — GPU opacity-only transition (zero layout shift) */}
      {isFront && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-neutral-800/80 shadow-md transition-opacity duration-300 ease-out will-change-[opacity] ${
            scrolled ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Top Announcement Bar */}
      {shouldRenderAnnouncementBar && (
        <div 
          id="announcement-bar" 
          onClick={() => announcementAd?.linkUrl && handleCmsLink(announcementAd.linkUrl)}
          style={announcementAd ? {
            backgroundColor: (!isFront || scrolled) ? (announcementAd.bgColor || undefined) : undefined,
            color: announcementAd.textColor || undefined,
          } : undefined}
          className={`relative z-10 text-neutral-300 text-[10.5px] sm:text-[11px] font-sans font-medium tracking-[0.05em] py-1.5 px-4 text-center flex items-center justify-center gap-3 overflow-hidden transition-colors duration-300 ${
            announcementAd?.linkUrl ? 'cursor-pointer' : ''
          } ${
            isFront 
              ? (scrolled ? 'bg-transparent border-b border-neutral-800/40' : 'bg-transparent border-b border-white/5')
              : 'bg-[#0e0e14] border-b border-neutral-800'
          }`}
        >
          {announcementAd?.headline ? (
            <span className="inline-flex items-center gap-2" style={announcementAd.textColor ? { color: announcementAd.textColor } : undefined}>
              {announcementAd.badge && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FF2028] text-white">
                  {announcementAd.badge}
                </span>
              )}
              <span>{announcementAd.headline}</span>
              {announcementAd.ctaText && (
                <span className="underline font-bold">{announcementAd.ctaText}</span>
              )}
            </span>
          ) : (
            <>
              <span className="hidden sm:inline-flex items-center gap-1 text-neutral-200">
                TORIWEAR OFFICIAL STORE <span className="text-neutral-500">·</span> Free delivery above ₹999
              </span>
              <span className="hidden sm:inline text-neutral-600">|</span>
              <span className="inline-flex items-center gap-1.5 text-neutral-200">
                Limited Drops <span className="text-red-500 font-bold">240+ GSM</span> Archival Streetwear
              </span>
              <span className="hidden md:inline text-neutral-600">|</span>
              <span className="hidden md:inline-flex text-neutral-400">
                240 GSM Combed Cotton <span className="text-neutral-500">·</span> Wear Your World
              </span>
            </>
          )}
        </div>
      )}

      {/* Main Navigation Bar — 3-ZONE MATHEMATICALLY CENTERED LAYOUT (CONSTANT HEIGHT, ZERO REFLOW) */}
      <nav 
        id="main-nav"
        className={`relative z-10 w-full select-none ${
          isFront ? 'py-0.5 sm:py-1' : 'py-1 sm:py-2'
        }`}
      >
        <div className={`relative max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 ${
          isFront 
            ? 'flex items-center justify-center h-[52px] sm:h-[58px]' 
            : 'flex items-center justify-between sm:grid sm:grid-cols-[1fr_auto_1fr] min-h-[56px] sm:min-h-[64px] lg:min-h-[82px]'
        } items-center gap-1 sm:gap-2`}>
          {/* LEFT ZONE: Navigation & Mobile Menu Icon — Only visible on Shop Men, Shop Kids & next pages */}
          {!isFront && (
            <div className="justify-self-start flex items-center gap-2 sm:gap-6">
              {/* Mobile Menu Icon */}
              <button
                id="mobile-menu-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden w-10 h-10 flex items-center justify-center text-neutral-300 hover:text-white rounded-lg transition shrink-0 cursor-pointer"
                aria-label="Toggle Navigation"
              >
                {mobileMenuOpen ? <X className="w-5 h-5 text-red-500" /> : <Menu className="w-5 h-5" />}
              </button>

              {/* Desktop Navigation Links (Synced with CMS HEADER_NAV tabs) */}
              <div className="hidden lg:flex items-center gap-5 xl:gap-6 font-heading text-[12.5px] xl:text-[13px] font-medium uppercase tracking-[0.07em] leading-none">
                {(() => {
                  const primaryNavTabs = cmsNavTabs.length > 0
                    ? cmsNavTabs.slice(0, 3)
                    : [
                        { id: 'def-home', label: 'HOME', targetLink: '/', enabled: true, order: 1 },
                        { id: 'def-men', label: 'MEN', targetLink: '/men', badge: String(menCount ?? 30), enabled: true, order: 2 },
                        { id: 'def-kids', label: 'KIDS', targetLink: '/kids', badge: String(kidsCount ?? 24), enabled: true, order: 3 },
                      ];
                  return primaryNavTabs.map((tab) => {
                    const isHome = tab.targetLink === '/';
                    const isMen = tab.targetLink === '/men';
                    const isKids = tab.targetLink === '/kids';
                    const isActive =
                      (isHome && activeDepartment === 'ALL') ||
                      (isMen && activeDepartment === 'MEN') ||
                      (isKids && activeDepartment === 'KIDS');
                    const displayBadge = isMen
                      ? (tab.badge || String(menCount ?? 30))
                      : isKids
                        ? (kidsComingSoon ? 'COMING SOON' : (tab.badge || String(kidsCount ?? 24)))
                        : tab.badge;

                    return (
                      <button
                        key={tab.id}
                        id={isHome ? 'nav-home-btn' : isMen ? 'nav-men-btn' : isKids ? 'nav-kids-btn' : undefined}
                        onClick={() => handleCmsLink(tab.targetLink)}
                        className={`group transition-colors duration-200 py-2 cursor-pointer border-b-2 inline-flex items-center gap-2 whitespace-nowrap ${
                          isActive
                            ? isKids
                              ? 'text-white border-sky-400 font-semibold'
                              : 'text-white border-[#FF2028] font-semibold'
                            : 'text-neutral-300 hover:text-white border-transparent font-medium'
                        }`}
                      >
                        <span className="leading-none">{tab.label}</span>
                        {displayBadge && (
                          <span
                            className={`inline-flex items-center font-sans text-[10px] font-semibold tracking-[0.04em] leading-none px-2 py-[3px] rounded-full border tabular-nums shrink-0 transition-colors ${
                              isKids
                                ? isActive
                                  ? 'bg-sky-400/20 border-sky-400/50 text-sky-200'
                                  : 'bg-sky-500/10 border-sky-400/25 text-sky-300 group-hover:border-sky-400/45'
                                : isActive
                                  ? 'bg-[#FF2028]/15 border-[#FF2028]/45 text-red-200'
                                  : 'bg-white/[0.06] border-white/10 text-neutral-300 group-hover:border-white/25 group-hover:text-white'
                            }`}
                          >
                            {displayBadge}
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}

                {/* COLLECTIONS Dropdown */}
                <div 
                  className="relative flex items-center"
                  onMouseEnter={() => setCollectionsDropdownOpen(true)}
                  onMouseLeave={() => setCollectionsDropdownOpen(false)}
                >
                  <button 
                    id="nav-collections-btn"
                    className="inline-flex items-center gap-1.5 text-neutral-300 hover:text-white transition-colors duration-200 py-2 border-b-2 border-transparent font-medium whitespace-nowrap cursor-pointer"
                  >
                    <span className="leading-none">WORLDS</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${collectionsDropdownOpen ? 'rotate-180 text-white' : 'text-neutral-400'}`} />
                  </button>

                  {collectionsDropdownOpen && (
                    <div 
                      id="collections-dropdown-menu"
                      className="absolute top-full left-0 w-[500px] bg-[#0c0d12] border border-neutral-800 rounded-2xl shadow-2xl p-5 z-50 animate-in fade-in slide-in-from-top-1 font-sans normal-case tracking-normal"
                    >
                      <div className="grid grid-cols-2 gap-6">
                        {/* MEN'S 5 WORLDS */}
                        <div>
                          <div className="text-[11px] font-heading font-semibold tracking-[0.08em] text-neutral-300 pb-2 border-b border-neutral-800 flex items-center justify-between uppercase">
                            <span>Men’s Streetwear</span>
                            <span className="text-[10px] font-sans font-semibold text-red-500">240 GSM</span>
                          </div>
                          <div className="space-y-1 mt-2">
                            {MEN_WORLDS.map((w) => (
                              <button
                                key={w.id}
                                onClick={() => {
                                  onSelectDepartment('MEN');
                                  onSelectWorld(w.id);
                                  setCollectionsDropdownOpen(false);
                                }}
                                className="w-full text-left p-2 rounded-lg hover:bg-neutral-800/60 group transition flex items-center justify-between cursor-pointer"
                              >
                                <div>
                                  <div className="font-heading text-xs font-semibold text-neutral-100 group-hover:text-white tracking-tight">
                                    {w.name}
                                  </div>
                                  <div className="text-[11px] font-sans text-neutral-400 line-clamp-1 mt-0.5">{w.subtitle}</div>
                                </div>
                                <span className="text-xs text-neutral-500 group-hover:text-white">→</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* KIDS' 5 WORLDS */}
                        <div>
                          <div className="text-[11px] font-heading font-semibold tracking-[0.08em] text-neutral-300 pb-2 border-b border-neutral-800 flex items-center justify-between uppercase">
                            <span>Kids’ Storywear</span>
                            <span className="text-[10px] font-sans font-semibold text-sky-400">{kidsComingSoon ? 'Coming Soon' : 'Ages 2–13'}</span>
                          </div>
                          <div className="space-y-1 mt-2">
                            {KIDS_WORLDS.map((w) => (
                              <button
                                key={w.id}
                                onClick={() => {
                                  onSelectDepartment('KIDS');
                                  onSelectWorld(w.id);
                                  setCollectionsDropdownOpen(false);
                                }}
                                className="w-full text-left p-2 rounded-lg hover:bg-neutral-800/60 group transition flex items-center justify-between cursor-pointer"
                              >
                                <div>
                                  <div className="font-heading text-xs font-semibold text-neutral-100 group-hover:text-white tracking-tight">
                                    {w.name}
                                  </div>
                                  <div className="text-[11px] font-sans text-neutral-400 line-clamp-1 mt-0.5">{w.subtitle}</div>
                                </div>
                                <span className="text-xs text-neutral-500 group-hover:text-white">→</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {navCategories.length > 0 && onSelectCategorySlug && (
                        <div className="mt-4 pt-3 border-t border-neutral-800">
                          <div className="text-[10px] font-heading font-semibold tracking-[0.1em] text-neutral-400 uppercase mb-2">
                            Categories
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {navCategories.map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  onSelectCategorySlug(cat.slug);
                                  setCollectionsDropdownOpen(false);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-[#FF2028] text-[11px] font-sans font-medium text-neutral-200 hover:text-white transition cursor-pointer"
                              >
                                {cat.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Extra CMS HEADER_NAV Tabs Dropdown (if configured beyond primary 3 + Worlds) */}
                {(() => {
                  const extraNavTabs = cmsNavTabs
                    .slice(3)
                    .filter((t) => t.targetLink !== '#choose-your-world-section');
                  if (extraNavTabs.length === 0) return null;
                  return (
                    <div
                      className="relative flex items-center"
                      onMouseEnter={() => setMoreNavDropdownOpen(true)}
                      onMouseLeave={() => setMoreNavDropdownOpen(false)}
                    >
                      <button
                        type="button"
                        onClick={() => setMoreNavDropdownOpen((p) => !p)}
                        className="inline-flex items-center gap-1.5 text-neutral-300 hover:text-white transition-colors duration-200 py-2 border-b-2 border-transparent font-medium whitespace-nowrap cursor-pointer"
                      >
                        <span className="leading-none">MORE</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${moreNavDropdownOpen ? 'rotate-180 text-white' : 'text-neutral-400'}`} />
                      </button>

                      {moreNavDropdownOpen && (
                        <div className="absolute top-full left-0 w-56 bg-[#0c0d12] border border-neutral-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-1 space-y-1 font-sans normal-case tracking-normal">
                          {extraNavTabs.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => {
                                handleCmsLink(tab.targetLink);
                                setMoreNavDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-lg font-heading text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800/70 transition flex items-center justify-between cursor-pointer"
                            >
                              <span>{tab.label}</span>
                              {tab.badge && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-neutral-300 font-sans font-medium">
                                  {tab.badge}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* CENTER ZONE: FIRST LOGO AT TOP (+3CM), SECOND LOGO WHEN SCROLLED (NORMAL COMPACT SIZE) */}
          <div className={`justify-self-center flex items-center justify-center ${isFront ? 'h-full' : ''}`}>
            <button 
              id="brand-logo-btn"
              onClick={onNavigateHome}
              className={`group cursor-pointer focus:outline-none flex items-center justify-center shrink-0 p-0.5 ${
                isFront ? 'relative h-full' : ''
              }`}
              aria-label="TORIWEAR — WEAR YOUR WORLD"
            >
              {isFront ? (
                <>
                  {/* FIRST LOGO (Official Emblem) — Exact original top placement & +3cm sizing, GPU fade/scale only */}
                  <span
                    className={`absolute top-[3px] sm:top-[6px] lg:top-[8px] left-1/2 -translate-x-1/2 flex items-center justify-center [perspective:800px] h-14 sm:h-16 md:h-20 lg:h-[calc(3.5rem+3cm)] w-32 sm:w-36 md:w-44 lg:w-[calc(3.5rem+3cm)] max-h-[calc(3.5rem+3cm)] transition-[opacity,transform,scale,translate] duration-300 ease-out will-change-[opacity,transform] ${
                      !scrolled
                        ? 'opacity-100 scale-100 translate-y-0 z-10 pointer-events-auto'
                        : 'opacity-0 scale-95 -translate-y-2 z-0 pointer-events-none'
                    }`}
                  >
                    <OfficialToriwearLogo
                      variant="primary"
                      alt="TORIWEAR Original Logo"
                      suppressWarning
                      className="w-full h-full object-contain logo-spin-two-turns"
                    />
                  </span>

                  {/* SECOND LOGO (Horizontal Wordmark Banner) — Normal compact size, visible when scrolled down */}
                  <span
                    className={`relative flex items-center justify-center [perspective:800px] h-8 sm:h-9 md:h-11 w-24 sm:w-28 md:w-44 max-h-11 transition-[opacity,transform,scale,translate] duration-300 ease-out will-change-[opacity,transform] ${
                      scrolled
                        ? 'opacity-100 scale-100 translate-y-0 z-10 pointer-events-auto'
                        : 'opacity-0 scale-95 translate-y-1 z-0 pointer-events-none'
                    }`}
                  >
                    <OfficialToriwearLogo
                      variant="secondary"
                      alt="TORIWEAR Second Brand Logo"
                      suppressWarning
                      className="w-full h-full object-contain logo-spin-two-turns"
                    />
                  </span>
                </>
              ) : (
                <div className="relative flex items-center justify-center h-8 sm:h-10 md:h-14 w-24 sm:w-28 md:w-44">
                  {/* FIRST LOGO (Official Emblem) — Exact original inner-page size */}
                  <span
                    className={`absolute inset-0 m-auto flex items-center justify-center [perspective:800px] h-8 sm:h-10 md:h-14 w-20 sm:w-28 md:w-36 max-h-14 transition-[opacity,transform,scale,translate] duration-300 ease-out will-change-[opacity,transform] ${
                      !scrolled
                        ? 'opacity-100 scale-100 z-10 pointer-events-auto'
                        : 'opacity-0 scale-95 z-0 pointer-events-none'
                    }`}
                  >
                    <OfficialToriwearLogo
                      variant="primary"
                      alt="TORIWEAR Original Logo"
                      suppressWarning
                      className="w-full h-full object-contain logo-spin-two-turns"
                    />
                  </span>

                  {/* SECOND LOGO (Horizontal Wordmark Banner) — Exact original compact scrolled size */}
                  <span
                    className={`absolute inset-0 m-auto flex items-center justify-center [perspective:800px] h-8 sm:h-9 md:h-11 w-24 sm:w-28 md:w-44 max-h-11 transition-[opacity,transform,scale,translate] duration-300 ease-out will-change-[opacity,transform] ${
                      scrolled
                        ? 'opacity-100 scale-100 z-10 pointer-events-auto'
                        : 'opacity-0 scale-95 z-0 pointer-events-none'
                    }`}
                  >
                    <OfficialToriwearLogo
                      variant="secondary"
                      alt="TORIWEAR Second Brand Logo"
                      suppressWarning
                      className="w-full h-full object-contain logo-spin-two-turns"
                    />
                  </span>
                </div>
              )}
            </button>
          </div>

          {/* RIGHT ZONE: Search, Profile, Wishlist, Bag — Only visible on Shop Men, Shop Kids & next pages */}
          {!isFront && (
            <div className="justify-self-end flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Search Button */}
            <button
              id="header-search-btn"
              onClick={onOpenSearch}
              className="w-8 h-8 sm:w-10 sm:h-10 flex flex-col items-center justify-center text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer shrink-0"
              aria-label="Search Collection"
              title="Search collection"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Profile Dropdown Container */}
            <div 
              className="relative shrink-0"
              onMouseEnter={() => setProfileDropdownOpen(true)}
              onMouseLeave={() => setProfileDropdownOpen(false)}
            >
              <button
                id="header-profile-btn"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex flex-col items-center justify-center text-neutral-300 hover:text-white p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-neutral-800 transition cursor-pointer group shrink-0"
                aria-label="Profile Account"
                title={isLoggedIn ? `Hello, ${customer?.name}` : 'Login / Signup'}
              >
                <div className="relative flex items-center justify-center">
                  {isLoggedIn ? (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-red-600 to-rose-600 text-white flex items-center justify-center text-[10px] font-semibold font-sans shadow-sm">
                      {customer?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  ) : (
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-300 group-hover:text-white transition" />
                  )}
                </div>
                <span className="hidden sm:block text-[10px] font-medium tracking-[0.02em] font-sans text-neutral-300 group-hover:text-white mt-0.5">
                  Profile
                </span>
              </button>

              {/* Dropdown Menu (Exact Myntra Structure) */}
              {profileDropdownOpen && (
                <>
                  {/* Mobile tap-outside backdrop */}
                  <div 
                    className="fixed inset-0 z-40 bg-black/40 sm:hidden"
                    onClick={() => setProfileDropdownOpen(false)}
                    aria-hidden="true"
                  />
                  <div 
                    id="profile-dropdown-menu"
                    className="absolute top-full right-0 w-64 max-w-[calc(100vw-24px)] bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-1 text-xs select-none"
                  >
                  {!isLoggedIn ? (
                    /* UNLOGGED IN STATE (Screenshot 2) */
                    <div>
                      <div className="px-4 pb-3">
                        <div className="font-bold text-slate-900 text-sm">Welcome</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">To access account and manage orders</div>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            loginWithGoogle();
                          }}
                          className="mt-3 w-full py-2 px-3 border border-red-500 text-red-600 hover:bg-red-50 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer text-center flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          <span>SIGN IN WITH GOOGLE</span>
                        </button>
                      </div>

                      <div className="border-t border-slate-100 my-1" />

                      <div className="py-1">
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onOpenTrackOrder();
                          }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Orders & Tracking
                        </button>
                        <button
                          onClick={() => { setProfileDropdownOpen(false); onOpenWishlist(); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Wishlist
                        </button>
                        <button
                          onClick={handleRequireLogin}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Gift Cards
                        </button>
                        <button
                          onClick={() => { setProfileDropdownOpen(false); onOpenContact(); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Contact Us
                        </button>
                        <button
                          onClick={handleRequireLogin}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition flex items-center justify-between cursor-pointer"
                        >
                          <span>Tori Insider</span>
                          <span className="text-[9px] bg-red-600 text-white font-bold px-1.5 py-0.2 rounded uppercase italic font-mono">NEW</span>
                        </button>
                      </div>

                      <div className="border-t border-slate-100 my-1" />

                      <div className="py-1">
                        <button
                          onClick={handleRequireLogin}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Tori Credit
                        </button>
                        <button
                          onClick={handleRequireLogin}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Coupons
                        </button>
                        <button
                          onClick={handleRequireLogin}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Saved Cards
                        </button>
                        <button
                          onClick={handleRequireLogin}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Saved VPA
                        </button>
                        <button
                          onClick={handleRequireLogin}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Saved Addresses
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* LOGGED IN STATE (Screenshot 1) */
                    <div>
                      <div className="px-4 pb-2.5">
                        <div className="font-bold text-slate-900 text-sm">
                          Hello {customer?.name || 'Md'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {customer?.phone || customer?.email}
                        </div>
                      </div>

                      <div className="border-t border-slate-100 my-1" />

                      <div className="py-1">
                        <button
                          onClick={() => { setProfileDropdownOpen(false); openAccountModal('ORDER_HISTORY'); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer flex items-center justify-between"
                        >
                          <span>Orders & Invoices</span>
                          <span className="text-[10px] bg-red-100 text-red-600 font-mono font-bold px-1.5 py-0.2 rounded">History</span>
                        </button>
                        {onOpenNotifications && (
                          <button
                            onClick={() => { setProfileDropdownOpen(false); onOpenNotifications(); }}
                            className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer flex items-center justify-between"
                          >
                            <span>Notifications &amp; Restocks</span>
                            {unreadNotificationsCount > 0 && (
                              <span className="text-[10px] bg-red-600 text-white font-mono font-bold px-1.5 py-0.2 rounded-full">
                                {unreadNotificationsCount}
                              </span>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => { setProfileDropdownOpen(false); onOpenWishlist(); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Wishlist
                        </button>
                        <button
                          onClick={() => { setProfileDropdownOpen(false); openAccountModal('GIFT_CARDS'); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Gift Cards
                        </button>
                        <button
                          onClick={() => { setProfileDropdownOpen(false); onOpenContact(); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Contact Us
                        </button>
                        <button
                          onClick={() => { setProfileDropdownOpen(false); openAccountModal('TORI_INSIDER'); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition flex items-center justify-between cursor-pointer"
                        >
                          <span>Tori Insider</span>
                          <span className="text-[9px] bg-red-600 text-white font-bold px-1.5 py-0.2 rounded uppercase italic font-mono">NEW</span>
                        </button>
                      </div>

                      <div className="border-t border-slate-100 my-1" />

                      <div className="py-1">
                        <button
                          onClick={() => { setProfileDropdownOpen(false); openAccountModal('TORI_CREDIT'); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition flex items-center justify-between cursor-pointer"
                        >
                          <span>Tori Credit</span>
                          <span className="text-[11px] font-mono text-emerald-600 font-bold">₹{customer?.toriCredit || 250}</span>
                        </button>
                        <button
                          onClick={() => { setProfileDropdownOpen(false); openAccountModal('COUPONS'); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Coupons
                        </button>
                        <button
                          onClick={() => { setProfileDropdownOpen(false); openAccountModal('SAVED_CARDS'); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Saved Cards
                        </button>
                        <button
                          onClick={() => { setProfileDropdownOpen(false); openAccountModal('SAVED_VPA'); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Saved VPA
                        </button>
                        <button
                          onClick={() => { setProfileDropdownOpen(false); openAccountModal('SAVED_ADDRESSES'); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Saved Addresses
                        </button>
                      </div>

                      <div className="border-t border-slate-100 my-1" />

                      <div className="py-1">
                        <button
                          onClick={() => { setProfileDropdownOpen(false); openAccountModal('EDIT_PROFILE'); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer"
                        >
                          Edit Profile
                        </button>
                        <button
                          onClick={() => { setProfileDropdownOpen(false); logout(); }}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-50 text-red-600 font-bold transition cursor-pointer"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

            {/* Customer Website Notifications Bell (signed-in customers) */}
            {isLoggedIn && onOpenNotifications && (
              <button
                id="header-notifications-btn"
                onClick={onOpenNotifications}
                className="flex flex-col items-center justify-center text-neutral-300 hover:text-white p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-neutral-800 transition relative cursor-pointer group shrink-0"
                aria-label="Notifications"
                title="Notifications & Back-in-Stock Alerts"
              >
                <div className="relative flex items-center justify-center">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-300 group-hover:text-white transition" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-red-600 text-white text-[9px] font-semibold rounded-full flex items-center justify-center shadow-md font-sans tabular-nums">
                      {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </span>
                  )}
                </div>
                <span className="hidden sm:block text-[10px] font-medium tracking-[0.02em] font-sans text-neutral-300 group-hover:text-white mt-0.5">
                  Alerts
                </span>
              </button>
            )}

            {/* Wishlist Button with Label */}
            <button
              id="header-wishlist-btn"
              onClick={onOpenWishlist}
              className="flex flex-col items-center justify-center text-neutral-300 hover:text-white p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-neutral-800 transition relative cursor-pointer group shrink-0"
              aria-label="Wishlist"
              title="View Wishlist"
            >
              <div className="relative flex items-center justify-center">
                <WishlistHeartIcon
                  pulseOnIncrement={wishlistCount}
                  className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-300 group-hover:text-white transition"
                />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-600 text-white text-[9px] font-semibold rounded-full flex items-center justify-center shadow-md font-sans tabular-nums">
                    {wishlistCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:block text-[10px] font-medium tracking-[0.02em] font-sans text-neutral-300 group-hover:text-white mt-0.5">
                Wishlist
              </span>
            </button>

            {/* Cart / Bag Button */}
            <button
              id="header-cart-btn"
              onClick={onOpenCart}
              className="flex items-center gap-1.5 sm:gap-2 bg-white hover:bg-neutral-200 text-neutral-950 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg font-sans font-semibold text-xs tracking-[0.04em] transition active:scale-95 cursor-pointer whitespace-nowrap shadow-sm shrink-0"
              aria-label="Shopping Cart"
            >
              <ShoppingBag className="w-4 h-4 text-neutral-950" />
              <span className="hidden sm:inline">BAG</span>
              <span className="text-neutral-700 font-semibold tabular-nums text-[11px] sm:text-xs">({cartCount})</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile Navigation Drawer */}
      {!isFront && mobileMenuOpen && (
          <div id="mobile-menu-drawer" className="lg:hidden border-t border-neutral-800 bg-[#0c0d12] px-4 pt-4 pb-6 mt-2 space-y-4 animate-in fade-in slide-in-from-top-2">
            {/* Customer Account Status */}
            <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-red-600/20 text-[#FF2028] flex items-center justify-center font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {isLoggedIn ? `Hello, ${customer?.name}` : 'Welcome to TORIWEAR'}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-sans">
                    {isLoggedIn ? (customer?.phone || customer?.email) : 'Login for orders & Tori Insider'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (isLoggedIn) {
                    openAccountModal('EDIT_PROFILE');
                  } else {
                    openAuthModal();
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-sans text-xs font-semibold cursor-pointer"
              >
                {isLoggedIn ? 'Account' : 'Login'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onSelectDepartment('MEN');
                  setMobileMenuOpen(false);
                }}
                className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-left cursor-pointer"
              >
                <div className="text-xs font-semibold text-[#FF2028] font-heading tracking-[0.06em]">SHOP MEN</div>
                <div className="text-[11px] text-neutral-400 font-sans mt-0.5">{menCount ?? 30} Oversized Street Drops</div>
              </button>
              <button
                onClick={() => {
                  onSelectDepartment('KIDS');
                  setMobileMenuOpen(false);
                }}
                className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-left cursor-pointer"
              >
                <div className="text-xs font-semibold text-sky-400 font-heading tracking-[0.06em]">SHOP KIDS</div>
                <div className="text-[11px] text-neutral-400 font-sans mt-0.5">{kidsCount ?? 24} Bio-Wash Story Drops</div>
              </button>
            </div>

            <div className="space-y-1 border-t border-neutral-800/80 pt-3 text-sm font-heading font-medium">
              {cmsNavTabs.length > 0 ? (
                cmsNavTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      handleCmsLink(tab.targetLink);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left py-2 px-3 text-neutral-200 hover:bg-neutral-800/50 rounded-lg flex items-center justify-between"
                  >
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className="text-[10px] text-neutral-300 bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded-full font-sans font-semibold tabular-nums">{tab.badge}</span>
                    )}
                  </button>
                ))
              ) : (
                <>
                  <button
                    onClick={() => { onNavigateHome(); setMobileMenuOpen(false); }}
                    className="w-full text-left py-2 px-3 text-neutral-200 hover:bg-neutral-800/50 rounded-lg flex items-center justify-between"
                  >
                    <span>Home Page</span>
                    <span className="text-xs text-neutral-500 font-sans">Main</span>
                  </button>
                  <button
                    onClick={() => { onSelectDepartment('MEN'); setMobileMenuOpen(false); }}
                    className="w-full text-left py-2 px-3 text-neutral-200 hover:bg-neutral-800/50 rounded-lg flex items-center justify-between"
                  >
                    <span>Men's Streetwear (240 GSM)</span>
                    <span className="text-[10px] text-[#FF2028] font-sans font-semibold tabular-nums">{menCount ?? 30} PIECES</span>
                  </button>
                  <button
                    onClick={() => { onSelectDepartment('KIDS'); setMobileMenuOpen(false); }}
                    className="w-full text-left py-2 px-3 text-neutral-200 hover:bg-neutral-800/50 rounded-lg flex items-center justify-between"
                  >
                    <span>Kids' Storywear (Ages 2–13)</span>
                    <span className="text-[10px] text-sky-400 font-sans font-semibold tabular-nums">
                      {kidsComingSoon ? 'COMING SOON' : `${kidsCount ?? 24} PIECES`}
                    </span>
                  </button>
                </>
              )}
              <button
                onClick={() => { onOpenSearch(); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 text-neutral-200 hover:bg-neutral-800/50 rounded-lg flex items-center gap-2"
              >
                <Search className="w-4 h-4 text-neutral-400" />
                <span>Search Catalog</span>
              </button>
              <button
                onClick={() => { onOpenStory(); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 text-neutral-200 hover:bg-neutral-800/50 rounded-lg"
              >
                About TORI-WEAR Brand
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (isLoggedIn) {
                    openAccountModal('ORDER_HISTORY');
                  } else {
                    onOpenTrackOrder();
                  }
                }}
                className="w-full text-left py-2 px-3 text-neutral-200 hover:bg-neutral-800/50 rounded-lg flex items-center justify-between"
              >
                <span>Orders & Invoices</span>
                <span className="text-[10px] bg-red-950 text-red-400 border border-red-800/60 px-1.5 py-0.5 rounded font-mono">HISTORY</span>
              </button>
              <button
                onClick={() => { onOpenTrackOrder(); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 text-neutral-200 hover:bg-neutral-800/50 rounded-lg"
              >
                Track Your Order
              </button>
              {onOpenSizeGuide && (
                <button
                  onClick={() => { onOpenSizeGuide(); setMobileMenuOpen(false); }}
                  className="w-full text-left py-2 px-3 text-neutral-200 hover:bg-neutral-800/50 rounded-lg"
                >
                  Size Guide (Men & Kids)
                </button>
              )}
              <button
                onClick={() => { onOpenContact(); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 text-neutral-200 hover:bg-neutral-800/50 rounded-lg"
              >
                Contact &amp; Support
              </button>
            </div>

            {navCategories.length > 0 && onSelectCategorySlug && (
              <div className="pt-3 border-t border-neutral-800/80">
                <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-2 px-1">
                  CATEGORIES
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {navCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        onSelectCategorySlug(cat.slug);
                        setMobileMenuOpen(false);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-200 hover:text-white cursor-pointer"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mobile Drawer Social Links */}
            <div className="pt-4 border-t border-neutral-800/80">
              <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-2 px-1">
                FOLLOW THE MOVEMENT
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const waHref = buildWhatsAppHref(contactConfig);
                  const activeChannels = (contactConfig?.channels || [])
                    .filter((c) => c.enabled !== false && Boolean(c.url?.trim()))
                    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
                  if (activeChannels.length > 0) {
                    return activeChannels.map((ch) => {
                      const isWa = (ch.platform || '').toLowerCase().includes('whatsapp');
                      const href = isWa && waHref ? waHref : normalizeSocialUrl(ch.url, ch.url);
                      return (
                        <a
                          key={ch.id || ch.platform}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:text-white hover:border-[#FF2028]"
                          aria-label={ch.label || ch.platform}
                        >
                          {renderSocialChannelIcon(ch.platform, 'w-3.5 h-3.5')}
                        </a>
                      );
                    });
                  }
                  return (
                    <>
                      <a
                        href={getAuthoritativeInstagramUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:text-white hover:border-[#FF2028]"
                        aria-label="Instagram"
                      >
                        <InstagramIcon className="w-3.5 h-3.5" />
                      </a>
                      {waHref && (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noreferrer"
                          className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:text-[#25D366] hover:border-[#25D366]"
                          aria-label="WhatsApp"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <a
                        href="https://facebook.com/toriwear"
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:text-sky-400 hover:border-sky-400"
                        aria-label="Facebook"
                      >
                        <FacebookIcon className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href="https://x.com/toriwear"
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:text-white hover:border-neutral-500"
                        aria-label="X"
                      >
                        <XTwitterIcon className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href="https://youtube.com/@toriwear"
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:text-[#FF2028] hover:border-[#FF2028]"
                        aria-label="YouTube"
                      >
                        <YouTubeIcon className="w-3.5 h-3.5" />
                      </a>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

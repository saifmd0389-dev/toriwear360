import fs from 'fs';
import path from 'path';
import { prisma } from '../db/prisma';
import { resolveSecureStorePath } from '../utils/storageHelper';

export interface WebsiteSectionRecord {
  id: string;
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  order: number;
  [key: string]: any;
}

export interface HeroSettingsRecord {
  headline: string;
  subheadline: string;
  ctaText?: string;
  ctaLink?: string;
  secondaryCtaText?: string;
  tertiaryCtaText?: string;
  bgImage?: string;
  mobileImage?: string;
  overlayOpacity?: number;
  preheaderTag?: string;
  preheaderHighlight?: string;
  leftCardTag?: string;
  leftCardTitle?: string;
  leftCardDesc?: string;
  leftCardImage?: string;
  rightCardTag?: string;
  rightCardTitle?: string;
  rightCardDesc?: string;
  rightCardImage?: string;
  trustBadge1?: string;
  trustBadge2?: string;
  trustBadge3?: string;
  [key: string]: any;
}

export interface ContactChannelRecord {
  id: string;
  platform: string;
  label: string;
  valueOrUrl: string;
  url?: string;
  isEnabled: boolean;
  enabled?: boolean;
  displayOrder: number;
  isPrimary?: boolean;
  isCustom?: boolean;
}

export interface MetaBusinessSettingsRecord {
  domainVerificationCode: string;
  pixelId: string;
  capiEnabled: boolean;
}

export interface StoreSettingsRecord {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  whatsappDefaultMessage: string;
  contactChannels: ContactChannelRecord[];
  returnWindowDays: number;
  exchangeEnabled: boolean;
  metaBusiness: MetaBusinessSettingsRecord;
  currency: string;
  taxRatePercent: number;
  freeShippingThreshold: number;
  standardShippingFee: number;
  codFee: number;
  orderPrefix: string;
  maintenanceMode: boolean;
  twoFactorRequiredForStaff: boolean;
  allowGuestCheckout: boolean;
  autoArchiveOutOfStock: boolean;
  gstNumber?: string;
  panNumber?: string;
  registeredAddress?: string;
  operatingHours?: string;
  logoUrl?: string;
  [key: string]: any;
}

export interface FrontPageCmsRecord {
  lastUpdated: string;
  sections: WebsiteSectionRecord[];
  hero: HeroSettingsRecord;
  advertisements: any[];
  tabs: any[];
  realms: any[];
  universe: any;
  characters: any[];
  designStories: any[];
  lookbook: any[];
  socialFeed: any;
  faqs: any[];
  footer: any;
}

const STORE_PATH = resolveSecureStorePath('cms-store.json', 'public/generated-assets/cms-store.json');

export const BASELINE_SECTIONS: WebsiteSectionRecord[] = [
  { id: 'sec-1', key: 'hero', type: 'hero', name: '01. Hero "Wear Your World"', title: '01. Hero "Wear Your World"', description: 'Cinematic hero stage with original character cards and particle canvas', isEnabled: true, order: 1 },
  { id: 'sec-2', key: 'department_portals', type: 'department_portals', name: '02. Visual Department Gateways', title: '02. Visual Department Gateways', description: 'Dual store gateways: Men (30 Drops) vs Kids (24 Drops)', isEnabled: true, order: 2 },
  { id: 'sec-3', key: 'twinning_spotlight', type: 'twinning_spotlight', name: '03. Twinning Duo Soft Highlight', title: '03. Twinning Duo Soft Highlight', description: 'Flagship capsule launch matching duo sets with 15% bundle save', isEnabled: true, order: 3 },
  { id: 'sec-3b', key: 'new_drops', type: 'new_drops', name: '03b. New Drops & Live Vault Releases', title: '03b. New Drops & Live Vault Releases', description: 'Latest capsule releases with direct buy & zoom preview', isEnabled: true, order: 4 },
  { id: 'sec-4', key: 'choose_your_world', type: 'choose_your_world', name: '04. Choose Your World (Realms Preview)', title: '04. Choose Your World (Realms Preview)', description: 'Dark Shonen, Cyberpunk, Retro Y2K, Samurai, Street Anime', isEnabled: true, order: 5 },
  { id: 'sec-5', key: 'tori_universe', type: 'tori_universe', name: '05. The Tori Universe & Lore', title: '05. The Tori Universe & Lore', description: 'Narrative worldbuilding, lore pillars, and Chapter Zero timeline', isEnabled: true, order: 6 },
  { id: 'sec-6', key: 'original_characters', type: 'original_characters', name: '06. Original Characters Profile Roster', title: '06. Original Characters Profile Roster', description: 'Interactive roster profiles (Tori, Ren, Kai, Yuki, Aki, Kami & Zero)', isEnabled: true, order: 7 },
  { id: 'sec-7', key: 'story_behind_designs', type: 'story_behind_designs', name: '07. Story Behind The Designs', title: '07. Story Behind The Designs', description: 'Archival design breakdown for Void Walker, Neon Ronin, 02:17 AM', isEnabled: true, order: 8 },
  { id: 'sec-8', key: 'customer_lookbook', type: 'customer_lookbook', name: '08. Seen in the Real World Lookbook', title: '08. Seen in the Real World Lookbook', description: 'Community street fits with customer ratings and size references', isEnabled: true, order: 9 },
  { id: 'sec-9', key: 'tori_feed', type: 'tori_feed', name: '09. Enter The Tori Feed & Marquee', title: '09. Enter The Tori Feed & Marquee', description: 'Atelier design sketches, concept art notes, and social drop snaps', isEnabled: true, order: 10 },
  { id: 'sec-10', key: 'newsletter', type: 'newsletter', name: '10. Enter The Universe Newsletter', title: '10. Enter The Universe Newsletter', description: 'Drop alerts, chapter access, and instant ₹100 discount coupon', isEnabled: true, order: 11 },
  { id: 'sec-11', key: 'faq', type: 'faq', name: '11. Frequently Asked Questions', title: '11. Frequently Asked Questions', description: 'Original IP clarity, sizing, fabric care, and pan-India shipping', isEnabled: true, order: 12 },
];

export const BASELINE_HERO: HeroSettingsRecord = {
  headline: 'WEAR YOUR WORLD.',
  subheadline: 'Crafted from 240 GSM combed cotton armor with original Tokyo streetwear lore. No generic merch. No fast-fashion compromise.',
  ctaText: 'SHOP MEN',
  ctaLink: '/men',
  bgImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&auto=format&fit=crop&q=80',
  mobileImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
  overlayOpacity: 75,
  preheaderTag: 'ORIGINAL TOKYO-INSPIRED STREETWEAR',
  preheaderHighlight: '240 GSM',
  leftCardTag: 'ORIGINAL LORE · 01',
  leftCardTitle: 'REN // DARK SHONEN',
  leftCardDesc: '“Some people run from the darkness. He learned to walk through it.”',
  leftCardImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
  rightCardTag: 'ORIGINAL LORE · 02',
  rightCardTitle: 'YUKI // CYBERPUNK',
  rightCardDesc: '“Midnight runs through rain-slicked neon alleys of Neo Tokyo.”',
  rightCardImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
  secondaryCtaText: 'SHOP KIDS',
  tertiaryCtaText: 'TRY TWIN COMBO 👯',
  tertiaryCtaBadge: 'SAVE 10%',
  trustBadge1: '240 GSM Combed Cotton',
  trustBadge2: '100% Original Japanese Anime IP',
  trustBadge3: 'Free Pan-India Delivery Over ₹999',
};

export const BASELINE_TABS = [
  { id: 'tab-nav-home', category: 'HEADER_NAV', label: 'Home', targetLink: '/', enabled: true, order: 1 },
  { id: 'tab-nav-men', category: 'HEADER_NAV', label: 'Shop Men', targetLink: '/men', badge: '30 DROPS', enabled: true, order: 2 },
  { id: 'tab-nav-kids', category: 'HEADER_NAV', label: 'Shop Kids', targetLink: '/kids', badge: '24 DROPS', enabled: true, order: 3 },
  { id: 'tab-nav-worlds', category: 'HEADER_NAV', label: 'Worlds', targetLink: '#choose-your-world-section', enabled: true, order: 4 },
  { id: 'tab-nav-lore', category: 'HEADER_NAV', label: 'Tori Lore', targetLink: '#tori-universe-section', enabled: true, order: 5 },
  { id: 'tab-nav-lookbook', category: 'HEADER_NAV', label: 'Lookbook', targetLink: '#customer-lookbook-section', badge: 'COMMUNITY', enabled: true, order: 6 },
  { id: 'tab-nav-faq', category: 'HEADER_NAV', label: 'FAQs', targetLink: '#faq-section', enabled: true, order: 7 },

  { id: 'tab-dept-all', category: 'DEPARTMENT_SWITCHER', label: 'Storefront Home', targetLink: '/', icon: 'Sparkles', enabled: true, order: 1, description: 'First Page with Brand Lore & Visual Portals' },
  { id: 'tab-dept-men', category: 'DEPARTMENT_SWITCHER', label: "Men's Vault", targetLink: '/men', badge: '30 Drops', icon: 'Flame', enabled: true, order: 2, description: "Dedicated Men's 240 GSM Streetwear Catalogue" },
  { id: 'tab-dept-kids', category: 'DEPARTMENT_SWITCHER', label: "Kids' Realm", targetLink: '/kids', badge: '24 Drops', icon: 'Smile', enabled: true, order: 3, description: "Dedicated Kids' Heavyweight Anime Apparel" },

  { id: 'tab-realm-shonen', category: 'REALM_WORLDS', label: 'Dark Shonen', targetLink: '/men?world=Dark+Shonen', badge: 'Popular', icon: '⚔️', enabled: true, order: 1, description: 'Solo Leveling, Jujutsu & Chainsaw aesthetics' },
  { id: 'tab-realm-cyberpunk', category: 'REALM_WORLDS', label: 'Cyberpunk Neo Tokyo', targetLink: '/men?world=Cyberpunk', badge: 'Futuristic', icon: '⚡', enabled: true, order: 2, description: 'Akira & Ghost in the Shell neon rainy alleys' },
  { id: 'tab-realm-retro', category: 'REALM_WORLDS', label: 'Retro Anime / Y2K', targetLink: '/men?world=Retro+Y2K', badge: 'Classic', icon: '📼', enabled: true, order: 3, description: 'Cowboy Bebop & Evangelion nostalgic typography' },
  { id: 'tab-realm-samurai', category: 'REALM_WORLDS', label: 'Samurai & Mythic', targetLink: '/men?world=Samurai', badge: 'Heritage', icon: '⛩️', enabled: true, order: 4, description: 'Vagabond & Demon Slayer brushstrokes' },
  { id: 'tab-realm-street', category: 'REALM_WORLDS', label: 'Street & Slice-of-Life', targetLink: '/men?world=Street', badge: 'Urban', icon: '🛹', enabled: true, order: 5, description: 'Tokyo Revengers raw youth streetwear culture' },

  { id: 'tab-lookbook-all', category: 'LOOKBOOK_FILTER', label: 'All Community Fits', targetLink: 'ALL', enabled: true, order: 1 },
  { id: 'tab-lookbook-men', category: 'LOOKBOOK_FILTER', label: "Men's Streetwear Fits", targetLink: 'MEN', enabled: true, order: 2 },
  { id: 'tab-lookbook-kids', category: 'LOOKBOOK_FILTER', label: 'Kids & Family Sets', targetLink: 'KIDS', enabled: true, order: 3 },
  { id: 'tab-lookbook-campus', category: 'LOOKBOOK_FILTER', label: 'Campus & Creator Fits', targetLink: 'CAMPUS', enabled: true, order: 4 },
];

export const BASELINE_CONTACT_CHANNELS: ContactChannelRecord[] = [
  { id: 'ch-whatsapp', platform: 'WHATSAPP', label: 'WhatsApp Concierge', valueOrUrl: '+91 98201 45112', isEnabled: true, displayOrder: 1, isPrimary: true },
  { id: 'ch-email', platform: 'EMAIL', label: 'Support Email', valueOrUrl: 'care@toriwear.com', isEnabled: true, displayOrder: 2, isPrimary: true },
  { id: 'ch-phone', platform: 'PHONE', label: 'Customer Care Line', valueOrUrl: '+91 98201 45112', isEnabled: true, displayOrder: 3 },
  { id: 'ch-instagram', platform: 'INSTAGRAM', label: 'Instagram', valueOrUrl: 'https://instagram.com/toriwear', isEnabled: true, displayOrder: 4 },
  { id: 'ch-facebook', platform: 'FACEBOOK', label: 'Facebook', valueOrUrl: 'https://facebook.com/toriwear', isEnabled: true, displayOrder: 5 },
  { id: 'ch-twitter', platform: 'TWITTER', label: 'X / Twitter', valueOrUrl: 'https://x.com/toriwear', isEnabled: true, displayOrder: 6 },
  { id: 'ch-youtube', platform: 'YOUTUBE', label: 'YouTube', valueOrUrl: 'https://youtube.com/@toriwear', isEnabled: true, displayOrder: 7 },
  { id: 'ch-discord', platform: 'DISCORD', label: 'Discord Community', valueOrUrl: 'https://discord.gg/toriwear', isEnabled: true, displayOrder: 8 },
];

export const BASELINE_SETTINGS: StoreSettingsRecord = {
  storeName: 'TORI WEAR Atelier',
  tagline: '240 GSM Heavyweight Japanese Anime Streetwear',
  supportEmail: 'care@toriwear.com',
  supportPhone: '+91 98201 45112',
  whatsappNumber: '+91 98201 45112',
  whatsappDefaultMessage: "Hey TORI-WEAR! I'd like help with my order / sizing.",
  contactChannels: BASELINE_CONTACT_CHANNELS,
  returnWindowDays: 7,
  exchangeEnabled: true,
  metaBusiness: {
    domainVerificationCode: '',
    pixelId: '',
    capiEnabled: false,
  },
  currency: 'INR',
  taxRatePercent: 5.0,
  freeShippingThreshold: 999,
  standardShippingFee: 79,
  codFee: 50,
  orderPrefix: 'TORI-',
  maintenanceMode: false,
  twoFactorRequiredForStaff: false,
  allowGuestCheckout: true,
  autoArchiveOutOfStock: false,
  gstNumber: '37AAACT1234A1Z5',
  panNumber: 'AAACT1234A',
  registeredAddress: 'Atelier Tori Wear, Beach Road Heights, Visakhapatnam, Andhra Pradesh 530018',
  operatingHours: 'Mon - Sat: 10:00 AM - 8:00 PM IST',
  logoUrl: '/assets/branding/toriwear-official-logo.png',
};

export class CmsRepository {
  private frontPageData: FrontPageCmsRecord | null = null;
  private storeSettings: StoreSettingsRecord | null = null;
  private initialized = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor() {
    this.ensureLoaded();
  }

  private normalizeSettings(raw: Partial<StoreSettingsRecord> | null | undefined): StoreSettingsRecord {
    const base = { ...BASELINE_SETTINGS };
    const merged: StoreSettingsRecord = {
      ...base,
      ...(raw || {}),
      contactChannels: Array.isArray(raw?.contactChannels) && raw.contactChannels.length > 0
        ? raw.contactChannels.map((c: any, idx: number) => {
            const val = String(c?.valueOrUrl ?? c?.url ?? '').trim();
            const active = c?.isEnabled !== undefined ? c.isEnabled !== false : c?.enabled !== false;
            return {
              id: String(c?.id || `ch-${idx + 1}`),
              platform: String(c?.platform || 'CUSTOM').toUpperCase(),
              label: String(c?.label || 'Channel').trim(),
              valueOrUrl: val,
              url: val,
              isEnabled: active,
              enabled: active,
              displayOrder: Number.isFinite(Number(c?.displayOrder)) ? Number(c.displayOrder) : idx + 1,
              isPrimary: Boolean(c?.isPrimary),
              isCustom: Boolean(c?.isCustom),
            };
          }).sort((a, b) => a.displayOrder - b.displayOrder)
        : BASELINE_CONTACT_CHANNELS.map((c) => ({ ...c, url: c.valueOrUrl, enabled: c.isEnabled })),
      returnWindowDays: Math.max(1, Math.min(60, Number(raw?.returnWindowDays || base.returnWindowDays || 7))),
      exchangeEnabled: raw?.exchangeEnabled !== undefined ? Boolean(raw.exchangeEnabled) : true,
      metaBusiness: {
        domainVerificationCode: String(raw?.metaBusiness?.domainVerificationCode || '').trim(),
        pixelId: String(raw?.metaBusiness?.pixelId || '').replace(/[^0-9a-zA-Z_-]/g, '').trim(),
        capiEnabled: Boolean(raw?.metaBusiness?.capiEnabled),
      },
    };
    return merged;
  }

  private ensureLoaded() {
    if (this.initialized) return;

    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.frontPage) {
          this.buildDefaults();
          const normalized = this.normalizeFrontPage(parsed.frontPage, this.frontPageData!);
          this.frontPageData = normalized;
          this.storeSettings = this.normalizeSettings(parsed.storeSettings);
          this.initialized = true;
          return;
        }
      }
    } catch (err) {
      console.warn('[CmsRepo] Could not load cms store file, building defaults:', err);
    }

    this.buildDefaults();
    this.saveToDisk();
    this.initialized = true;
  }

  private normalizeSections(sections: any[]): WebsiteSectionRecord[] {
    if (!Array.isArray(sections) || sections.length === 0) return BASELINE_SECTIONS;
    return sections.map((s: any, idx: number) => {
      const base = BASELINE_SECTIONS.find((b) => b.id === s.id || b.key === s.key || b.key === s.type);
      const resolvedKey = s.key || s.type || base?.key || `section_${idx + 1}`;
      const resolvedName = s.name || s.title || base?.name || resolvedKey;
      return {
        ...base,
        ...s,
        key: resolvedKey,
        type: s.type || resolvedKey,
        name: resolvedName,
        title: s.title || resolvedName,
        description: s.description ?? base?.description ?? '',
        isEnabled: s.isEnabled !== undefined ? Boolean(s.isEnabled) : true,
        order: Number(s.order) || idx + 1,
      };
    });
  }

  private normalizeTabs(tabs: any[]): any[] {
    if (!Array.isArray(tabs)) return BASELINE_TABS;
    const categories = ['HEADER_NAV', 'DEPARTMENT_SWITCHER', 'REALM_WORLDS', 'LOOKBOOK_FILTER'];
    const result = [...tabs];
    for (const cat of categories) {
      const hasCat = result.some((t) => t && t.category === cat);
      if (!hasCat) {
        result.push(...BASELINE_TABS.filter((t) => t.category === cat));
      }
    }
    return result;
  }

  private normalizeFrontPage(input: any, fallback: FrontPageCmsRecord): FrontPageCmsRecord {
    const raw = input?.frontPage ? input.frontPage : input || {};
    return {
      ...fallback,
      ...raw,
      lastUpdated: typeof raw.lastUpdated === 'string' && raw.lastUpdated.trim()
        ? raw.lastUpdated
        : (fallback.lastUpdated || new Date().toISOString()),
      sections: Array.isArray(raw.sections) ? this.normalizeSections(raw.sections) : fallback.sections,
      hero: { ...BASELINE_HERO, ...(fallback.hero || {}), ...(raw.hero || {}) },
      advertisements: Array.isArray(raw.advertisements) ? raw.advertisements : fallback.advertisements,
      tabs: Array.isArray(raw.tabs) ? this.normalizeTabs(raw.tabs) : fallback.tabs,
      realms: Array.isArray(raw.realms) ? raw.realms : fallback.realms,
      universe: {
        ...fallback.universe,
        ...(raw.universe || {}),
        pillars: Array.isArray(raw.universe?.pillars) ? raw.universe.pillars : (fallback.universe?.pillars || []),
        chapters: Array.isArray(raw.universe?.chapters) ? raw.universe.chapters : (fallback.universe?.chapters || []),
      },
      characters: Array.isArray(raw.characters) ? raw.characters : fallback.characters,
      designStories: Array.isArray(raw.designStories) ? raw.designStories : fallback.designStories,
      lookbook: Array.isArray(raw.lookbook) ? raw.lookbook : fallback.lookbook,
      socialFeed: {
        ...fallback.socialFeed,
        ...(raw.socialFeed || {}),
        marqueePhrases: Array.isArray(raw.socialFeed?.marqueePhrases)
          ? raw.socialFeed.marqueePhrases
          : (fallback.socialFeed?.marqueePhrases || []),
        posts: Array.isArray(raw.socialFeed?.posts)
          ? raw.socialFeed.posts
          : (fallback.socialFeed?.posts || []),
      },
      faqs: Array.isArray(raw.faqs) ? raw.faqs : fallback.faqs,
      footer: {
        ...fallback.footer,
        ...(raw.footer || {}),
        socialLinks: Array.isArray(raw.footer?.socialLinks)
          ? raw.footer.socialLinks
          : (fallback.footer?.socialLinks || []),
        trustBadges: Array.isArray(raw.footer?.trustBadges)
          ? raw.footer.trustBadges
          : (fallback.footer?.trustBadges || []),
      },
    };
  }

  private buildDefaults() {
    this.frontPageData = {
      lastUpdated: new Date().toISOString(),
      sections: BASELINE_SECTIONS,
      hero: BASELINE_HERO,
      advertisements: [
        {
          id: 'ad-announcement-top',
          title: 'Top Sticky Header Announcement Ticker',
          type: 'TOP_ANNOUNCEMENT',
          enabled: true,
          headline: '🔥 FREE SHIPPING ALL OVER INDIA ON ORDERS ABOVE ₹999 | CASH ON DELIVERY AVAILABLE',
          badge: 'LIMITED TIME',
          linkUrl: '/men',
          bgColor: '#FF2028',
          textColor: '#FFFFFF',
        },
        {
          id: 'ad-welcome-popup',
          title: 'Welcome Promo Code Modal (TORI100)',
          type: 'POPUP_MODAL',
          enabled: false,
          headline: 'WELCOME TO THE TORI UNIVERSE',
          tagline: 'Claim your first streetwear drop discount',
          description: 'Get flat ₹100 OFF on your first purchase of 240 GSM heavyweight Japanese anime streetwear.',
          promoCode: 'TORI100',
          discountValue: '₹100 OFF',
          badge: 'FIRST ORDER',
          ctaText: 'CLAIM ₹100 DISCOUNT',
          imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
        },
        {
          id: 'ad-twinning-duo',
          title: 'Twinning Duo Matching Set Promo Spotlight',
          type: 'TWINNING_SPOTLIGHT',
          enabled: true,
          headline: 'TWINNING WITH YOUR MINI HERO',
          tagline: 'Matching Men & Kids Streetwear Duo Sets',
          description: 'Upgrade your bond with perfectly synchronized 240 GSM heavyweight graphic tees. Pair any Men & Kids tee for an automatic bundle discount.',
          badge: 'BUNDLE & SAVE 15%',
          discountValue: 'FLAT 15% OFF',
          ctaText: 'EXPLORE TWINNING COMBOS 👯',
          imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=1200&auto=format&fit=crop&q=80',
          linkUrl: '#twinning-spotlight',
        },
        {
          id: 'ad-flash-sale-strip',
          title: 'Midnight Tokyo Flash Sale Strip Banner',
          type: 'SALE_BANNER',
          enabled: true,
          headline: 'MIDNIGHT TOKYO FLASH DROP',
          tagline: 'Flat 20% Off All Heavyweight Anime Oversized Tees',
          badge: 'ENDING MIDNIGHT',
          discountValue: '20% OFF',
          ctaText: 'SHOP FLASH SALE →',
          imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1200&auto=format&fit=crop&q=80',
          linkUrl: '/men',
        },
      ],
      tabs: [...BASELINE_TABS],
      realms: [
        {
          id: 'realm-shonen',
          title: 'DARK SHONEN',
          department: 'MEN',
          tag: 'HEAVYWEIGHT COMBAT',
          badge: 'CHAPTER 01',
          japanese: '暗黒少年',
          numberBadge: '01',
          franchiseVibe: 'Shadow Monarch, Jujutsu Cursed Spirits & Demonic Auras',
          description: 'Power. Rivalry. Shadows. Awakening.',
          detailedLore: 'Obsidian silhouettes, raw power, and high-density puff print dark energy flares.',
          bannerImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=80',
          accentColor: '#9333ea',
          ctaText: 'SHOP WORLD →',
          worldId: 'DARK SHONEN',
          bgGradient: 'from-purple-950/70 via-neutral-950 to-[#0A0A0A]',
          enabled: true,
          order: 1,
        },
        {
          id: 'realm-cyberpunk',
          title: 'CYBERPUNK',
          department: 'MEN',
          tag: 'GLITCH & WIREFRAME',
          badge: 'PROTOCOL 2087',
          japanese: '新東京サイバー',
          numberBadge: '02',
          franchiseVibe: 'Akira, Neon Kaneda Bikes & Netrunner Holograms',
          description: 'Neon cities. Machines. Midnight energy.',
          detailedLore: 'Rain-slicked asphalt, digital loneliness, and cybernetic kanji prints on 240 GSM blanks.',
          bannerImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1000&auto=format&fit=crop&q=80',
          accentColor: '#06b6d4',
          ctaText: 'SHOP WORLD →',
          worldId: 'CYBERPUNK / NEO TOKYO',
          bgGradient: 'from-cyan-950/70 via-neutral-950 to-[#0A0A0A]',
          enabled: true,
          order: 2,
        },
        {
          id: 'realm-retro',
          title: 'RETRO Y2K',
          department: 'MEN',
          tag: 'VINTAGE VHS GRAIN',
          badge: 'ANALOG CORE',
          japanese: '世紀末レトロ',
          numberBadge: '03',
          franchiseVibe: 'Cowboy Bebop, Trigun, Neon Genesis & Late-90s Lo-Fi',
          description: 'CRT screens. Arcade nights. Analog memories.',
          detailedLore: 'Scanlines, 1999 dial-up artifacts, and early internet glitch graphics.',
          bannerImage: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1000&auto=format&fit=crop&q=80',
          accentColor: '#ec4899',
          ctaText: 'SHOP WORLD →',
          worldId: 'RETRO Y2K',
          bgGradient: 'from-pink-950/70 via-neutral-950 to-[#0A0A0A]',
          enabled: true,
          order: 3,
        },
        {
          id: 'realm-samurai',
          title: 'SAMURAI',
          department: 'MEN',
          tag: 'SUMI-E BRUSHWORK',
          badge: 'MYTHIC RONIN',
          japanese: '武士神話',
          numberBadge: '04',
          franchiseVibe: 'Vagabond, Oni Demons, Katana Ronin & Cherry Blossoms',
          description: 'Ronin spirit. Ancient symbols. Future steel.',
          detailedLore: 'Sumi-e calligraphy and vermilion seals meeting modern drop-shoulder cuts.',
          bannerImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=1000&auto=format&fit=crop&q=80',
          accentColor: '#ef4444',
          ctaText: 'SHOP WORLD →',
          worldId: 'SAMURAI / MYTHIC JAPAN',
          bgGradient: 'from-red-950/70 via-neutral-950 to-[#0A0A0A]',
          enabled: true,
          order: 4,
        },
        {
          id: 'realm-street',
          title: 'STREET ANIME',
          department: 'MEN',
          tag: 'ORIGINAL IP',
          badge: 'GENESIS IP',
          japanese: '街頭原創',
          numberBadge: '05',
          franchiseVibe: 'Everyday Manga Heroes, Harajuku & Tokyo Streetwear',
          description: 'Everyday characters. Manga energy. Urban style.',
          detailedLore: 'Minimalist front chest emblems, full architectural manga panel back layouts.',
          bannerImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000&auto=format&fit=crop&q=80',
          accentColor: '#FF2028',
          ctaText: 'SHOP WORLD →',
          worldId: 'STREET ANIME',
          bgGradient: 'from-rose-950/70 via-neutral-950 to-[#0A0A0A]',
          enabled: true,
          order: 5,
        },
      ],
      universe: {
        headline: 'THE TORI UNIVERSE // CHAPTER ZERO',
        subheadline: 'A narrative universe told through wearable artifacts.',
        narrativeText: 'TORI WEAR was not born in a fast-fashion boardroom. It was forged in late-night sketchbooks, anime studio sessions, and the neon-lit crossroads of Shibuya and Akihabara. Every capsule drop is an archival chapter of our original shonen mythos.',
        quote: '“We do not print trendy cartoons. We build the physical armor of our own anime world.”',
        bannerImage: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1400&auto=format&fit=crop&q=80',
        pillars: [
          { id: 'pil-1', num: '01', title: 'WEAR YOUR WORLD', description: 'Clothes as self-expression, not conformity. Bold identities for true shonen spirits.', icon: 'Shield' },
          { id: 'pil-2', num: '02', title: 'HEAVYWEIGHT 240 GSM', description: 'Thick, structured combed cotton that keeps its drape wash after wash. Zero cling.', icon: 'CheckCircle2' },
          { id: 'pil-3', num: '03', title: '100% ORIGINAL JAPANESE IP', description: 'Authentic anime concepts designed in-house with dedicated lore and character backstories.', icon: 'Sparkles' },
        ],
        chapters: [
          { id: 'chap-1', chapterNumber: 'CHAPTER 01', title: 'THE AWAKENING', era: 'NEO TOKYO 2099', excerpt: 'Ren discovers the cursed core in the subterranean transit ruins beneath Shinjuku.', bannerImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80', enabled: true, order: 1 },
          { id: 'chap-2', chapterNumber: 'CHAPTER 02', title: 'NEON SHADOWS', era: 'SHIBUYA SECTOR 4', excerpt: 'Yuki intercepts illegal cyber-augment code transmitted across high-voltage tram lines.', bannerImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80', enabled: true, order: 2 },
          { id: 'chap-3', chapterNumber: 'CHAPTER 03', title: 'BLOOD MOON RONIN', era: 'KYOTO SANCTUARY', excerpt: 'Kai honors the ancient oath, drawing his plasma katana against the shadow swarm.', bannerImage: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?w=800&auto=format&fit=crop&q=80', enabled: true, order: 3 },
        ],
      },
      characters: [
        { id: 'char-ren', name: 'REN // 蓮', title: 'Dark Shonen Protagonist', japaneseTitle: '影の継承者 (Shadow Inheritor)', avatarImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80', quote: '“Some people run from the darkness. He learned to walk through it.”', backstory: 'Wields the obsidian shadow monarch pulse. Prefers oversized boxy silhouettes in pitch black and blood crimson.', weaponAesthetic: 'Dual Shadow Daggers // Heavyweight Armor', stats: { fabricGsm: '240 GSM Combed Cotton', loreLevel: 'Rank S+ Protagonist', agilityVibe: 'Relentless Kinetic Will' }, enabled: true, order: 1 },
        { id: 'char-yuki', name: 'YUKI // 雪', title: 'Cyberpunk Netrunner & Tactician', japaneseTitle: 'サイバーネットランナー (Cyber Netrunner)', avatarImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80', quote: '“Midnight runs through rain-slicked neon alleys of Neo Tokyo.”', backstory: 'Navigates high-frequency data streams while gliding over rainy rooftops in holographic techwear.', weaponAesthetic: 'Data Overdrive Gauntlets // Cyan Wireframes', stats: { fabricGsm: '240 GSM Matte Finish', loreLevel: 'Cyber Tactician Rank A', agilityVibe: 'Sub-Zero Velocity' }, enabled: true, order: 2 },
        { id: 'char-kai', name: 'KAI // 魁', title: 'Neo-Samurai Ronin', japaneseTitle: '放浪の侍 (Wandering Ronin)', avatarImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80', quote: '“The blade remembers the stroke long after the samurai rests.”', backstory: 'A ronin who merged traditional bushido swordcraft with high-frequency particle plasma edges.', weaponAesthetic: 'Single-Edge Plasma Katana // Kimono Draping', stats: { fabricGsm: '240 GSM Reinforced Seams', loreLevel: 'Master Swordsman', agilityVibe: 'Instantaneous Decapitation' }, enabled: true, order: 3 },
      ],
      designStories: [
        { id: 'story-void-walker', title: 'VOID WALKER // 01', capsuleCode: 'CAPSULE-SHONEN-2026', concept: 'Inspired by solo shadow ascension under purple dimensional rifts.', fabricSpec: '240 GSM pure combed cotton with bio-wash enzyme rinse for velvety handfeel.', printTechnology: 'High-density screen printing with crack-resistant plastisol cure.', heroImage: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80', enabled: true, order: 1 },
        { id: 'story-neon-ronin', title: 'NEON RONIN // 02', capsuleCode: 'CAPSULE-CYBER-2026', concept: 'The clash of ancient woodblock wave prints with circuit board cybernetics.', fabricSpec: '240 GSM heavyweight structure ensuring the collar never curls or sags.', printTechnology: 'Metallic foil overlay and glow-in-the-dark neon screen inks.', heroImage: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80', enabled: true, order: 2 },
      ],
      lookbook: [
        { id: 'lb-1', customerHandle: '@saif_fits', location: 'Visakhapatnam Beach Road', caption: '240 GSM hits different. The drop shoulder boxy drape is perfection for coastal evening breezes.', sizeWorn: 'Size XL (Height 6\'1")', rating: 5, taggedDrop: 'Shadow Monarch Oversized Tee', imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80', category: 'MEN', enabled: true, order: 1 },
        { id: 'lb-2', customerHandle: '@yuki_streetwear', location: 'Bangalore Cyber Hub', caption: 'Finally anime apparel that doesn\'t look like cheap printed polyester. Heavyweight cotton feels like armor.', sizeWorn: 'Size L (Height 5\'10")', rating: 5, taggedDrop: 'Cyberpunk Neo Tokyo Heavyweight', imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80', category: 'CAMPUS', enabled: true, order: 2 },
        { id: 'lb-3', customerHandle: '@arjun_and_mini', location: 'Mumbai Bandra West', caption: 'Twinning duo set with my 7-year-old son! He loves his Mecha bot tee, and mine fits like high-end streetwear.', sizeWorn: 'Men XL + Kids 7-8Y', rating: 5, taggedDrop: 'Twinning Duo Matching Set', imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80', category: 'KIDS', enabled: true, order: 3 },
      ],
      socialFeed: {
        marqueePhrases: [
          'TOKYO LORE // 240 GSM HEAVYWEIGHT',
          'ORIGINAL JAPANESE ANIME IP',
          'NO GENERIC MERCH',
          'FREE SHIPPING ALL OVER INDIA',
          'WEAR YOUR WORLD',
          'DROP 01 LIVE NOW',
          'AUTHENTIC STREETWEAR ATELIER',
        ],
        posts: [
          { id: 'post-1', handle: '@toriwear.official', caption: 'Late night atelier test print on 240 GSM obsidian cotton. The high density screen lines are razor sharp.', imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80', likes: 1420, platform: 'Instagram', linkUrl: 'https://instagram.com', enabled: true },
          { id: 'post-2', handle: '@toriwear.official', caption: 'Ren character study in ink. We sketch each manga panel by hand before color separations.', imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80', likes: 2180, platform: 'Instagram', linkUrl: 'https://instagram.com', enabled: true },
          { id: 'post-3', handle: '@toriwear.official', caption: 'Kids adventure drop packaging ready for dispatch across pan-India hubs. Heavy duty polybags.', imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&auto=format&fit=crop&q=80', likes: 980, platform: 'Instagram', linkUrl: 'https://instagram.com', enabled: true },
        ],
      },
      faqs: [
        { id: 'faq-1', category: 'SIZING_FABRIC', question: 'What does 240 GSM combed cotton mean?', answer: 'GSM stands for grams per square meter. Standard market tees range from 160-180 GSM, which can feel thin and limp. TORI WEAR uses custom 240 GSM heavy combed cotton: it creates a structured boxy silhouette, drapes without clinging to the body, and endures dozens of washes without warping.', enabled: true, order: 1 },
        { id: 'faq-2', category: 'AUTHENTICITY_IP', question: 'Are TORI WEAR designs officially licensed or original?', answer: 'All TORI WEAR artwork, character profiles, typography, and lore pillars are 100% original creations designed by our in-house Tokyo-inspired atelier. We do not use pirated screenshots or generic AI clipart.', enabled: true, order: 2 },
        { id: 'faq-3', category: 'ORDERS_SHIPPING', question: 'How fast is delivery across India?', answer: 'Orders are dispatched within 24 hours from our fulfillment hub. Metro cities (Mumbai, Delhi, Bangalore, Hyderabad, Chennai) receive orders in 2-3 business days. Rest of India typically arrives in 4-6 business days with live tracking via BlueDart and Delhivery.', enabled: true, order: 3 },
        { id: 'faq-4', category: 'RETURNS_EXCHANGES', question: 'Can I return or exchange for a different size?', answer: 'Yes! We offer a hassle-free 7-day doorstep return and exchange policy. You can initiate a size exchange or return directly from your Order History tab with photo verification. Our reverse courier picks it up straight from your address.', enabled: true, order: 4 },
        { id: 'faq-5', category: 'ORDERS_SHIPPING', question: 'Is Cash on Delivery (COD) available?', answer: 'Yes, Cash on Delivery is available across 19,000+ PIN codes in India. You can also pay seamlessly via UPI, credit/debit cards, and net banking with instant confirmation.', enabled: true, order: 5 },
      ],
      footer: {
        brandTagline: 'ORIGINAL TOKYO-INSPIRED STREETWEAR // 240 GSM HEAVYWEIGHT',
        aboutBlurb: 'TORI WEAR is an independent Japanese anime streetwear atelier crafting physical armor from custom 240 GSM combed cotton. Built for creators, otakus, and urban nightrunners.',
        supportEmail: 'care@toriwear.com',
        supportPhone: '+91 98201 45112',
        atelierAddress: 'Atelier Tori Wear, Beach Road Heights, Visakhapatnam, Andhra Pradesh 530018',
        operatingHours: 'Mon - Sat: 10:00 AM - 8:00 PM IST',
        copyrightText: '© 2026 TORI WEAR ATELIER. ALL RIGHTS RESERVED. REGISTERED TRADEMARK.',
        socialLinks: [
          { platform: 'Instagram', url: 'https://instagram.com/toriwear', enabled: true },
          { platform: 'Twitter / X', url: 'https://x.com/toriwear', enabled: true },
          { platform: 'Discord Community', url: 'https://discord.gg/toriwear', enabled: true },
          { platform: 'YouTube Anime Studio', url: 'https://youtube.com/@toriwear', enabled: true },
        ],
        trustBadges: [
          { id: 'tb-1', title: '100% Combed Cotton', subtitle: '240 GSM Heavy Armor', icon: 'Shield' },
          { id: 'tb-2', title: 'Safe & Secure Checkout', subtitle: '256-Bit SSL Encryption', icon: 'Lock' },
          { id: 'tb-3', title: 'Doorstep 7-Day Returns', subtitle: 'Hassle-Free Exchange', icon: 'RotateCcw' },
          { id: 'tb-4', title: 'Cash on Delivery', subtitle: 'Available Pan-India', icon: 'Truck' },
        ],
      },
    };

    this.storeSettings = { ...BASELINE_SETTINGS };
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        frontPage: this.frontPageData,
        storeSettings: this.storeSettings,
      };
      const tmpPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, STORE_PATH);
    } catch (err) {
      console.error('[CmsRepo] Failed to save CMS data to disk:', err);
      throw err;
    }
  }

  private async enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeChain.then(task, task);
    this.writeChain = run.then(() => undefined, () => undefined);
    return run;
  }

  async getFrontPageData(): Promise<FrontPageCmsRecord> {
    this.ensureLoaded();
    return this.frontPageData!;
  }

  async saveFrontPageData(data: Partial<FrontPageCmsRecord>, actorId?: string): Promise<FrontPageCmsRecord> {
    return this.enqueueWrite(async () => {
      this.ensureLoaded();
      const next = this.normalizeFrontPage(
        {
          ...(data || {}),
          lastUpdated: new Date().toISOString(),
        },
        this.frontPageData!
      );
      this.frontPageData = next;
      this.saveToDisk();

    // Sync to Prisma HomepageSection and WebsiteBanner if connected
    try {
      if (prisma && prisma.homepageSection && Array.isArray(this.frontPageData.sections)) {
        for (const s of this.frontPageData.sections) {
          await prisma.homepageSection.upsert({
            where: { sectionKey: s.key },
            create: {
              sectionKey: s.key,
              title: s.name,
              subtitle: s.description,
              enabled: s.isEnabled,
              displayOrder: s.order,
              configJson: JSON.stringify(s),
            },
            update: {
              title: s.name,
              subtitle: s.description,
              enabled: s.isEnabled,
              displayOrder: s.order,
              configJson: JSON.stringify(s),
            },
          }).catch(() => {});
        }
      }

      if (prisma && prisma.websiteBanner && this.frontPageData.hero) {
        await prisma.websiteBanner.upsert({
          where: { bannerKey: 'homepage_hero' },
          create: {
            bannerKey: 'homepage_hero',
            headline: this.frontPageData.hero.headline,
            subheadline: this.frontPageData.hero.subheadline,
            ctaText: this.frontPageData.hero.ctaText,
            ctaLink: this.frontPageData.hero.ctaLink,
            bgImageUrl: this.frontPageData.hero.bgImage,
            isLive: true,
          },
          update: {
            headline: this.frontPageData.hero.headline,
            subheadline: this.frontPageData.hero.subheadline,
            ctaText: this.frontPageData.hero.ctaText,
            ctaLink: this.frontPageData.hero.ctaLink,
            bgImageUrl: this.frontPageData.hero.bgImage,
          },
        }).catch(() => {});
      }
    } catch {}

    console.log(`[CmsRepo] ✅ Frontpage CMS saved by ${actorId || 'STAFF'}`);
    return this.frontPageData!;
    });
  }

  async updateSections(sections: WebsiteSectionRecord[], actorId?: string): Promise<WebsiteSectionRecord[]> {
    return this.enqueueWrite(async () => {
      this.ensureLoaded();
      const normalized = this.normalizeSections(sections);
      this.frontPageData = {
        ...this.frontPageData!,
        sections: normalized,
        lastUpdated: new Date().toISOString(),
      };
      this.saveToDisk();
      console.log(`[CmsRepo] 📋 Sections architecture updated (${normalized.length} sections) by ${actorId || 'STAFF'}`);
      return normalized;
    });
  }

  async updateHero(hero: HeroSettingsRecord, actorId?: string): Promise<HeroSettingsRecord> {
    return this.enqueueWrite(async () => {
      this.ensureLoaded();
      const mergedHero = {
        ...BASELINE_HERO,
        ...(this.frontPageData?.hero || {}),
        ...hero,
      };
      this.frontPageData = {
        ...this.frontPageData!,
        hero: mergedHero,
        lastUpdated: new Date().toISOString(),
      };
      this.saveToDisk();
      console.log(`[CmsRepo] 🖼️ Hero settings updated by ${actorId || 'STAFF'}`);
      return mergedHero;
    });
  }

  async resetToDefaults(actorId?: string): Promise<FrontPageCmsRecord> {
    return this.enqueueWrite(async () => {
      this.buildDefaults();
      this.saveToDisk();
      console.log(`[CmsRepo] 🔄 Reset CMS to factory defaults by ${actorId || 'STAFF'}`);
      return this.frontPageData!;
    });
  }

  async getStoreSettings(): Promise<StoreSettingsRecord> {
    this.ensureLoaded();
    return this.storeSettings!;
  }

  async getPublicContactConfig(includeDisabledChannels = false) {
    this.ensureLoaded();
    const s = this.storeSettings!;
    const fpFooter = this.frontPageData?.footer || {};
    const allChannels = (s.contactChannels || [])
      .map((c, idx) => {
        const resolvedUrl = String(c.valueOrUrl || c.url || '').trim();
        const enabledFlag = c.isEnabled !== false && c.enabled !== false;
        return {
          ...c,
          url: resolvedUrl,
          valueOrUrl: resolvedUrl,
          enabled: enabledFlag,
          isEnabled: enabledFlag,
          displayOrder: Number.isFinite(Number(c.displayOrder)) ? Number(c.displayOrder) : idx + 1,
        };
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const orderedChannels = includeDisabledChannels
      ? allChannels
      : allChannels.filter((c) => c.enabled && Boolean(c.url));

    const whatsappChannel = allChannels.find((c) => c.enabled && c.platform === 'WHATSAPP');
    const whatsappRaw = whatsappChannel?.url || s.whatsappNumber || s.supportPhone || '';
    const whatsappDigits = whatsappRaw.replace(/\D/g, '');
    const emailChannel = allChannels.find((c) => c.enabled && c.platform === 'EMAIL');
    const phoneChannel = allChannels.find((c) => c.enabled && c.platform === 'PHONE');
    const resolvedEmail = emailChannel?.url || s.supportEmail || fpFooter.supportEmail || '';
    const resolvedPhone = phoneChannel?.url || s.supportPhone || fpFooter.supportPhone || '';
    const resolvedAddress = s.registeredAddress || fpFooter.atelierAddress || '';
    const resolvedHours = s.operatingHours || fpFooter.operatingHours || 'Mon - Sat: 10:00 AM - 8:00 PM IST';
    const resolvedWaMsg = s.whatsappDefaultMessage || "Hey TORI-WEAR! I'd like help with my order / sizing.";

    return {
      storeName: s.storeName || 'TORI WEAR',
      supportEmail: resolvedEmail,
      phone: resolvedPhone,
      supportPhone: resolvedPhone,
      whatsappNumber: whatsappRaw,
      whatsappDigits,
      whatsappMessage: resolvedWaMsg,
      whatsappDefaultMessage: resolvedWaMsg,
      operatingHours: resolvedHours,
      businessAddress: resolvedAddress,
      registeredAddress: resolvedAddress,
      returnWindowDays: s.returnWindowDays || 7,
      exchangeEnabled: s.exchangeEnabled !== false,
      channels: orderedChannels,
      socialLinks: orderedChannels.filter((c) => !['WHATSAPP', 'EMAIL', 'PHONE'].includes(c.platform)),
      metaBusiness: {
        domainVerificationCode: s.metaBusiness?.domainVerificationCode || '',
        pixelId: s.metaBusiness?.pixelId || '',
        capiEnabled: Boolean(s.metaBusiness?.capiEnabled),
      },
    };
  }

  async updateStoreSettings(settings: Partial<StoreSettingsRecord>, actorId?: string): Promise<StoreSettingsRecord> {
    return this.enqueueWrite(async () => {
      this.ensureLoaded();
      const sanitizedInput: Partial<StoreSettingsRecord> = { ...(settings || {}) };
      if (sanitizedInput.metaBusiness) {
        const { capiToken: _ignoreToken, ...safeMeta } = sanitizedInput.metaBusiness as any;
        sanitizedInput.metaBusiness = safeMeta;
      }

      this.storeSettings = this.normalizeSettings({
        ...this.storeSettings!,
        ...sanitizedInput,
      });

      // Keep footer contact & social links synchronized when channels or support info changes
      if (this.frontPageData?.footer) {
        this.frontPageData.footer.supportEmail = this.storeSettings.supportEmail;
        this.frontPageData.footer.supportPhone = this.storeSettings.supportPhone;
        this.frontPageData.footer.operatingHours = this.storeSettings.operatingHours;
        this.frontPageData.footer.atelierAddress = this.storeSettings.registeredAddress;
        const socialOnly = (this.storeSettings.contactChannels || []).filter(
          (c) => !['WHATSAPP', 'EMAIL', 'PHONE'].includes(c.platform)
        );
        if (socialOnly.length > 0) {
          this.frontPageData.footer.socialLinks = socialOnly.map((c) => ({
            platform: c.label || c.platform,
            url: c.valueOrUrl,
            enabled: c.isEnabled,
          }));
        }
      }

      this.saveToDisk();

    // Mirror to Prisma WebsiteSetting if connected
    try {
      if (prisma && prisma.websiteSetting) {
        for (const [key, value] of Object.entries(sanitizedInput)) {
          await prisma.websiteSetting.upsert({
            where: { key: `store_${key}` },
            create: {
              key: `store_${key}`,
              value: typeof value === 'object' ? JSON.stringify(value) : String(value),
              group: 'GENERAL',
              isPublic: ['freeShippingThreshold', 'standardShippingFee', 'codFee', 'maintenanceMode', 'returnWindowDays'].includes(key),
            },
            update: {
              value: typeof value === 'object' ? JSON.stringify(value) : String(value),
            },
          }).catch(() => {});
        }
      }
    } catch {}

    console.log(`[CmsRepo] ⚙️ Store settings updated by ${actorId || 'STAFF'}`);
    return this.storeSettings!;
    });
  }
}

export const cmsRepository = new CmsRepository();

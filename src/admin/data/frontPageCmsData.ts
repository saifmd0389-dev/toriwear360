import { WebsiteSection, HeroSettings } from '../types';

export interface FrontPageAdvertisement {
  id: string;
  title: string;
  type: 'TOP_ANNOUNCEMENT' | 'POPUP_MODAL' | 'TWINNING_SPOTLIGHT' | 'SALE_BANNER' | 'IN_FEED_AD' | 'FOOTER_BANNER';
  enabled: boolean;
  tagline?: string;
  headline?: string;
  description?: string;
  badge?: string;
  promoCode?: string;
  discountValue?: string;
  imageUrl?: string;
  linkUrl?: string;
  ctaText?: string;
  bgColor?: string;
  textColor?: string;
  startDate?: string;
  endDate?: string;
}

export interface FrontPageTabItem {
  id: string;
  category: 'HEADER_NAV' | 'DEPARTMENT_SWITCHER' | 'REALM_WORLDS' | 'LOOKBOOK_FILTER';
  label: string;
  targetLink: string;
  badge?: string;
  icon?: string;
  enabled: boolean;
  order: number;
  description?: string;
}

export interface FrontPageRealmCard {
  id: string;
  title: string;
  department: 'MEN' | 'KIDS';
  tag: string;
  franchiseVibe: string;
  description: string;
  bannerImage: string;
  accentColor: string;
  ctaText: string;
  enabled: boolean;
  order: number;
  badge?: string;
  japanese?: string;
  detailedLore?: string;
  worldId?: string;
  bgGradient?: string;
  numberBadge?: string;
}

export interface FrontPageUniverseChapter {
  id: string;
  chapterNumber: string;
  title: string;
  era: string;
  excerpt: string;
  bannerImage: string;
  enabled: boolean;
  order: number;
}

export interface FrontPageUniverseLore {
  headline: string;
  subheadline: string;
  narrativeText: string;
  quote: string;
  bannerImage: string;
  pillars: {
    id: string;
    num: string;
    title: string;
    description: string;
    icon: string;
  }[];
  chapters: FrontPageUniverseChapter[];
}

export interface FrontPageCharacterProfile {
  id: string;
  name: string;
  title: string;
  japaneseTitle: string;
  avatarImage: string;
  quote: string;
  backstory: string;
  weaponAesthetic: string;
  stats: {
    fabricGsm: string;
    loreLevel: string;
    agilityVibe: string;
  };
  enabled: boolean;
  order: number;
}

export interface FrontPageDesignStory {
  id: string;
  title: string;
  capsuleCode: string;
  concept: string;
  fabricSpec: string;
  printTechnology: string;
  heroImage: string;
  enabled: boolean;
  order: number;
}

export interface FrontPageLookbookItem {
  id: string;
  customerHandle: string;
  location: string;
  caption: string;
  sizeWorn: string;
  rating: number;
  taggedDrop: string;
  imageUrl: string;
  category: 'ALL' | 'MEN' | 'KIDS' | 'CAMPUS';
  enabled: boolean;
  order: number;
}

export interface FrontPageSocialFeed {
  marqueePhrases: string[];
  posts: {
    id: string;
    handle: string;
    caption: string;
    imageUrl: string;
    likes: number;
    platform: 'Instagram' | 'Twitter' | 'TikTok';
    linkUrl: string;
    enabled: boolean;
  }[];
}

export interface FrontPageFaqItem {
  id: string;
  category: 'SIZING_FABRIC' | 'ORDERS_SHIPPING' | 'RETURNS_EXCHANGES' | 'AUTHENTICITY_IP';
  question: string;
  answer: string;
  enabled: boolean;
  order: number;
}

export interface FrontPageFooterSettings {
  brandTagline: string;
  aboutBlurb: string;
  supportEmail: string;
  supportPhone: string;
  atelierAddress: string;
  operatingHours: string;
  copyrightText: string;
  socialLinks: {
    platform: string;
    url: string;
    enabled: boolean;
  }[];
  trustBadges: {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
  }[];
}

export interface FrontPageCmsData {
  lastUpdated: string;
  sections: WebsiteSection[];
  hero: HeroSettings;
  advertisements: FrontPageAdvertisement[];
  tabs: FrontPageTabItem[];
  realms: FrontPageRealmCard[];
  universe: FrontPageUniverseLore;
  characters: FrontPageCharacterProfile[];
  designStories: FrontPageDesignStory[];
  lookbook: FrontPageLookbookItem[];
  socialFeed: FrontPageSocialFeed;
  faqs: FrontPageFaqItem[];
  footer: FrontPageFooterSettings;
}

export const DEFAULT_FRONTPAGE_CMS_DATA: FrontPageCmsData = {
  lastUpdated: new Date().toISOString(),
  sections: [
    { id: 'sec-1', key: 'hero', name: '01. Hero "Wear Your World"', description: 'Cinematic hero stage with original character cards and particle canvas', isEnabled: true, order: 1 },
    { id: 'sec-2', key: 'department_portals', name: '02. Visual Department Gateways', description: 'Dual store gateways: Men (30 Drops) vs Kids (24 Drops)', isEnabled: true, order: 2 },
    { id: 'sec-3', key: 'twinning_spotlight', name: '03. Twinning Duo Soft Highlight', description: 'Flagship capsule launch matching duo sets with 15% bundle save', isEnabled: true, order: 3 },
    { id: 'sec-4', key: 'choose_your_world', name: '04. Choose Your World (Realms Preview)', description: 'Dark Shonen, Cyberpunk, Retro Y2K, Samurai, Street Anime', isEnabled: true, order: 4 },
    { id: 'sec-5', key: 'tori_universe', name: '05. The Tori Universe & Lore', description: 'Narrative worldbuilding, lore pillars, and Chapter Zero timeline', isEnabled: true, order: 5 },
    { id: 'sec-6', key: 'original_characters', name: '06. Original Characters Profile Roster', description: 'Interactive roster profiles (Tori, Ren, Kai, Yuki, Aki, Kami & Zero)', isEnabled: true, order: 6 },
    { id: 'sec-7', key: 'story_behind_designs', name: '07. Story Behind The Designs', description: 'Archival design breakdown for Void Walker, Neon Ronin, 02:17 AM', isEnabled: true, order: 7 },
    { id: 'sec-8', key: 'customer_lookbook', name: '08. Seen in the Real World Lookbook', description: 'Community street fits with customer ratings and size references', isEnabled: true, order: 8 },
    { id: 'sec-9', key: 'tori_feed', name: '09. Enter The Tori Feed & Marquee', description: 'Atelier design sketches, concept art notes, and social drop snaps', isEnabled: true, order: 9 },
    { id: 'sec-10', key: 'newsletter', name: '10. Enter The Universe Newsletter', description: 'Drop alerts, chapter access, and instant ₹100 discount coupon', isEnabled: true, order: 10 },
    { id: 'sec-11', key: 'faq', name: '11. Frequently Asked Questions', description: 'Original IP clarity, sizing, fabric care, and pan-India shipping', isEnabled: true, order: 11 },
  ],
  hero: {
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
    trustBadge1: '240 GSM Combed Cotton',
    trustBadge2: '100% Original Japanese Anime IP',
    trustBadge3: 'Free Pan-India Delivery Over ₹999',
  },
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
      enabled: true,
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
    }
  ],
  tabs: [
    { id: 'tab-nav-home', category: 'HEADER_NAV', label: 'Home', targetLink: '/', enabled: true, order: 1 },
    { id: 'tab-nav-men', category: 'HEADER_NAV', label: 'Shop Men', targetLink: '/men', badge: '30 DROPS', enabled: true, order: 2 },
    { id: 'tab-nav-kids', category: 'HEADER_NAV', label: 'Shop Kids', targetLink: '/kids', badge: '24 DROPS', enabled: true, order: 3 },
    { id: 'tab-nav-worlds', category: 'HEADER_NAV', label: 'Worlds', targetLink: '#choose-your-world-section', enabled: true, order: 4 },
    { id: 'tab-nav-lore', category: 'HEADER_NAV', label: 'Tori Lore', targetLink: '#tori-universe', enabled: true, order: 5 },
    { id: 'tab-nav-lookbook', category: 'HEADER_NAV', label: 'Lookbook', targetLink: '#customer-lookbook', badge: 'COMMUNITY', enabled: true, order: 6 },
    { id: 'tab-nav-faq', category: 'HEADER_NAV', label: 'FAQs', targetLink: '#faq-section', enabled: true, order: 7 },

    { id: 'tab-dept-all', category: 'DEPARTMENT_SWITCHER', label: 'Storefront Home', targetLink: '/', icon: 'Sparkles', enabled: true, order: 1, description: 'First Page with Brand Lore & Visual Portals' },
    { id: 'tab-dept-men', category: 'DEPARTMENT_SWITCHER', label: 'Men\'s Vault', targetLink: '/men', badge: '30 Drops', icon: 'Flame', enabled: true, order: 2, description: 'Dedicated Men\'s 240 GSM Streetwear Catalogue' },
    { id: 'tab-dept-kids', category: 'DEPARTMENT_SWITCHER', label: 'Kids\' Realm', targetLink: '/kids', badge: '24 Drops', icon: 'Smile', enabled: true, order: 3, description: 'Dedicated Kids\' Heavyweight Anime Apparel' },

    { id: 'tab-realm-shonen', category: 'REALM_WORLDS', label: 'Dark Shonen', targetLink: '/men?world=Dark+Shonen', badge: 'Popular', icon: '⚔️', enabled: true, order: 1, description: 'Solo Leveling, Jujutsu & Chainsaw aesthetics' },
    { id: 'tab-realm-cyberpunk', category: 'REALM_WORLDS', label: 'Cyberpunk Neo Tokyo', targetLink: '/men?world=Cyberpunk', badge: 'Futuristic', icon: '⚡', enabled: true, order: 2, description: 'Akira & Ghost in the Shell neon rainy alleys' },
    { id: 'tab-realm-retro', category: 'REALM_WORLDS', label: 'Retro Anime / Y2K', targetLink: '/men?world=Retro+Y2K', badge: 'Classic', icon: '📼', enabled: true, order: 3, description: 'Cowboy Bebop & Evangelion nostalgic typography' },
    { id: 'tab-realm-samurai', category: 'REALM_WORLDS', label: 'Samurai & Mythic', targetLink: '/men?world=Samurai', badge: 'Heritage', icon: '⛩️', enabled: true, order: 4, description: 'Vagabond & Demon Slayer brushstrokes' },
    { id: 'tab-realm-street', category: 'REALM_WORLDS', label: 'Street & Slice-of-Life', targetLink: '/men?world=Street', badge: 'Urban', icon: '🛹', enabled: true, order: 5, description: 'Tokyo Revengers raw youth streetwear culture' },

    { id: 'tab-lookbook-all', category: 'LOOKBOOK_FILTER', label: 'All Community Fits', targetLink: 'ALL', enabled: true, order: 1 },
    { id: 'tab-lookbook-men', category: 'LOOKBOOK_FILTER', label: 'Men\'s Streetwear Fits', targetLink: 'MEN', enabled: true, order: 2 },
    { id: 'tab-lookbook-kids', category: 'LOOKBOOK_FILTER', label: 'Kids & Family Sets', targetLink: 'KIDS', enabled: true, order: 3 },
    { id: 'tab-lookbook-campus', category: 'LOOKBOOK_FILTER', label: 'Campus & Creator Fits', targetLink: 'CAMPUS', enabled: true, order: 4 },
  ],
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
    }
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
      {
        id: 'chap-1',
        chapterNumber: 'CHAPTER 01',
        title: 'THE AWAKENING',
        era: 'NEO TOKYO 2099',
        excerpt: 'Ren discovers the cursed core in the subterranean transit ruins beneath Shinjuku.',
        bannerImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
        enabled: true,
        order: 1,
      },
      {
        id: 'chap-2',
        chapterNumber: 'CHAPTER 02',
        title: 'NEON SHADOWS',
        era: 'SHIBUYA SECTOR 4',
        excerpt: 'Yuki intercepts illegal cyber-augment code transmitted across high-voltage tram lines.',
        bannerImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
        enabled: true,
        order: 2,
      },
      {
        id: 'chap-3',
        chapterNumber: 'CHAPTER 03',
        title: 'BLOOD MOON RONIN',
        era: 'KYOTO SANCTUARY',
        excerpt: 'Kai honors the ancient oath, drawing his plasma katana against the shadow swarm.',
        bannerImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
        enabled: true,
        order: 3,
      }
    ]
  },
  characters: [
    {
      id: 'char-ren',
      name: 'REN // 蓮',
      title: 'Dark Shonen Protagonist',
      japaneseTitle: '影の継承者 (Shadow Inheritor)',
      avatarImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
      quote: '“Some people run from the darkness. He learned to walk through it.”',
      backstory: 'Wields the obsidian shadow monarch pulse. Prefers oversized boxy silhouettes in pitch black and blood crimson.',
      weaponAesthetic: 'Dual Shadow Daggers // Heavyweight Armor',
      stats: {
        fabricGsm: '240 GSM Combed Cotton',
        loreLevel: 'Rank S+ Protagonist',
        agilityVibe: 'Relentless Kinetic Will'
      },
      enabled: true,
      order: 1,
    },
    {
      id: 'char-yuki',
      name: 'YUKI // 雪',
      title: 'Cyberpunk Netrunner & Tactician',
      japaneseTitle: 'サイバーネットランナー (Cyber Netrunner)',
      avatarImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      quote: '“Midnight runs through rain-slicked neon alleys of Neo Tokyo.”',
      backstory: 'Navigates high-frequency data streams while gliding over rainy rooftops in holographic techwear.',
      weaponAesthetic: 'Data Overdrive Gauntlets // Cyan Wireframes',
      stats: {
        fabricGsm: '240 GSM Matte Finish',
        loreLevel: 'Cyber Tactician Rank A',
        agilityVibe: 'Sub-Zero Velocity'
      },
      enabled: true,
      order: 2,
    },
    {
      id: 'char-kai',
      name: 'KAI // 魁',
      title: 'Neo-Samurai Ronin',
      japaneseTitle: '放浪の侍 (Wandering Ronin)',
      avatarImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
      quote: '“The blade remembers the stroke long after the samurai rests.”',
      backstory: 'A ronin who merged traditional bushido swordcraft with high-frequency particle plasma edges.',
      weaponAesthetic: 'Single-Edge Plasma Katana // Kimono Draping',
      stats: {
        fabricGsm: '240 GSM Reinforced Seams',
        loreLevel: 'Master Swordsman',
        agilityVibe: 'Instantaneous Decapitation'
      },
      enabled: true,
      order: 3,
    }
  ],
  designStories: [
    {
      id: 'story-void-walker',
      title: 'VOID WALKER // 01',
      capsuleCode: 'CAPSULE-SHONEN-2026',
      concept: 'Inspired by solo shadow ascension under purple dimensional rifts.',
      fabricSpec: '240 GSM pure combed cotton with bio-wash enzyme rinse for velvety handfeel.',
      printTechnology: 'High-density screen printing with crack-resistant plastisol cure.',
      heroImage: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
      enabled: true,
      order: 1,
    },
    {
      id: 'story-neon-ronin',
      title: 'NEON RONIN // 02',
      capsuleCode: 'CAPSULE-CYBER-2026',
      concept: 'The clash of ancient woodblock wave prints with circuit board cybernetics.',
      fabricSpec: '240 GSM heavyweight structure ensuring the collar never curls or sags.',
      printTechnology: 'Metallic foil overlay and glow-in-the-dark neon screen inks.',
      heroImage: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
      enabled: true,
      order: 2,
    }
  ],
  lookbook: [
    {
      id: 'lb-1',
      customerHandle: '@saif_fits',
      location: 'Visakhapatnam Beach Road',
      caption: '240 GSM hits different. The drop shoulder boxy drape is perfection for coastal evening breezes.',
      sizeWorn: 'Size XL (Height 6\'1")',
      rating: 5,
      taggedDrop: 'Shadow Monarch Oversized Tee',
      imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
      category: 'MEN',
      enabled: true,
      order: 1,
    },
    {
      id: 'lb-2',
      customerHandle: '@yuki_streetwear',
      location: 'Bangalore Cyber Hub',
      caption: 'Finally anime apparel that doesn\'t look like cheap printed polyester. Heavyweight cotton feels like armor.',
      sizeWorn: 'Size L (Height 5\'10")',
      rating: 5,
      taggedDrop: 'Cyberpunk Neo Tokyo Heavyweight',
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      category: 'CAMPUS',
      enabled: true,
      order: 2,
    },
    {
      id: 'lb-3',
      customerHandle: '@arjun_and_mini',
      location: 'Mumbai Bandra West',
      caption: 'Twinning duo set with my 7-year-old son! He loves his Mecha bot tee, and mine fits like high-end streetwear.',
      sizeWorn: 'Men XL + Kids 7-8Y',
      rating: 5,
      taggedDrop: 'Twinning Duo Matching Set',
      imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
      category: 'KIDS',
      enabled: true,
      order: 3,
    }
  ],
  socialFeed: {
    marqueePhrases: [
      'TOKYO LORE // 240 GSM HEAVYWEIGHT',
      'ORIGINAL JAPANESE ANIME IP',
      'NO GENERIC MERCH',
      'FREE SHIPPING ALL OVER INDIA',
      'WEAR YOUR WORLD',
      'DROP 01 LIVE NOW',
      'AUTHENTIC STREETWEAR ATELIER'
    ],
    posts: [
      {
        id: 'post-1',
        handle: '@toriwear.official',
        caption: 'Late night atelier test print on 240 GSM obsidian cotton. The high density screen lines are razor sharp.',
        imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
        likes: 1420,
        platform: 'Instagram',
        linkUrl: 'https://instagram.com',
        enabled: true,
      },
      {
        id: 'post-2',
        handle: '@toriwear.official',
        caption: 'Ren character study in ink. We sketch each manga panel by hand before color separations.',
        imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
        likes: 2180,
        platform: 'Instagram',
        linkUrl: 'https://instagram.com',
        enabled: true,
      },
      {
        id: 'post-3',
        handle: '@toriwear.official',
        caption: 'Kids adventure drop packaging ready for dispatch across pan-India hubs. Heavy duty polybags.',
        imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&auto=format&fit=crop&q=80',
        likes: 980,
        platform: 'Instagram',
        linkUrl: 'https://instagram.com',
        enabled: true,
      }
    ]
  },
  faqs: [
    {
      id: 'faq-1',
      category: 'SIZING_FABRIC',
      question: 'What does 240 GSM combed cotton mean?',
      answer: 'GSM stands for grams per square meter. Standard market tees range from 160-180 GSM, which can feel thin and limp. TORI WEAR uses custom 240 GSM heavy combed cotton: it creates a structured boxy silhouette, drapes without clinging to the body, and endures dozens of washes without warping.',
      enabled: true,
      order: 1,
    },
    {
      id: 'faq-2',
      category: 'AUTHENTICITY_IP',
      question: 'Are TORI WEAR designs officially licensed or original?',
      answer: 'All TORI WEAR artwork, character profiles, typography, and lore pillars are 100% original creations designed by our in-house Tokyo-inspired atelier. We do not use pirated screenshots or generic AI clipart.',
      enabled: true,
      order: 2,
    },
    {
      id: 'faq-3',
      category: 'ORDERS_SHIPPING',
      question: 'How fast is delivery across India?',
      answer: 'Orders are dispatched within 24 hours from our fulfillment hub. Metro cities (Mumbai, Delhi, Bangalore, Hyderabad, Chennai) receive orders in 2-3 business days. Rest of India typically arrives in 4-6 business days with live tracking via BlueDart and Delhivery.',
      enabled: true,
      order: 3,
    },
    {
      id: 'faq-4',
      category: 'RETURNS_EXCHANGES',
      question: 'Can I return or exchange for a different size?',
      answer: 'Yes! We offer a hassle-free 7-day doorstep return and exchange policy. You can initiate a size exchange or return directly from your Order History tab with photo verification. Our reverse courier picks it up straight from your address.',
      enabled: true,
      order: 4,
    },
    {
      id: 'faq-5',
      category: 'ORDERS_SHIPPING',
      question: 'Is Cash on Delivery (COD) available?',
      answer: 'Yes, Cash on Delivery is available across 19,000+ PIN codes in India. You can also pay seamlessly via UPI, credit/debit cards, and net banking with instant confirmation.',
      enabled: true,
      order: 5,
    }
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
    ]
  }
};

export interface CmsServerSaveResult {
  success: boolean;
  data?: FrontPageCmsData;
  error?: string;
  status?: number;
}

function getAdminAuthHeaders(): Record<string, string> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('tori_admin_session_token') || sessionStorage.getItem('tori_admin_session_token')
      : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-session-token'] = token;
  }
  return headers;
}

function safeCmsLocalStorageSet(key: string, value: any): boolean {
  if (typeof window === 'undefined') return false;
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    // Evict heavy expendable admin logs/product caches on QuotaExceededError
    const expendable = [
      'tori_admin_ai_usage_logs',
      'tori_admin_auditLogs',
      'tori_admin_inv_movements',
      'tori_admin_securitySessions',
      'tori_admin_flashSales',
    ];
    for (const k of expendable) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }
    try {
      localStorage.setItem(key, serialized);
      return true;
    } catch {
      console.warn(`[CMS] localStorage quota exceeded for "${key}". Relying on authoritative server storage.`);
      return false;
    }
  }
}

function emitCmsSyncStatus(status: 'saving' | 'saved' | 'error', error?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tori-cms-sync-status', { detail: { status, error } }));
  }
}

export function normalizeFrontPageCmsData(raw: any): FrontPageCmsData {
  // Handle full cms-store.json backup wrapper { frontPage, storeSettings }
  const source = raw && typeof raw === 'object' && raw.frontPage && typeof raw.frontPage === 'object'
    ? raw.frontPage
    : (raw && typeof raw === 'object' ? raw : {});

  const rawSections: any[] = Array.isArray(source.sections) && source.sections.length > 0
    ? source.sections
    : DEFAULT_FRONTPAGE_CMS_DATA.sections;

  const sections: WebsiteSection[] = rawSections.map((s: any, idx: number) => {
    const def = DEFAULT_FRONTPAGE_CMS_DATA.sections.find(
      (d) => d.id === s.id || d.key === s.key || d.key === s.type
    );
    const key = s.key || s.type || def?.key || `section_${idx + 1}`;
    const name = s.name || s.title || def?.name || `Section ${idx + 1}`;
    const description = s.description || def?.description || key;
    return {
      ...def,
      ...s,
      id: s.id || def?.id || `sec-${idx + 1}`,
      key,
      type: s.type || key,
      name,
      title: s.title || name,
      description,
      isEnabled: s.isEnabled !== undefined ? Boolean(s.isEnabled) : true,
      order: typeof s.order === 'number' ? s.order : idx + 1,
    };
  });

  // Ensure canonical tabs exist per category if a category is completely missing
  const incomingTabs: FrontPageTabItem[] = Array.isArray(source.tabs)
    ? source.tabs
    : DEFAULT_FRONTPAGE_CMS_DATA.tabs;

  const tabs: FrontPageTabItem[] = Array.isArray(source.tabs) ? [...incomingTabs] : [...DEFAULT_FRONTPAGE_CMS_DATA.tabs];
  const categories: FrontPageTabItem['category'][] = [
    'HEADER_NAV',
    'DEPARTMENT_SWITCHER',
    'REALM_WORLDS',
    'LOOKBOOK_FILTER',
  ];
  for (const cat of categories) {
    if (!tabs.some((t) => t.category === cat)) {
      tabs.push(...DEFAULT_FRONTPAGE_CMS_DATA.tabs.filter((d) => d.category === cat));
    }
  }

  const mergedRealms: FrontPageRealmCard[] =
    Array.isArray(source.realms) && source.realms.length > 0
      ? source.realms.map((r: any, idx: number) => {
          const def =
            DEFAULT_FRONTPAGE_CMS_DATA.realms.find((d) => d.id === r.id || d.title === r.title) ||
            DEFAULT_FRONTPAGE_CMS_DATA.realms[idx] ||
            DEFAULT_FRONTPAGE_CMS_DATA.realms[0];
          return {
            ...(def || {}),
            ...r,
            badge: r.badge || def?.badge || 'CHAPTER 01',
            japanese: r.japanese || def?.japanese || '暗黒少年',
            detailedLore: r.detailedLore || def?.detailedLore || r.description,
            worldId: r.worldId || def?.worldId || r.title,
            bgGradient: r.bgGradient || def?.bgGradient || 'from-purple-950/70 via-neutral-950 to-[#0A0A0A]',
            numberBadge: r.numberBadge || def?.numberBadge || `0${idx + 1}`,
            accentColor: r.accentColor || def?.accentColor || '#FF2028',
            bannerImage: r.bannerImage || def?.bannerImage,
            enabled: r.enabled !== false,
            order: typeof r.order === 'number' ? r.order : idx + 1,
          };
        })
      : DEFAULT_FRONTPAGE_CMS_DATA.realms;

  const rawUniverse = source.universe && typeof source.universe === 'object' ? source.universe : {};
  const universe: FrontPageUniverseLore = {
    ...DEFAULT_FRONTPAGE_CMS_DATA.universe,
    ...rawUniverse,
    pillars: Array.isArray(rawUniverse.pillars) ? rawUniverse.pillars : DEFAULT_FRONTPAGE_CMS_DATA.universe.pillars,
    chapters: Array.isArray(rawUniverse.chapters) ? rawUniverse.chapters : DEFAULT_FRONTPAGE_CMS_DATA.universe.chapters,
  };

  const rawFeed = source.socialFeed && typeof source.socialFeed === 'object' ? source.socialFeed : {};
  const socialFeed: FrontPageSocialFeed = {
    marqueePhrases: Array.isArray(rawFeed.marqueePhrases)
      ? rawFeed.marqueePhrases
      : DEFAULT_FRONTPAGE_CMS_DATA.socialFeed.marqueePhrases,
    posts: Array.isArray(rawFeed.posts) ? rawFeed.posts : DEFAULT_FRONTPAGE_CMS_DATA.socialFeed.posts,
  };

  const rawFooter = source.footer && typeof source.footer === 'object' ? source.footer : {};
  const footer: FrontPageFooterSettings = {
    ...DEFAULT_FRONTPAGE_CMS_DATA.footer,
    ...rawFooter,
    socialLinks: Array.isArray(rawFooter.socialLinks) ? rawFooter.socialLinks : DEFAULT_FRONTPAGE_CMS_DATA.footer.socialLinks,
    trustBadges: Array.isArray(rawFooter.trustBadges) ? rawFooter.trustBadges : DEFAULT_FRONTPAGE_CMS_DATA.footer.trustBadges,
  };

  return {
    ...DEFAULT_FRONTPAGE_CMS_DATA,
    ...source,
    lastUpdated:
      typeof source.lastUpdated === 'string' && source.lastUpdated.trim()
        ? source.lastUpdated
        : DEFAULT_FRONTPAGE_CMS_DATA.lastUpdated,
    sections,
    hero: { ...DEFAULT_FRONTPAGE_CMS_DATA.hero, ...(source.hero || {}) },
    advertisements: Array.isArray(source.advertisements) ? source.advertisements : DEFAULT_FRONTPAGE_CMS_DATA.advertisements,
    tabs,
    realms: mergedRealms,
    universe,
    characters: Array.isArray(source.characters) ? source.characters : DEFAULT_FRONTPAGE_CMS_DATA.characters,
    designStories: Array.isArray(source.designStories) ? source.designStories : DEFAULT_FRONTPAGE_CMS_DATA.designStories,
    lookbook: Array.isArray(source.lookbook) ? source.lookbook : DEFAULT_FRONTPAGE_CMS_DATA.lookbook,
    socialFeed,
    faqs: Array.isArray(source.faqs) ? source.faqs : DEFAULT_FRONTPAGE_CMS_DATA.faqs,
    footer,
  };
}

let memoryCmsCache: FrontPageCmsData | null = null;
let lastCmsFetchAt = 0;
let inflightCmsFetch: Promise<FrontPageCmsData> | null = null;

let memorySettingsCache: Record<string, any> | null = null;
let lastSettingsFetchAt = 0;
let inflightSettingsFetch: Promise<Record<string, any> | null> | null = null;

const FETCH_CACHE_TTL_MS = 2000;

if (typeof window !== 'undefined') {
  // Keep in-memory cache coherent when another tab updates CMS
  window.addEventListener('storage', (e) => {
    if (e.key === 'tori_admin_frontpage_cms' && e.newValue) {
      try {
        memoryCmsCache = normalizeFrontPageCmsData(JSON.parse(e.newValue));
        window.dispatchEvent(new CustomEvent('tori-cms-updated', { detail: memoryCmsCache }));
      } catch {}
    }
  });
}

function writeCmsCacheAndNotify(data: FrontPageCmsData) {
  memoryCmsCache = data;
  lastCmsFetchAt = Date.now();
  safeCmsLocalStorageSet('tori_admin_frontpage_cms', data);
  if (data.hero) {
    safeCmsLocalStorageSet('tori_admin_heroSettings', data.hero);
  }
  if (data.sections) {
    safeCmsLocalStorageSet('tori_admin_websiteSections', data.sections);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tori-cms-updated', { detail: data }));
    window.dispatchEvent(new CustomEvent('tori_hero_updated', { detail: data.hero }));
  }
}

export const loadFrontPageCmsData = (): FrontPageCmsData => {
  if (memoryCmsCache) {
    return memoryCmsCache;
  }
  try {
    const saved = localStorage.getItem('tori_admin_frontpage_cms');
    if (saved) {
      memoryCmsCache = normalizeFrontPageCmsData(JSON.parse(saved));
      return memoryCmsCache;
    }
  } catch (err) {
    console.error('Error loading front page CMS data from localStorage:', err);
  }
  return DEFAULT_FRONTPAGE_CMS_DATA;
};

let bgSyncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCmsPayload: FrontPageCmsData | null = null;

export const fetchFrontPageCmsDataFromServer = async (force = false): Promise<FrontPageCmsData> => {
  const now = Date.now();
  if (!force && memoryCmsCache && now - lastCmsFetchAt < FETCH_CACHE_TTL_MS) {
    return memoryCmsCache;
  }
  if (!force && inflightCmsFetch) {
    return inflightCmsFetch;
  }

  inflightCmsFetch = (async () => {
    try {
      const res = await fetch('/api/v1/cms/frontpage');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const serverData = normalizeFrontPageCmsData(json.data);
          // Avoid wiping unsaved staged edits if a debounced save is pending
          if (pendingCmsPayload) {
            return pendingCmsPayload;
          }
          writeCmsCacheAndNotify(serverData);
          return serverData;
        }
      }
    } catch (err) {
      console.warn('[CMS] Failed to fetch authoritative CMS data from server, using local cache:', err);
    } finally {
      inflightCmsFetch = null;
    }
    return loadFrontPageCmsData();
  })();

  return inflightCmsFetch;
};

export const fetchStoreSettingsFromServer = async (force = false): Promise<Record<string, any> | null> => {
  const now = Date.now();
  if (!force && memorySettingsCache && now - lastSettingsFetchAt < FETCH_CACHE_TTL_MS) {
    return memorySettingsCache;
  }
  if (!force && inflightSettingsFetch) {
    return inflightSettingsFetch;
  }

  inflightSettingsFetch = (async () => {
    try {
      const res = await fetch('/api/v1/cms/settings');
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.data) {
          memorySettingsCache = json.data;
          lastSettingsFetchAt = Date.now();
          return json.data;
        }
      }
    } catch {
    } finally {
      inflightSettingsFetch = null;
    }
    return memorySettingsCache;
  })();

  return inflightSettingsFetch;
};

export const uploadCmsImageAsset = async (
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> => {
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB raw binary chunks (bypasses Base64 overhead & request limits)
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const uploadId = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  const authHeaders = getAdminAuthHeaders();
  const binaryHeaders: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
  };
  if (authHeaders['Authorization']) {
    binaryHeaders['Authorization'] = authHeaders['Authorization'];
  }
  if (authHeaders['x-session-token']) {
    binaryHeaders['x-session-token'] = authHeaders['x-session-token'];
  }

  let finalUrl = '';
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunkBlob = file.slice(start, end);

    const params = new URLSearchParams({
      uploadId,
      chunkIndex: String(chunkIndex),
      totalChunks: String(totalChunks),
      filename: file.name || 'image.png',
      mimeType: file.type || '',
    });

    const res = await fetch(`/api/v1/admin/cms/upload-asset-chunk?${params.toString()}`, {
      method: 'POST',
      headers: binaryHeaders,
      body: chunkBlob,
    });

    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
      }
      throw new Error(json.error || 'Admin session expired. Please log in again.');
    }
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Image upload failed (${res.status})`);
    }
    if (json.completed && json.url) {
      finalUrl = json.url as string;
    }
    if (onProgress) {
      onProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
    }
  }

  if (!finalUrl) {
    throw new Error('Upload completed without a server asset URL.');
  }
  return finalUrl;
};

export const saveFrontPageCmsDataToServer = async (
  data: FrontPageCmsData,
  options?: { keepalive?: boolean }
): Promise<CmsServerSaveResult> => {
  if (bgSyncTimer) {
    clearTimeout(bgSyncTimer);
    bgSyncTimer = null;
  }
  pendingCmsPayload = null;

  const normalizedPayload = normalizeFrontPageCmsData({
    ...data,
    lastUpdated: new Date().toISOString(),
  });

  emitCmsSyncStatus('saving');

  try {
    const res = await fetch('/api/v1/admin/cms/frontpage', {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify(normalizedPayload),
      keepalive: Boolean(options?.keepalive),
    });

    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      const errMsg = json.error || 'Admin session expired or unauthorized. Please log in again.';
      emitCmsSyncStatus('error', errMsg);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
      }
      return { success: false, status: 401, error: errMsg };
    }

    if (!res.ok || !json.success || !json.data) {
      const errMsg = json.error || `Server rejected CMS save (HTTP ${res.status}).`;
      emitCmsSyncStatus('error', errMsg);
      return { success: false, status: res.status, error: errMsg };
    }

    const savedData = normalizeFrontPageCmsData(json.data);
    writeCmsCacheAndNotify(savedData);
    emitCmsSyncStatus('saved');
    return { success: true, data: savedData, status: res.status };
  } catch (err: any) {
    const errMsg = err?.message || 'Network error while saving CMS configuration to server.';
    console.warn('[CMS] Error persisting CMS data to server:', err);
    emitCmsSyncStatus('error', errMsg);
    return { success: false, error: errMsg };
  }
};

export const flushPendingCmsSave = (options?: { keepalive?: boolean }): Promise<CmsServerSaveResult | null> => {
  if (bgSyncTimer) {
    clearTimeout(bgSyncTimer);
    bgSyncTimer = null;
  }
  if (!pendingCmsPayload) {
    return Promise.resolve(null);
  }
  const toFlush = pendingCmsPayload;
  pendingCmsPayload = null;
  return saveFrontPageCmsDataToServer(toFlush, options);
};

export const resetFrontPageCmsDataOnServer = async (): Promise<CmsServerSaveResult> => {
  if (bgSyncTimer) {
    clearTimeout(bgSyncTimer);
    bgSyncTimer = null;
  }
  pendingCmsPayload = null;
  emitCmsSyncStatus('saving');

  try {
    const res = await fetch('/api/v1/admin/cms/reset', {
      method: 'POST',
      headers: getAdminAuthHeaders(),
    });
    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      const errMsg = json.error || 'Admin session expired or unauthorized. Please log in again.';
      emitCmsSyncStatus('error', errMsg);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
      }
      return { success: false, status: 401, error: errMsg };
    }

    if (!res.ok || !json.success || !json.data) {
      const errMsg = json.error || `Failed to reset CMS on server (HTTP ${res.status}).`;
      emitCmsSyncStatus('error', errMsg);
      return { success: false, status: res.status, error: errMsg };
    }

    const resetData = normalizeFrontPageCmsData(json.data);
    writeCmsCacheAndNotify(resetData);
    emitCmsSyncStatus('saved');
    return { success: true, data: resetData, status: res.status };
  } catch (err: any) {
    const errMsg = err?.message || 'Network error while resetting CMS.';
    emitCmsSyncStatus('error', errMsg);
    return { success: false, error: errMsg };
  }
};

export const saveFrontPageCmsData = (data: FrontPageCmsData): boolean => {
  try {
    const toSave = normalizeFrontPageCmsData({
      ...data,
      lastUpdated: new Date().toISOString(),
    });
    pendingCmsPayload = toSave;
    writeCmsCacheAndNotify(toSave);
    emitCmsSyncStatus('saving');

    // Debounced background persistence to backend so rapid typing does not race disk writes
    if (bgSyncTimer) clearTimeout(bgSyncTimer);
    bgSyncTimer = setTimeout(() => {
      const payload = pendingCmsPayload || toSave;
      pendingCmsPayload = null;
      bgSyncTimer = null;
      saveFrontPageCmsDataToServer(payload).then((result) => {
        if (!result.success && result.error && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tori-cms-sync-error', { detail: { error: result.error, status: result.status } }));
        }
      });
    }, 350);

    return true;
  } catch (err) {
    console.error('Error saving front page CMS data:', err);
    emitCmsSyncStatus('error', 'Failed to stage CMS update locally.');
    return false;
  }
};

import { MenWorldCategory, KidsWorldCategory, ToriOriginalCharacter } from '../types';

export interface WorldMeta {
  id: MenWorldCategory | KidsWorldCategory;
  department: 'MEN' | 'KIDS';
  name: string;
  subtitle: string;
  japanese: string;
  tagline: string;
  theme: string;
  visualLanguage: string;
  accentColor: string;
  badge: string;
  bgGradient: string;
  heroImage: string;
  bannerQuote: string;
}

export const MEN_WORLDS: WorldMeta[] = [
  {
    id: 'DARK SHONEN',
    department: 'MEN',
    name: 'DARK SHONEN',
    subtitle: 'POWER HAS A PRICE',
    japanese: '暗黒少年',
    tagline: 'Warriors, shadows, raw energy and unyielding determination.',
    theme: 'Power • Rivalries • Shadows • Masks • Battle Environments • Dramatic Lighting',
    visualLanguage: 'Manga composition, distressed typography, high-contrast dark inks, glowing kinetic shadows.',
    accentColor: '#9333ea',
    badge: 'SHONEN NOIR',
    bgGradient: 'from-purple-950/40 via-neutral-950 to-neutral-950',
    heroImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=900&auto=format&fit=crop&q=80',
    bannerQuote: 'Some people run from the darkness. He learned to walk through it.',
  },
  {
    id: 'CYBERPUNK / NEO TOKYO',
    department: 'MEN',
    name: 'CYBERPUNK / NEO TOKYO',
    subtitle: 'NIGHT RUNS & NEON RAIN',
    japanese: '新東京サイバー',
    tagline: 'Futuristic motorbikes, rain-slicked asphalt, digital loneliness and rogue AI.',
    theme: 'Future Cities • Neon • Technology • Motorcycles • Night Drives • Digital Worlds',
    visualLanguage: 'Holographic glows, cyber-grid interfaces, fictional Tokyo typography, neon cybernetics.',
    accentColor: '#06b6d4',
    badge: 'CYBER PROTOCOL',
    bgGradient: 'from-cyan-950/40 via-neutral-950 to-neutral-950',
    heroImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=900&auto=format&fit=crop&q=80',
    bannerQuote: 'The exact minute the city turns off its voice and turns on its soul.',
  },
  {
    id: 'RETRO Y2K',
    department: 'MEN',
    name: 'RETRO Y2K / NOSTALGIA',
    subtitle: '1999.EXE ARCHIVES',
    japanese: '世紀末レトロ',
    tagline: 'CRT glitch, early internet, VHS tapes, memory cards and analog nostalgia.',
    theme: 'CRT TVs • VHS • Pixel Graphics • Early Web • Retro Gaming • Old UI',
    visualLanguage: 'Chromium text, retro bitmap glyphs, scanlines, CD-ROM aesthetic on heavyweight streetwear.',
    accentColor: '#ec4899',
    badge: 'ANALOG CORE',
    bgGradient: 'from-pink-950/40 via-neutral-950 to-neutral-950',
    heroImage: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=900&auto=format&fit=crop&q=80',
    bannerQuote: 'Insert memory card to continue living between imagination and reality.',
  },
  {
    id: 'SAMURAI / MYTHIC JAPAN',
    department: 'MEN',
    name: 'SAMURAI / MYTHIC JAPAN',
    subtitle: 'ANCIENT BLADES & ONI MOONS',
    japanese: '武士神話',
    tagline: 'Modern ronin code, crimson cherry blossoms, mythical spirits and moonlight.',
    theme: 'Samurai • Ronin • Ancient Warriors • Oni Spirits • Moonlight • Temples',
    visualLanguage: 'Sumi-e ink brush strokes merged with drop-shoulder streetwear and vermilion accents.',
    accentColor: '#ef4444',
    badge: 'MYTHIC RONIN',
    bgGradient: 'from-red-950/40 via-neutral-950 to-neutral-950',
    heroImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=900&auto=format&fit=crop&q=80',
    bannerQuote: 'Honor isn’t in an unbroken weapon. It is in the hands that keep fighting.',
  },
  {
    id: 'STREET ANIME',
    department: 'MEN',
    name: 'STREET ANIME',
    subtitle: 'MINIMAL DRAPES & MANGA PANELS',
    japanese: '街頭原創',
    tagline: 'Fashion-forward minimalism. Small chest insignias, large back compositions, fictional coordinates.',
    theme: 'Minimalism • Manga Panels • Coordinates • Fictional Factions • Subtle Insignias',
    visualLanguage: 'Clean typography, micro-crests, editorial back panels, neutral obsidian drape.',
    accentColor: '#FF2028',
    badge: 'ORIGINAL STREET',
    bgGradient: 'from-rose-950/40 via-neutral-950 to-neutral-950',
    heroImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=900&auto=format&fit=crop&q=80',
    bannerQuote: 'Chapter One of an original universe with no boundaries.',
  },
];

export const KIDS_WORLDS: WorldMeta[] = [
  {
    id: 'CUTE ADVENTURE',
    department: 'KIDS',
    name: 'CUTE ADVENTURE',
    subtitle: 'BIG DREAMS & LITTLE DRAGONS',
    japanese: '冒険アドベンチャー',
    tagline: 'Bright colors, friendly expressions, cloud riders and little forest heroes.',
    theme: 'Little Dragon • Forest Hero • Tiny Ninja • Cloud Rider • Star Explorer',
    visualLanguage: 'Joyful illustrative characters, soft pastels, friendly smiles, cheerful adventure landscapes.',
    accentColor: '#38bdf8',
    badge: 'PLAYFUL CREW',
    bgGradient: 'from-sky-950/40 via-neutral-950 to-neutral-950',
    heroImage: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=900&auto=format&fit=crop&q=80',
    bannerQuote: 'Every giant legend starts with a tiny spark of imagination.',
  },
  {
    id: 'ROBOT & FUTURE',
    department: 'KIDS',
    name: 'ROBOT & FUTURE',
    subtitle: 'SPACE CADETS & MECHA FRIENDS',
    japanese: '未来ロボット',
    tagline: 'Friendly robots, space adventures, flying vehicles and futuristic companion droids.',
    theme: 'Robo Buddy • Space Cadet • Mecha Friend • Galaxy Runner • Future Kid',
    visualLanguage: 'Bright cyan and yellow retro sci-fi droids, rocket ships, cosmic stars, child-safe futuristic art.',
    accentColor: '#10b981',
    badge: 'FUTURE EXPLORER',
    bgGradient: 'from-emerald-950/40 via-neutral-950 to-neutral-950',
    heroImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=900&auto=format&fit=crop&q=80',
    bannerQuote: 'Blast off past the stars with your favorite mechanical sidekick.',
  },
  {
    id: 'RETRO GAME',
    department: 'KIDS',
    name: 'RETRO GAME',
    subtitle: 'LEVEL UP & PIXEL QUEST',
    japanese: 'ゲームボーイ',
    tagline: 'Pixel worlds, arcade controllers, power-up stars, secret warp zones and coin runs.',
    theme: 'Player Kid • Level Up • Pixel Hero • Power Mode • Game On',
    visualLanguage: 'Playful 8-bit voxel typography, colorful hearts, joystick iconography, gamified badges.',
    accentColor: '#f59e0b',
    badge: 'LEVEL 100',
    bgGradient: 'from-amber-950/40 via-neutral-950 to-neutral-950',
    heroImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=900&auto=format&fit=crop&q=80',
    bannerQuote: 'Press Start to enter the realm of endless high scores.',
  },
  {
    id: 'MINI SAMURAI',
    department: 'KIDS',
    name: 'MINI SAMURAI',
    subtitle: 'LITTLE RONIN & CLOUD NINJAS',
    japanese: 'ミニ武士',
    tagline: 'Playful, child-safe warrior characters with wooden practice swords and moon smiles.',
    theme: 'Little Ronin • Mini Ninja • Dragon Apprentice • Moon Warrior • Tiny Samurai',
    visualLanguage: 'Gentle, friendly stylized warrior suits, playful fox masks, cherry leaf swirls, zero violence.',
    accentColor: '#e11d48',
    badge: 'TINY WARRIOR',
    bgGradient: 'from-rose-950/40 via-neutral-950 to-neutral-950',
    heroImage: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=900&auto=format&fit=crop&q=80',
    bannerQuote: 'True bravery is being kind, curious, and quick as a lightning spark.',
  },
  {
    id: 'FANTASY CREATURES',
    department: 'KIDS',
    name: 'FANTASY CREATURES',
    subtitle: 'MYTHIC SPIRITS & MAGIC CREW',
    japanese: '魔法の生き物',
    tagline: 'Original moon dragons, starry fox kits, cloud monsters and guardian animal friends.',
    theme: 'Moon Dragon • Star Fox • Cloud Monster • Magic Crew • Little Legends',
    visualLanguage: 'Dreamy watercolor anime lines, pastel starlight, fluffy mythical creatures, soft organic fabrics.',
    accentColor: '#8b5cf6',
    badge: 'MYTHIC PETS',
    bgGradient: 'from-violet-950/40 via-neutral-950 to-neutral-950',
    heroImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=900&auto=format&fit=crop&q=80',
    bannerQuote: 'Friendship is the greatest magic in any storybook world.',
  },
];

export const ALL_WORLDS: WorldMeta[] = [...MEN_WORLDS, ...KIDS_WORLDS];

// ================= ORIGINAL CHARACTERS SYSTEM =================
export const ORIGINAL_CHARACTERS: ToriOriginalCharacter[] = [
  {
    id: 'char-tori',
    name: 'TORI',
    alias: 'THE CHOSEN STRANGER',
    japaneseName: '鳥 • トリ',
    department: 'MEN',
    world: 'STREET ANIME',
    role: 'Brand Protagonist & Universe Creator',
    personality: ['Curious', 'Rebellious', 'Determined', 'Creative'],
    symbol: '⚡ Black Wings / Hex Crest',
    description: 'The traveler who walks between imagination and reality. Refuses to wear someone else’s uniform.',
    storyQuote: 'Not a fan tee. Your universe. We don’t follow stories — we wear them.',
    signatureStyle: '240 GSM drop-shoulder black silhouette with minimal coordinates and back chapter panels.',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
    chapter: 'CHAPTER 01 — GENESIS',
    featuredProductId: 'tori-street-01',
    status: 'ACTIVE',
  },
  {
    id: 'char-ren',
    name: 'REN',
    alias: 'VOID WALKER',
    japaneseName: '蓮 • レン',
    department: 'MEN',
    world: 'DARK SHONEN',
    role: 'Shadow Warrior & Silent Prodigy',
    personality: ['Shadow', 'Mystery', 'Silence', 'Raw Power'],
    symbol: '🌑 Eclipse Eye',
    description: 'Exiled from the upper towers. Turned the shadows that once haunted him into his greatest armor.',
    storyQuote: 'Some people run from the darkness. I learned to walk through it.',
    signatureStyle: 'Acid-washed charcoal heavyweight cuts with high-density puff print dark energy flares.',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
    chapter: 'CHAPTER 01 — THE EXILE',
    featuredProductId: 'tori-shonen-01',
    status: 'ACTIVE',
  },
  {
    id: 'char-kai',
    name: 'KAI',
    alias: 'KINETIC BEAST',
    japaneseName: '甲斐 • カイ',
    department: 'MEN',
    world: 'DARK SHONEN',
    role: 'Street Martialist & Flame Engine',
    personality: ['Energy', 'Determination', 'Rivalry', 'Unfiltered Courage'],
    symbol: '🔥 Crimson Claws',
    description: 'Born on the concrete courts of District 9. Every bruise tells a chapter of relentless training.',
    storyQuote: 'Pain is just the universe testing if your dreams are loud enough to shatter walls.',
    signatureStyle: 'Deep blood-red accent piping on heavyweight combed cotton tees.',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80',
    chapter: 'CHAPTER 01 — NO LIMIT',
    featuredProductId: 'tori-shonen-04',
    status: 'ACTIVE',
  },
  {
    id: 'char-yuki',
    name: 'YUKI',
    alias: '02:17 RUNNER',
    japaneseName: '雪 • ユキ',
    department: 'MEN',
    world: 'CYBERPUNK / NEO TOKYO',
    role: 'Netrunner & Cybernetic Nomad',
    personality: ['Calculated', 'Sardonic', 'Futuristic', 'Free Spirit'],
    symbol: '💻 Hologram Jack',
    description: 'Skims through encrypted radio bands on her phantom motorbike through the midnight downpour.',
    storyQuote: 'In a city illuminated by a billion neon signs, the only truth is your own trajectory.',
    signatureStyle: 'Cyan screen graphics with micro-printed binary protocols and barcode hem tags.',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
    chapter: 'CHAPTER 02 — MIDNIGHT PROTOCOL',
    featuredProductId: 'tori-cyber-01',
    status: 'ACTIVE',
  },
  {
    id: 'char-aki',
    name: 'AKI',
    alias: 'THE LAST RONIN',
    japaneseName: '秋 • アキ',
    department: 'MEN',
    world: 'SAMURAI / MYTHIC JAPAN',
    role: 'Modern Wayfarer & Mythic Swordsman',
    personality: ['Discipline', 'Honor', 'Poetic', 'Protector'],
    symbol: '⚔️ Crescent Blade',
    description: 'Carries a cracked obsidian katana into neon alleys, honoring ancestral codes in a synthetic world.',
    storyQuote: 'A blade doesn’t seek blood. It seeks balance between chaos and stillness.',
    signatureStyle: 'Sumi-e ink graphic backs paired with structured 1.25" ribbing and vermilion side tags.',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=80',
    chapter: 'CHAPTER 02 — THE RED MOON',
    featuredProductId: 'tori-samurai-01',
    status: 'ACTIVE',
  },
  {
    id: 'char-kami-zero',
    name: 'KAMI & ZERO',
    alias: 'THE SKY GUARDS',
    japaneseName: '神とゼロ',
    department: 'KIDS',
    world: 'CUTE ADVENTURE',
    role: 'Young Shinobi Companions',
    personality: ['Playful', 'Joyful', 'Adventurous', 'Loyal'],
    symbol: '⭐ Golden Star Spark',
    description: 'A baby cloud dragon and his cheerful miniature robot companion exploring mythical cloud realms.',
    storyQuote: 'Together, there is no storm we cannot turn into a playground of stars!',
    signatureStyle: 'Super-soft 100% bio-washed cotton in vibrant cyan, sunny yellow, and lilac.',
    avatarUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=500&auto=format&fit=crop&q=80',
    chapter: 'KIDS SAGA — CLOUD ODYSSEY',
    featuredProductId: 'tori-kids-adv-01',
    status: 'ACTIVE',
  },
];

// ================= STORY BEHIND THE DESIGNS =================
export interface StoryBehindDesign {
  id: string;
  productName: string;
  world: string;
  tagline: string;
  lore: string;
  image: string;
  coordinates: string;
}

export const STORIES_BEHIND_DESIGNS: StoryBehindDesign[] = [
  {
    id: 'story-void-walker',
    productName: 'VOID WALKER',
    world: 'DARK SHONEN',
    tagline: 'POWER HAS A PRICE.',
    lore: 'Some people run from the darkness. Ren learned to walk through it. Hand-drawn brushwork capturing the exact moment a warrior embraces his internal shadow without losing his humanity.',
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80',
    coordinates: 'SECTOR 04 // 35.6762° N, 139.6503° E',
  },
  {
    id: 'story-0217-am',
    productName: '02:17 AM',
    world: 'CYBERPUNK / NEO TOKYO',
    tagline: 'NIGHT RUNS & RAIN-SLICKED MEMORIES.',
    lore: 'The exact minute the city turns off its voice and turns on its soul. Inspired by late-night solo motorcycle rides through the Shibuya highway overpasses during torrential monsoon rain.',
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&auto=format&fit=crop&q=80',
    coordinates: 'HIGHWAY LOOP 01 // OVERPASS 7',
  },
  {
    id: 'story-player-01',
    productName: 'PLAYER 01',
    world: 'RETRO Y2K',
    tagline: 'INSERT COIN TO CONTINUE.',
    lore: 'A love letter to low-resolution tube monitors, late-night sleepovers, and cheat code notebooks. Built for those whose childhood was spent discovering secret bosses behind pixelated walls.',
    image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900&auto=format&fit=crop&q=80',
    coordinates: 'ARCADE ZONE 1999 // MEMORY CARD #1',
  },
  {
    id: 'story-broken-blade',
    productName: 'BROKEN BLADE',
    world: 'SAMURAI / MYTHIC JAPAN',
    tagline: 'THE UNBROKEN SPIRIT.',
    lore: 'Honor isn’t in an unbroken weapon. It is in the hands that keep fighting when the metal gives way. Traditional calligraphy merged with brutalist monochrome street graphics.',
    image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&auto=format&fit=crop&q=80',
    coordinates: 'SHINTO GROVE // ALTITUDE 1,420M',
  },
  {
    id: 'story-tori-001',
    productName: 'TORI 001',
    world: 'STREET ANIME',
    tagline: 'CHAPTER ONE OF YOUR WORLD.',
    lore: 'The foundational garment of the brand. Heavyweight 240 GSM combed cotton with understated chest typography and a full architectural manga grid across the back.',
    image: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=900&auto=format&fit=crop&q=80',
    coordinates: 'TORI ARCHIVES // 001-ORIGINALS',
  },
];

// ================= SIZE CHARTS =================
export const SIZE_CHART_MEN = [
  { size: 'S', chest: '42"', length: '27"', shoulder: '21.5"', sleeve: '8.5"' },
  { size: 'M', chest: '44"', length: '28"', shoulder: '22.5"', sleeve: '9.0"' },
  { size: 'L', chest: '46"', length: '29"', shoulder: '23.5"', sleeve: '9.5"' },
  { size: 'XL', chest: '48"', length: '30"', shoulder: '24.5"', sleeve: '10.0"' },
  { size: 'XXL', chest: '50"', length: '31"', shoulder: '25.5"', sleeve: '10.5"' },
  { size: 'XXXL', chest: '52"', length: '32"', shoulder: '26.5"', sleeve: '11.0"' },
];

export const SIZE_CHART_KIDS = [
  { size: '2–3Y', chest: '24"', length: '16"', shoulder: '11.0"', height: '92–98 cm' },
  { size: '4–5Y', chest: '26"', length: '18"', shoulder: '12.0"', height: '104–110 cm' },
  { size: '6–7Y', chest: '28"', length: '20"', shoulder: '13.0"', height: '116–122 cm' },
  { size: '8–9Y', chest: '30"', length: '22"', shoulder: '14.0"', height: '128–134 cm' },
  { size: '10–11Y', chest: '32"', length: '24"', shoulder: '15.0"', height: '140–146 cm' },
  { size: '12–13Y', chest: '34"', length: '26"', shoulder: '16.0"', height: '152–158 cm' },
];

export const DROPS = [
  {
    id: 'CHAPTER 01',
    title: 'CHAPTER 01 — ORIGINALS',
    subtitle: 'The genesis drop of our proprietary anime streetwear universe',
    count: '10 WORLDS',
    status: 'ACTIVE NOW',
    badge: 'FLAGSHIP DROP',
  },
  {
    id: 'NEO TOKYO',
    title: 'NEO TOKYO RUNWAY',
    subtitle: 'High-density puff prints and midnight cyberpunk fits',
    count: 'LIMITED RUN',
    status: 'AVAILABLE',
    badge: 'EXCLUSIVE',
  },
  {
    id: 'MYTHIC SAGA',
    title: 'MYTHIC RONIN SAGA',
    subtitle: 'Traditional sumi-e Japanese ink brush merged with oversized silhouettes',
    count: 'RESTOCKED',
    status: 'SELLING FAST',
    badge: 'TRENDING',
  },
];

export const LOOKBOOK_ITEMS = [
  {
    id: 'look-1',
    customer: 'Devansh K.',
    city: 'Mumbai',
    tee: 'VOID WALKER (Dark Shonen)',
    size: 'Size XL (Oversized)',
    image: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=700&auto=format&fit=crop&q=80',
    quote: 'The 240 GSM weight is unreal. It sits on the shoulders like high-end designer streetwear.',
  },
  {
    id: 'look-2',
    customer: 'Aanya & Kabir',
    city: 'Bangalore',
    tee: 'LITTLE DRAGON + NEON RONIN',
    size: 'Kids 6–7Y & Men L',
    image: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?w=700&auto=format&fit=crop&q=80',
    quote: 'Matching our anime fits! The kids tees are so soft and breathable, and the graphics stay bold.',
  },
  {
    id: 'look-3',
    customer: 'Karthik S.',
    city: 'New Delhi',
    tee: '02:17 AM (Cyberpunk)',
    size: 'Size XXL',
    image: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=700&auto=format&fit=crop&q=80',
    quote: 'Finally an Indian streetwear brand that creates its own characters instead of cheap rip-offs.',
  },
  {
    id: 'look-4',
    customer: 'Tanvi M.',
    city: 'Pune',
    tee: 'TORI 001 (Street Anime)',
    size: 'Size M',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&auto=format&fit=crop&q=80',
    quote: 'Minimal, clean, and genuinely stylish even in formal casual settings. Best drop of 2026.',
  },
];

export const TORI_FEED_POSTS = [
  {
    id: 1,
    handle: '@toriwear.official',
    caption: 'Wear your world. Not a fan tee. Your universe. Chapter 01 available pan-India.',
    image: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=600&auto=format&fit=crop&q=80',
    likes: '4.2k',
    tags: '#Toriwear #WearYourWorld #OriginalStreetwear',
  },
  {
    id: 2,
    handle: '@toriwear.kids',
    caption: 'For the young shinobis and little dragon riders. Soft organic cotton fits built for big adventures.',
    image: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600&auto=format&fit=crop&q=80',
    likes: '2.8k',
    tags: '#ToriKids #PlayfulUniverse #CuteAdventure',
  },
  {
    id: 3,
    handle: '@toriwear.studio',
    caption: 'Behind the sketchpad: Developing the character of Ren (Void Walker). Every line has a purpose.',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    likes: '6.1k',
    tags: '#CharacterDesign #OriginalAnime #MadeInIndia',
  },
  {
    id: 4,
    handle: '@toriwear.official',
    caption: 'Midnight rain over Neo Tokyo. Yuki’s signature drop 02:17 AM restocked today.',
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&auto=format&fit=crop&q=80',
    likes: '3.9k',
    tags: '#CyberpunkStreetwear #NeoTokyo #0217AM',
  },
];

export const SIZE_CHART = [
  { size: 'S', chest: '42"', length: '28"', shoulder: '21"', sleeve: '8.5"' },
  { size: 'M', chest: '44"', length: '29"', shoulder: '22"', sleeve: '9.0"' },
  { size: 'L', chest: '46"', length: '30"', shoulder: '23"', sleeve: '9.5"' },
  { size: 'XL', chest: '48"', length: '31"', shoulder: '24"', sleeve: '10.0"' },
  { size: 'XXL', chest: '50"', length: '32"', shoulder: '25"', sleeve: '10.5"' },
  { size: 'XXXL', chest: '52"', length: '33"', shoulder: '26"', sleeve: '11.0"' },
];

export const KIDS_SIZE_CHART = [
  { size: '2–3Y', chest: '24"', length: '16"', shoulder: '10.5"' },
  { size: '4–5Y', chest: '26"', length: '18"', shoulder: '11.5"' },
  { size: '6–7Y', chest: '28"', length: '20"', shoulder: '12.5"' },
  { size: '8–9Y', chest: '30"', length: '22"', shoulder: '13.5"' },
  { size: '10–11Y', chest: '32"', length: '24"', shoulder: '14.5"' },
  { size: '12–13Y', chest: '34"', length: '26"', shoulder: '15.5"' },
];

export const KIDS_AGE_GROUPS = ['2–3Y', '4–5Y', '6–7Y', '8–9Y', '10–11Y', '12–13Y'] as const;
export type KidsAgeGroup = typeof KIDS_AGE_GROUPS[number];

export const FAQS = [
  {
    question: 'What makes TORIWEAR different from other anime t-shirt brands?',
    answer: 'TORIWEAR does not sell generic merchandise or copy existing copyrighted characters. We create our own characters, our own stories, our own graphic language and our own anime-inspired universes translated into heavyweight luxury streetwear.',
  },
  {
    question: 'What are the two primary departments on TORIWEAR?',
    answer: 'TORIWEAR is structured around two distinct departments: MEN (featuring 5 darker, high-fashion anime worlds: Dark Shonen, Cyberpunk / Neo Tokyo, Retro Y2K, Samurai / Mythic Japan, and Street Anime) and KIDS (featuring 5 fun, playful, age-appropriate worlds: Cute Adventure, Robot & Future, Retro Game, Mini Samurai, and Fantasy Creatures).',
  },
  {
    question: 'What fabric and fit standards do you use?',
    answer: 'Men’s products are crafted from custom-milled 240 GSM 100% combed cotton with structured drop-shoulder oversized silhouettes. Kids’ products are cut from ultra-soft 180 GSM bio-washed combed cotton designed for all-day comfort and play.',
  },
  {
    question: 'How long does pan-India shipping take?',
    answer: 'Orders are dispatched within 24 hours from our fulfillment hub. Metro deliveries take 2 to 4 business days; rest of India takes 3 to 6 days with live SMS and WhatsApp tracking.',
  },
  {
    question: 'Do you offer Cash on Delivery (COD) and Easy Exchanges?',
    answer: 'Yes! Cash on Delivery is available across 19,000+ pin codes. We also provide a hassle-free 7-day exchange window if you ever need a different size.',
  },
];


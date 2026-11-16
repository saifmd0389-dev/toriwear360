import { Product } from '../types';

export interface TwinComboPair {
  menProduct: Product;
  kidsProduct: Product;
  comboDesignName: string;
  originalCombinedPrice: number;
  discountedComboPrice: number;
  savingsAmount: number;
  description: string;
}

/**
 * Curated pairings between Men's 240 GSM Streetwear and Kids' 180 GSM Storywear
 * sharing identical or complementary Tokyo anime artwork for family & sibling twinning.
 */
const CURATED_PAIRS: { menDesign: string; kidsDesign: string; comboName: string; story: string }[] = [
  {
    menDesign: 'VOID WALKER',
    kidsDesign: 'LITTLE DRAGON',
    comboName: 'Void & Dragon Twin Capsule',
    story: 'Father & Kid dark fantasy pair. Heavyweight 240 GSM for adults, breathable ultra-soft 180 GSM for young heroes.',
  },
  {
    menDesign: 'NEON RONIN',
    kidsDesign: 'TINY NINJA',
    comboName: 'Neo Tokyo Shinobi Combo',
    story: 'Matching cyberpunk katana artwork. Glow-in-the-dark cyber aesthetic for street runs and playground adventures.',
  },
  {
    menDesign: 'LAST BLOOD',
    kidsDesign: 'FOREST HERO',
    comboName: 'Crimson & Forest Explorer Pair',
    story: 'Shared warrior spirit in complementary earthy and crimson tones.',
  },
  {
    menDesign: '02:17 AM',
    kidsDesign: 'ROBO PUPPY',
    comboName: 'Cyber Mecha Family Set',
    story: 'Tokyo midnight sci-fi graphics paired with cute futuristic companion mech.',
  },
  {
    menDesign: 'SHADOW CODE',
    kidsDesign: 'PIXEL KNIGHT',
    comboName: 'Retro Arcade Twinning Drop',
    story: 'Classic 8-bit & stealth anime aesthetics for gaming dads and retro-loving kids.',
  },
  {
    menDesign: 'INNER BEAST',
    kidsDesign: 'CANDY MONSTER',
    comboName: 'Spirit Beast Duo',
    story: 'Mythic spirit artwork scaled for bold streetwear and adorable kids storywear.',
  },
];

/**
 * Finds the twin matching counterpart for any given product (Men <-> Kids).
 */
export function getTwinProduct(product: Product, allProducts: Product[]): Product | null {
  if (!product || !allProducts || allProducts.length === 0) return null;

  const targetDept = product.department === 'MEN' ? 'KIDS' : 'MEN';
  const candidates = allProducts.filter((p) => p.department === targetDept);
  if (candidates.length === 0) return null;

  // 1. Check curated pairings first
  const currentName = product.name.trim().toUpperCase();
  for (const pair of CURATED_PAIRS) {
    if (product.department === 'MEN' && currentName.includes(pair.menDesign)) {
      const match = candidates.find((k) => k.name.toUpperCase().includes(pair.kidsDesign));
      if (match) return match;
    } else if (product.department === 'KIDS' && currentName.includes(pair.kidsDesign)) {
      const match = candidates.find((m) => m.name.toUpperCase().includes(pair.menDesign));
      if (match) return match;
    }
  }

  // 2. Check identical or similar name keywords
  const firstWord = currentName.split(' ')[0] || '';
  const keywordMatch = firstWord ? candidates.find((p) => p.name.toUpperCase().includes(firstWord)) : undefined;
  if (keywordMatch) return keywordMatch;

  // 3. Fallback to candidate in matching world theme or first candidate
  return candidates[0] || null;
}

/**
 * Calculates twinning combo bundle pricing with a 10% discount.
 */
export function getComboPricing(menProduct: Product, kidsProduct: Product): {
  originalTotal: number;
  comboPrice: number;
  savings: number;
  discountPercent: number;
} {
  const originalTotal = menProduct.price + kidsProduct.price;
  const discountPercent = 10;
  const savings = Math.round(originalTotal * (discountPercent / 100));
  const comboPrice = originalTotal - savings;

  return {
    originalTotal,
    comboPrice,
    savings,
    discountPercent,
  };
}

import { Product, KidsWorldCategory } from '../types';
import { isPublishedProduct } from './productFilters';

export { isPublishedProduct };

/**
 * Validates that a product is a published Kids department product.
 */
export function isPublishedKidsProduct(product: Product): boolean {
  if (!product || product.department !== 'KIDS') return false;
  return isPublishedProduct(product);
}

/**
 * Checks if a product matches the selected Kids world ('ALL' or specific world).
 */
export function matchesKidsWorld(
  product: Product,
  selectedWorld: KidsWorldCategory | 'ALL'
): boolean {
  if (!product) return false;
  if (!selectedWorld || selectedWorld === 'ALL') return true;
  return String(product.world).trim().toUpperCase() === String(selectedWorld).trim().toUpperCase();
}

/**
 * Checks if a product matches the selected Kids age bracket ('ALL' or e.g. '4–5Y').
 * Evaluates against product.ageGroups first, with safe fallback to product.sizes.
 */
export function matchesKidsAge(product: Product, selectedAge: string): boolean {
  if (!product) return false;
  if (!selectedAge || selectedAge === 'ALL') return true;

  const normalizedTarget = selectedAge.replace('-', '–').trim();

  // Primary: Check dedicated ageGroups field
  if (Array.isArray(product.ageGroups) && product.ageGroups.length > 0) {
    return product.ageGroups.some((ag) => ag.replace('-', '–').trim() === normalizedTarget);
  }

  // Fallback: Check sizes array if it contains age ranges
  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    return product.sizes.some((sz) => sz.replace('-', '–').trim() === normalizedTarget);
  }

  return false;
}

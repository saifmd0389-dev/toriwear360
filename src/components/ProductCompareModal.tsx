import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ArrowLeftRight,
  Search,
  ShoppingBag,
  Check,
  Star,
  ExternalLink,
  Scale,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { Product } from '../types';
import { isPublishedProduct } from '../utils/productFilters';

interface ProductCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProducts: Product[];
  selectedProducts: [Product | null, Product | null];
  onSelectSlot: (slotIndex: 0 | 1, product: Product | null) => void;
  onSwapSlots: () => void;
  onAddToCart: (product: Product, size: string, color: string) => void;
  onOpenProductDetail: (product: Product) => void;
}

const DEFAULT_MEN_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const DEFAULT_KIDS_SIZES = ['2-3Y', '3-4Y', '4-5Y', '5-6Y', '7-8Y', '9-10Y', '11-12Y'];

function resolveProductColors(product: Product): { name: string; hex: string }[] {
  if (Array.isArray(product.colors) && product.colors.length > 0) {
    const cleaned = product.colors.filter(
      (c): c is { name: string; hex: string } =>
        Boolean(c && typeof c.name === 'string' && c.name.trim() && typeof c.hex === 'string' && c.hex.trim())
    );
    if (cleaned.length > 0) return cleaned;
  }

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const seen = new Set<string>();
    const fromVariants: { name: string; hex: string }[] = [];
    product.variants.forEach((v: Record<string, unknown>) => {
      const name =
        typeof v?.colorName === 'string'
          ? v.colorName.trim()
          : typeof v?.color === 'string'
          ? v.color.trim()
          : '';
      const hex =
        typeof v?.colorHex === 'string'
          ? v.colorHex.trim()
          : typeof v?.hex === 'string'
          ? v.hex.trim()
          : '#111115';
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        fromVariants.push({ name, hex });
      }
    });
    if (fromVariants.length > 0) return fromVariants;
  }

  return [{ name: 'Obsidian Black', hex: '#111115' }];
}

function resolveProductSizes(product: Product): string[] {
  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    return product.sizes;
  }
  return product.department === 'KIDS' ? DEFAULT_KIDS_SIZES : DEFAULT_MEN_SIZES;
}

function resolveOverallStock(product: Product): {
  isInStock: boolean;
  label: string;
  tone: 'in' | 'low' | 'out';
} {
  if (product.inStock === false) {
    return { isInStock: false, label: 'Out of Stock', tone: 'out' };
  }
  if (typeof product.stock === 'number') {
    if (product.stock <= 0) {
      return { isInStock: false, label: 'Out of Stock', tone: 'out' };
    }
    if (product.stock <= 5) {
      return {
        isInStock: true,
        label: `Low Stock (${product.stock} left)`,
        tone: 'low',
      };
    }
  }
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const variantStocks = product.variants
      .map((v: Record<string, unknown>) => (typeof v?.stock === 'number' ? v.stock : null))
      .filter((s): s is number => s !== null);
    if (variantStocks.length > 0) {
      const totalVariantStock = variantStocks.reduce((sum, n) => sum + n, 0);
      if (totalVariantStock <= 0) {
        return { isInStock: false, label: 'Out of Stock', tone: 'out' };
      }
      if (totalVariantStock <= 5) {
        return {
          isInStock: true,
          label: `Low Stock (${totalVariantStock} left)`,
          tone: 'low',
        };
      }
    }
  }
  return { isInStock: true, label: 'In Stock · Ready to Ship', tone: 'in' };
}

function getDiscountPercent(product: Product): number {
  if (!product.originalPrice || product.originalPrice <= product.price) return 0;
  return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
}

export const ProductCompareModal: React.FC<ProductCompareModalProps> = ({
  isOpen,
  onClose,
  allProducts,
  selectedProducts,
  onSelectSlot,
  onSwapSlots,
  onAddToCart,
  onOpenProductDetail,
}) => {
  const [pickerSlot, setPickerSlot] = useState<0 | 1 | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerDept, setPickerDept] = useState<'ALL' | 'MEN' | 'KIDS'>('ALL');
  const [differencesOnly, setDifferencesOnly] = useState(false);

  const [slotSizes, setSlotSizes] = useState<[string, string]>(['L', 'L']);
  const [slotColors, setSlotColors] = useState<[string, string]>(['', '']);
  const [addedSlotFeedback, setAddedSlotFeedback] = useState<[boolean, boolean]>([false, false]);

  const [productA, productB] = selectedProducts;

  // Authoritative published catalog pool for selection
  const catalogPool = useMemo(() => {
    const published = (allProducts || []).filter(isPublishedProduct);
    return published.length > 0 ? published : allProducts || [];
  }, [allProducts]);

  // Sync default size and color whenever a product changes in Slot A or Slot B
  useEffect(() => {
    setSlotSizes((prev) => {
      const nextA = productA
        ? resolveProductSizes(productA).includes(prev[0])
          ? prev[0]
          : productA.department === 'KIDS'
          ? resolveProductSizes(productA)[2] || resolveProductSizes(productA)[0] || '5-6Y'
          : resolveProductSizes(productA).includes('L')
          ? 'L'
          : resolveProductSizes(productA)[0] || 'L'
        : 'L';
      const nextB = productB
        ? resolveProductSizes(productB).includes(prev[1])
          ? prev[1]
          : productB.department === 'KIDS'
          ? resolveProductSizes(productB)[2] || resolveProductSizes(productB)[0] || '5-6Y'
          : resolveProductSizes(productB).includes('L')
          ? 'L'
          : resolveProductSizes(productB)[0] || 'L'
        : 'L';
      return [nextA, nextB];
    });

    setSlotColors((prev) => {
      const colorsA = productA ? resolveProductColors(productA) : [];
      const colorsB = productB ? resolveProductColors(productB) : [];
      const nextA = productA
        ? colorsA.some((c) => c.name === prev[0])
          ? prev[0]
          : colorsA[0]?.name || 'Obsidian Black'
        : '';
      const nextB = productB
        ? colorsB.some((c) => c.name === prev[1])
          ? prev[1]
          : colorsB[0]?.name || 'Obsidian Black'
        : '';
      return [nextA, nextB];
    });
  }, [productA?.id, productB?.id]);

  // Escape key & body scroll lock
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pickerSlot !== null) {
          setPickerSlot(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, pickerSlot, onClose]);

  // Reset picker search when closed
  useEffect(() => {
    if (!isOpen) {
      setPickerSlot(null);
      setPickerSearch('');
      setPickerDept('ALL');
    }
  }, [isOpen]);

  const filteredPickerProducts = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return catalogPool.filter((p) => {
      if (pickerDept !== 'ALL' && p.department !== pickerDept) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.world || '').toLowerCase().includes(q) ||
        (p.franchise || '').toLowerCase().includes(q) ||
        (p.catalogNumber || '').toLowerCase().includes(q) ||
        (p.fit || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
      );
    });
  }, [catalogPool, pickerDept, pickerSearch]);

  if (!isOpen) return null;

  const bothSelected = Boolean(productA && productB);
  const priceDiff =
    productA && productB ? Math.abs(Number(productA.price || 0) - Number(productB.price || 0)) : 0;

  const colorsA = productA ? resolveProductColors(productA) : [];
  const colorsB = productB ? resolveProductColors(productB) : [];
  const sizesA = productA ? resolveProductSizes(productA) : [];
  const sizesB = productB ? resolveProductSizes(productB) : [];
  const stockA = productA ? resolveOverallStock(productA) : null;
  const stockB = productB ? resolveOverallStock(productB) : null;

  const handleQuickComparePair = () => {
    const first = catalogPool[0] || null;
    const second =
      catalogPool.find((p) => first && p.id !== first.id && p.department === first.department) ||
      catalogPool.find((p) => first && p.id !== first.id) ||
      null;
    if (first) onSelectSlot(0, first);
    if (second) onSelectSlot(1, second);
  };

  const handleAddColumnToBag = (slotIdx: 0 | 1) => {
    const target = slotIdx === 0 ? productA : productB;
    if (!target) return;
    const chosenSize = slotSizes[slotIdx] || resolveProductSizes(target)[0] || 'L';
    const chosenColor = slotColors[slotIdx] || resolveProductColors(target)[0]?.name || 'Obsidian Black';
    onAddToCart(target, chosenSize, chosenColor);
    setAddedSlotFeedback((prev) =>
      slotIdx === 0 ? [true, prev[1]] : [prev[0], true]
    );
    setTimeout(() => {
      setAddedSlotFeedback((prev) =>
        slotIdx === 0 ? [false, prev[1]] : [prev[0], false]
      );
    }, 1800);
  };

  // Specification rows metadata for consistent comparison & differences filter
  type SpecRow = {
    key: string;
    label: string;
    valA: string;
    valB: string;
    isDifferent: boolean;
    highlightBetter?: 'A' | 'B' | null;
  };

  const specRows: SpecRow[] = [];
  if (productA || productB) {
    const valDeptA = productA ? `${productA.department} · ${productA.world}` : '—';
    const valDeptB = productB ? `${productB.department} · ${productB.world}` : '—';
    specRows.push({
      key: 'department-world',
      label: 'Department & World',
      valA: valDeptA,
      valB: valDeptB,
      isDifferent: bothSelected && valDeptA !== valDeptB,
    });

    const valFitA = productA?.fit || '—';
    const valFitB = productB?.fit || '—';
    specRows.push({
      key: 'fit',
      label: 'Fit Silhouette',
      valA: valFitA,
      valB: valFitB,
      isDifferent: bothSelected && valFitA.toLowerCase() !== valFitB.toLowerCase(),
    });

    const gsmA = Number(productA?.gsm || 240);
    const gsmB = Number(productB?.gsm || 240);
    const valFabricA = productA ? `${gsmA} GSM · ${productA.fabric || '100% Combed Cotton'}` : '—';
    const valFabricB = productB ? `${gsmB} GSM · ${productB.fabric || '100% Combed Cotton'}` : '—';
    specRows.push({
      key: 'fabric-gsm',
      label: 'Fabric & GSM Weight',
      valA: valFabricA,
      valB: valFabricB,
      isDifferent: bothSelected && valFabricA.toLowerCase() !== valFabricB.toLowerCase(),
      highlightBetter: bothSelected && gsmA !== gsmB ? (gsmA > gsmB ? 'A' : 'B') : null,
    });

    const valNeckA = productA?.neck || 'Reinforced Crew Neck';
    const valNeckB = productB?.neck || 'Reinforced Crew Neck';
    specRows.push({
      key: 'neck',
      label: 'Neckline',
      valA: productA ? valNeckA : '—',
      valB: productB ? valNeckB : '—',
      isDifferent: bothSelected && valNeckA.toLowerCase() !== valNeckB.toLowerCase(),
    });

    const valSleevesA = productA?.sleeves || 'Relaxed Drop Sleeves';
    const valSleevesB = productB?.sleeves || 'Relaxed Drop Sleeves';
    specRows.push({
      key: 'sleeves',
      label: 'Sleeves',
      valA: productA ? valSleevesA : '—',
      valB: productB ? valSleevesB : '—',
      isDifferent: bothSelected && valSleevesA.toLowerCase() !== valSleevesB.toLowerCase(),
    });

    const valPrintA = productA ? productA.printType || productA.print || 'High-Density Screen Print' : '—';
    const valPrintB = productB ? productB.printType || productB.print || 'High-Density Screen Print' : '—';
    specRows.push({
      key: 'print',
      label: 'Print Specification',
      valA: valPrintA,
      valB: valPrintB,
      isDifferent: bothSelected && valPrintA.toLowerCase() !== valPrintB.toLowerCase(),
    });

    const valLicenseA = productA
      ? `${productA.licenseType || 'Original IP'} · ${productA.drop || 'Core Capsule'}`
      : '—';
    const valLicenseB = productB
      ? `${productB.licenseType || 'Original IP'} · ${productB.drop || 'Core Capsule'}`
      : '—';
    specRows.push({
      key: 'license-drop',
      label: 'Edition & Drop',
      valA: valLicenseA,
      valB: valLicenseB,
      isDifferent: bothSelected && valLicenseA.toLowerCase() !== valLicenseB.toLowerCase(),
    });

    const valCareA = productA
      ? productA.careInstructions || 'Cold gentle machine wash inside out. Do not iron directly on print.'
      : '—';
    const valCareB = productB
      ? productB.careInstructions || 'Cold gentle machine wash inside out. Do not iron directly on print.'
      : '—';
    specRows.push({
      key: 'care',
      label: 'Care Instructions',
      valA: valCareA,
      valB: valCareB,
      isDifferent: bothSelected && valCareA.toLowerCase() !== valCareB.toLowerCase(),
    });
  }

  const displayedSpecRows = differencesOnly && bothSelected ? specRows.filter((r) => r.isDifferent) : specRows;

  const renderSlotHeader = (slotIdx: 0 | 1) => {
    const item = slotIdx === 0 ? productA : productB;
    const otherItem = slotIdx === 0 ? productB : productA;

    if (!item) {
      return (
        <div className="h-full min-h-[240px] border border-dashed border-neutral-300 bg-[#faf9f6] p-5 flex flex-col items-center justify-center text-center">
          <div className="w-11 h-11 border border-neutral-300 bg-white flex items-center justify-center text-neutral-700 mb-3">
            <Plus className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-neutral-900">
            Select Product {slotIdx === 0 ? 'One' : 'Two'}
          </p>
          <p className="text-xs text-neutral-500 mt-1 max-w-[220px]">
            Choose any piece from the catalog to compare fabric weight, pricing, and available shades.
          </p>
          <button
            type="button"
            onClick={() => setPickerSlot(slotIdx)}
            className="mt-4 px-4 py-2 bg-[#111115] hover:bg-[#FF2028] text-white text-xs font-semibold tracking-wide transition cursor-pointer min-h-[40px]"
          >
            Choose from Catalog
          </button>
        </div>
      );
    }

    const discPercent = getDiscountPercent(item);
    const isLowerPrice =
      bothSelected &&
      priceDiff > 0 &&
      ((slotIdx === 0 && Number(productA!.price) < Number(productB!.price)) ||
        (slotIdx === 1 && Number(productB!.price) < Number(productA!.price)));

    return (
      <div className="flex flex-col h-full justify-between border border-neutral-200 bg-white p-3.5 sm:p-4">
        <div>
          {/* Top action bar: slot label + change/clear */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
              {item.catalogNumber || item.sku || `Item ${slotIdx + 1}`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPickerSlot(slotIdx)}
                className="px-2.5 py-1 border border-neutral-300 hover:border-neutral-900 bg-white text-neutral-800 text-[11px] font-medium transition cursor-pointer"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => onSelectSlot(slotIdx, null)}
                aria-label={`Remove ${item.name} from comparison`}
                title="Clear selection"
                className="w-7 h-7 flex items-center justify-center border border-neutral-200 hover:border-neutral-900 text-neutral-500 hover:text-neutral-900 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Product thumbnail + core metadata */}
          <div className="flex flex-col sm:flex-row gap-3.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProductDetail(item);
              }}
              className="w-full sm:w-24 aspect-[3/4] bg-[#f5f5f3] border border-neutral-200 overflow-hidden shrink-0 cursor-pointer group"
              title={`Open ${item.name}`}
            >
              <img
                src={
                  item.images?.[0] ||
                  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80'
                }
                alt={item.name}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
              />
            </button>

            <div className="min-w-0 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-[11px] text-neutral-500 truncate">
                  <span>{item.department === 'KIDS' ? 'Kids' : 'Men'}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{item.world}</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-950 leading-snug mt-0.5 line-clamp-2">
                  {item.name}
                </h3>

                {/* Rating */}
                <div className="flex items-center gap-1.5 text-xs text-neutral-600 mt-1.5 tabular-nums">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                  <span className="font-semibold text-neutral-900">{item.rating || '4.8'}</span>
                  <span className="text-neutral-400">({item.reviewsCount || 0})</span>
                </div>
              </div>

              {/* Pricing */}
              <div className="mt-3 pt-2.5 border-t border-neutral-100">
                <div className="flex flex-wrap items-baseline gap-2 tabular-nums">
                  <span className="text-lg sm:text-xl font-bold text-neutral-950">
                    ₹{Number(item.price || 0).toLocaleString('en-IN')}
                  </span>
                  {item.originalPrice > item.price && (
                    <span className="text-xs text-neutral-400 line-through">
                      ₹{Number(item.originalPrice).toLocaleString('en-IN')}
                    </span>
                  )}
                  {discPercent > 0 && (
                    <span className="text-xs font-semibold text-[#e11b23]">
                      {discPercent}% off
                    </span>
                  )}
                </div>
                {isLowerPrice && (
                  <p className="text-[11px] font-medium text-emerald-700 mt-0.5 tabular-nums">
                    ₹{priceDiff.toLocaleString('en-IN')} lower than {otherItem?.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{ zIndex: 9999 }}
      className="fixed inset-0 flex items-center justify-center p-2 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-compare-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[92vh] bg-white text-neutral-900 border border-neutral-200 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-neutral-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#111115] text-white flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 id="product-compare-modal-title" className="text-base sm:text-lg font-bold text-neutral-950 tracking-tight">
                Side-by-Side Product Comparison
              </h2>
              <p className="text-xs text-neutral-500">
                Select two catalog pieces to compare specifications, pricing, and color availability
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {bothSelected && (
              <div className="flex items-center p-0.5 bg-neutral-100 border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setDifferencesOnly(false)}
                  className={`px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    !differencesOnly ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  All Specs
                </button>
                <button
                  type="button"
                  onClick={() => setDifferencesOnly(true)}
                  className={`px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    differencesOnly ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  Differences Only
                </button>
              </div>
            )}

            {(productA || productB) && (
              <button
                type="button"
                onClick={onSwapSlots}
                title="Swap left and right products"
                className="min-h-[40px] px-3 py-1.5 border border-neutral-300 hover:border-neutral-900 bg-white text-neutral-800 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Swap</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Comparison Modal"
              title="Close (Esc)"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center border border-neutral-200 hover:border-neutral-900 text-neutral-600 hover:text-neutral-950 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Comparison Body */}
        <div className="flex-1 overflow-y-auto bg-[#faf9f6]">
          <div className="p-4 sm:p-6 space-y-5">
            {/* Empty helper shortcut when neither slot has a product */}
            {!productA && !productB && catalogPool.length >= 2 && (
              <div className="bg-white border border-neutral-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    Start comparing any two drops
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Pick products individually below or load a sample pair from the live catalog.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleQuickComparePair}
                  className="px-4 py-2 bg-[#111115] hover:bg-[#FF2028] text-white text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 min-h-[40px]"
                >
                  Compare Top 2 Drops
                </button>
              </div>
            )}

            {/* Slot Selector Header Columns */}
            <div className="grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)] gap-3 sm:gap-4 items-stretch">
              <div className="hidden md:flex flex-col justify-end pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Selected Pieces
                </span>
                <span className="text-xs text-neutral-400 mt-0.5">
                  {productA && productB
                    ? 'Comparing 2 of 2 products'
                    : productA || productB
                    ? '1 selected — pick a 2nd product'
                    : '0 of 2 selected'}
                </span>
              </div>
              <div>{renderSlotHeader(0)}</div>
              <div>{renderSlotHeader(1)}</div>
            </div>

            {/* Matrix Content (shown as soon as at least 1 product is selected) */}
            {(productA || productB) && (
              <div className="bg-white border border-neutral-200 divide-y divide-neutral-200">
                {/* 1. Availability & Stock */}
                <div className="grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="px-4 py-3 bg-[#faf9f6] md:bg-transparent text-xs font-semibold text-neutral-700 border-b md:border-b-0 md:border-r border-neutral-200 flex items-center">
                    Availability
                  </div>
                  <div className="grid grid-cols-2 md:contents">
                    <div className="px-4 py-3 border-r border-neutral-200 text-xs flex items-center gap-1.5">
                      {stockA ? (
                        <>
                          {stockA.tone === 'out' && <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                          <span
                            className={`font-semibold ${
                              stockA.tone === 'out'
                                ? 'text-red-600'
                                : stockA.tone === 'low'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {stockA.label}
                          </span>
                        </>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </div>
                    <div className="px-4 py-3 text-xs flex items-center gap-1.5">
                      {stockB ? (
                        <>
                          {stockB.tone === 'out' && <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                          <span
                            className={`font-semibold ${
                              stockB.tone === 'out'
                                ? 'text-red-600'
                                : stockB.tone === 'low'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {stockB.label}
                          </span>
                        </>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Color Availability + Interactive Swatches with Tooltips */}
                <div className="grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="px-4 py-3.5 bg-[#faf9f6] md:bg-transparent text-xs font-semibold text-neutral-700 border-b md:border-b-0 md:border-r border-neutral-200 flex flex-col justify-center">
                    <span>Color Availability</span>
                    <span className="text-[11px] font-normal text-neutral-400 mt-0.5">
                      Hover or select shade
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:contents">
                    {[
                      { item: productA, list: colorsA, slotIdx: 0 as const },
                      { item: productB, list: colorsB, slotIdx: 1 as const },
                    ].map(({ item, list, slotIdx }) => (
                      <div
                        key={slotIdx}
                        className={`px-4 py-3.5 ${slotIdx === 0 ? 'border-r border-neutral-200' : ''}`}
                      >
                        {item ? (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-neutral-900">
                              <span>{list.length} {list.length === 1 ? 'shade' : 'shades'}</span>
                              {slotColors[slotIdx] && (
                                <>
                                  <span className="text-neutral-400"> · </span>
                                  <span className="font-semibold">{slotColors[slotIdx]}</span>
                                </>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5" role="radiogroup" aria-label={`Color selection for ${item.name}`}>
                              {list.map((color) => {
                                const isActive = slotColors[slotIdx]?.toLowerCase() === color.name.toLowerCase();
                                return (
                                  <div
                                    key={color.name}
                                    className="relative group/cmp-swatch inline-flex items-center justify-center"
                                  >
                                    <button
                                      type="button"
                                      role="radio"
                                      aria-checked={isActive}
                                      aria-label={`Select color ${color.name}`}
                                      onClick={() =>
                                        setSlotColors((prev) =>
                                          slotIdx === 0 ? [color.name, prev[1]] : [prev[0], color.name]
                                        )
                                      }
                                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer focus:outline-none ${
                                        isActive
                                          ? 'ring-2 ring-neutral-900 ring-offset-2 scale-105'
                                          : 'ring-1 ring-neutral-300 hover:ring-neutral-700 hover:scale-105 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2'
                                      }`}
                                    >
                                      <span
                                        className="w-full h-full rounded-full border border-black/15 shadow-inner"
                                        style={{ backgroundColor: color.hex }}
                                      />
                                    </button>
                                    <div
                                      role="tooltip"
                                      className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 opacity-0 translate-y-1 group-hover/cmp-swatch:opacity-100 group-hover/cmp-swatch:translate-y-0 group-focus-within/cmp-swatch:opacity-100 group-focus-within/cmp-swatch:translate-y-0 transition-all duration-150 flex flex-col items-center"
                                    >
                                      <div className="bg-[#111115] text-white text-[11px] font-semibold px-2 py-1 whitespace-nowrap shadow-md flex items-center gap-1.5">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0"
                                          style={{ backgroundColor: color.hex }}
                                        />
                                        <span>{color.name}</span>
                                      </div>
                                      <span className="w-2 h-2 bg-[#111115] rotate-45 -mt-1" aria-hidden="true" />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[11px] text-neutral-500 leading-relaxed">
                              {list.map((c) => c.name).join(', ')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Size Availability & Quick Size Pick */}
                <div className="grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="px-4 py-3.5 bg-[#faf9f6] md:bg-transparent text-xs font-semibold text-neutral-700 border-b md:border-b-0 md:border-r border-neutral-200 flex items-center">
                    Sizes Available
                  </div>
                  <div className="grid grid-cols-2 md:contents">
                    {[
                      { item: productA, sizes: sizesA, slotIdx: 0 as const },
                      { item: productB, sizes: sizesB, slotIdx: 1 as const },
                    ].map(({ item, sizes, slotIdx }) => (
                      <div
                        key={slotIdx}
                        className={`px-4 py-3.5 ${slotIdx === 0 ? 'border-r border-neutral-200' : ''}`}
                      >
                        {item ? (
                          <div className="flex flex-wrap gap-1.5">
                            {sizes.map((sz) => {
                              const varMatch = (item.variants || []).find(
                                (v: Record<string, unknown>) => v?.size === sz
                              );
                              const isOut =
                                item.inStock === false ||
                                (typeof item.stock === 'number' && item.stock === 0) ||
                                (varMatch && typeof varMatch.stock === 'number' && varMatch.stock === 0);
                              const isSelected = slotSizes[slotIdx] === sz;

                              return (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() =>
                                    setSlotSizes((prev) =>
                                      slotIdx === 0 ? [sz, prev[1]] : [prev[0], sz]
                                    )
                                  }
                                  className={`min-w-[36px] px-2 py-1 text-[11px] font-medium border transition cursor-pointer ${
                                    isSelected
                                      ? 'border-neutral-950 bg-neutral-950 text-white font-semibold'
                                      : isOut
                                      ? 'border-neutral-200 bg-neutral-50 text-neutral-300 line-through'
                                      : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900'
                                  }`}
                                >
                                  {sz}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Technical & Garment Specification Rows */}
                {displayedSpecRows.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-neutral-500">
                    Both products share identical garment specifications for the fields compared. Switch to "All Specs" to view complete details.
                  </div>
                ) : (
                  displayedSpecRows.map((row, idx) => (
                    <div
                      key={row.key}
                      className={`grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)] ${
                        row.isDifferent && !differencesOnly
                          ? 'bg-amber-50/35'
                          : idx % 2 === 1
                          ? 'bg-[#faf9f6]/50'
                          : 'bg-white'
                      }`}
                    >
                      <div className="px-4 py-3 text-xs font-semibold text-neutral-700 border-b md:border-b-0 md:border-r border-neutral-200 flex items-center justify-between gap-2">
                        <span>{row.label}</span>
                        {row.isDifferent && !differencesOnly && (
                          <span className="text-[10px] font-medium text-amber-700">Differs</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:contents">
                        <div className="px-4 py-3 border-r border-neutral-200 text-xs text-neutral-800 leading-relaxed">
                          <span className={row.highlightBetter === 'A' ? 'font-bold text-neutral-950' : ''}>
                            {row.valA}
                          </span>
                          {row.highlightBetter === 'A' && (
                            <span className="block text-[10px] font-semibold text-emerald-700 mt-0.5">
                              Heavier GSM fabric
                            </span>
                          )}
                        </div>
                        <div className="px-4 py-3 text-xs text-neutral-800 leading-relaxed">
                          <span className={row.highlightBetter === 'B' ? 'font-bold text-neutral-950' : ''}>
                            {row.valB}
                          </span>
                          {row.highlightBetter === 'B' && (
                            <span className="block text-[10px] font-semibold text-emerald-700 mt-0.5">
                              Heavier GSM fabric
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* 5. Direct Purchase & Detail Actions */}
                <div className="grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)] bg-white">
                  <div className="px-4 py-4 bg-[#faf9f6] md:bg-transparent text-xs font-semibold text-neutral-700 border-b md:border-b-0 md:border-r border-neutral-200 flex items-center">
                    Quick Actions
                  </div>
                  <div className="grid grid-cols-2 md:contents">
                    {[
                      { item: productA, stock: stockA, slotIdx: 0 as const },
                      { item: productB, stock: stockB, slotIdx: 1 as const },
                    ].map(({ item, stock, slotIdx }) => {
                      const isOut = stock ? !stock.isInStock : true;
                      const isAdded = addedSlotFeedback[slotIdx];
                      return (
                        <div
                          key={slotIdx}
                          className={`px-3 sm:px-4 py-4 flex flex-col sm:flex-row items-stretch gap-2 ${
                            slotIdx === 0 ? 'border-r border-neutral-200' : ''
                          }`}
                        >
                          {item ? (
                            <>
                              <button
                                type="button"
                                disabled={isOut}
                                onClick={() => handleAddColumnToBag(slotIdx)}
                                className={`flex-1 min-h-[40px] px-3 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer ${
                                  isOut
                                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                    : isAdded
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#e11b23] hover:bg-[#c6171e] text-white'
                                }`}
                              >
                                {isAdded ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Added</span>
                                  </>
                                ) : (
                                  <>
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                    <span>{isOut ? 'Out of Stock' : `Add (${slotSizes[slotIdx]})`}</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenProductDetail(item);
                                }}
                                className="min-h-[40px] px-3 py-2 border border-neutral-300 hover:border-neutral-900 bg-white text-neutral-900 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer shrink-0"
                              >
                                <span>Details</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-neutral-400 self-center">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Built-In Catalog Product Picker Overlay for Slot 1 / Slot 2 */}
        {pickerSlot !== null && (
          <div
            className="absolute inset-0 z-40 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in"
            onClick={() => setPickerSlot(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[82vh] bg-white border border-neutral-300 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-neutral-200 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-950">
                    Choose Product for Slot {pickerSlot + 1}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Showing {filteredPickerProducts.length} available catalog pieces
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerSlot(null)}
                  aria-label="Close product picker"
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center border border-neutral-200 hover:border-neutral-900 text-neutral-600 hover:text-neutral-950 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search & Department Filter */}
              <div className="p-3 sm:p-4 border-b border-neutral-200 bg-[#faf9f6] flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search by product name, world, fit, or catalog #..."
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 focus:border-neutral-900 focus:outline-none text-xs text-neutral-900"
                  />
                </div>
                <div className="flex items-center p-0.5 bg-neutral-200/70 border border-neutral-300 shrink-0">
                  {(['ALL', 'MEN', 'KIDS'] as const).map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setPickerDept(dept)}
                      className={`px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                        pickerDept === dept
                          ? 'bg-white text-neutral-950 shadow-xs font-semibold'
                          : 'text-neutral-600 hover:text-neutral-950'
                      }`}
                    >
                      {dept === 'ALL' ? 'All' : dept === 'MEN' ? 'Men' : 'Kids'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Catalog List */}
              <div className="flex-1 overflow-y-auto divide-y divide-neutral-200">
                {filteredPickerProducts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500">
                    No catalog products matched "{pickerSearch}". Try clearing filters.
                  </div>
                ) : (
                  filteredPickerProducts.map((candidate) => {
                    const currentSlotItem = pickerSlot === 0 ? productA : productB;
                    const oppositeSlotItem = pickerSlot === 0 ? productB : productA;
                    const isCurrent = currentSlotItem?.id === candidate.id;
                    const isInOpposite = oppositeSlotItem?.id === candidate.id;
                    const candColors = resolveProductColors(candidate);

                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => {
                          if (isInOpposite) {
                            onSwapSlots();
                          } else {
                            onSelectSlot(pickerSlot, candidate);
                          }
                          setPickerSlot(null);
                          setPickerSearch('');
                        }}
                        className={`w-full text-left p-3 sm:px-4 flex items-center gap-3.5 transition cursor-pointer ${
                          isCurrent
                            ? 'bg-neutral-100'
                            : 'hover:bg-[#faf9f6] bg-white'
                        }`}
                      >
                        <img
                          src={
                            candidate.images?.[0] ||
                            'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200&auto=format&fit=crop&q=75'
                          }
                          alt={candidate.name}
                          className="w-12 h-15 object-cover bg-neutral-100 border border-neutral-200 shrink-0"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-neutral-500 truncate">
                            <span>{candidate.catalogNumber}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{candidate.department === 'KIDS' ? 'Kids' : 'Men'}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{candidate.world}</span>
                          </div>
                          <div className="text-sm font-bold text-neutral-950 truncate">
                            {candidate.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              {candColors.slice(0, 5).map((col) => (
                                <span
                                  key={col.name}
                                  className="w-3 h-3 rounded-full border border-black/15"
                                  style={{ backgroundColor: col.hex }}
                                  title={col.name}
                                />
                              ))}
                            </div>
                            <span className="text-[11px] text-neutral-500">
                              {candColors.length} {candColors.length === 1 ? 'color' : 'colors'}
                            </span>
                            <span className="text-neutral-300" aria-hidden="true">·</span>
                            <span className="text-[11px] text-neutral-500">{candidate.fit}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-neutral-950 tabular-nums">
                            ₹{Number(candidate.price || 0).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[11px] mt-0.5 font-medium text-neutral-500">
                            {isCurrent ? (
                              <span className="text-emerald-700 font-semibold">Selected</span>
                            ) : isInOpposite ? (
                              <span className="text-neutral-700">Swap slots</span>
                            ) : (
                              <span className="text-[#FF2028]">Select →</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

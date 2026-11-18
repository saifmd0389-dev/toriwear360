import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminDataContext';
import { AdminProduct, AdminProductVariant, LicenseRightsStatus, PublishingStatus } from '../types';
import { AnimeFranchise, PopUniverse, FitType, StoreCategory } from '../../types';
import { apiClient } from '../../services/apiClient';
import { isValidProductImageUrl } from '../../utils/productFilters';
import { MEN_WORLDS, KIDS_WORLDS } from '../../data/constants';
import { uploadCmsImageAsset } from '../data/frontPageCmsData';
import {
  X,
  Package,
  DollarSign,
  Layers,
  Image as ImageIcon,
  ShieldCheck,
  AlertTriangle,
  Check,
  Trash2,
  Sparkles,
  AlertCircle,
  Plus,
  Upload,
  ArrowUp,
  ArrowDown,
  Star,
  Loader2,
  Link2,
} from 'lucide-react';

interface ProductEditorModalProps {
  product: AdminProduct | null; // If null, create mode
  isOpen: boolean;
  onClose: () => void;
}

const STREETWEAR_COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: 'Obsidian Black', hex: '#111115' },
  { name: 'Void Black', hex: '#0a0a0c' },
  { name: 'Charcoal Shadow', hex: '#27272a' },
  { name: 'Bone White', hex: '#f5f5f4' },
  { name: 'Ash Grey', hex: '#6b7280' },
  { name: 'Crimson Red', hex: '#dc2626' },
  { name: 'Blood Orange', hex: '#ea580c' },
  { name: 'Solar Yellow', hex: '#eab308' },
  { name: 'Forest Olive', hex: '#3f6212' },
  { name: 'Midnight Navy', hex: '#1e293b' },
  { name: 'Cobalt Blue', hex: '#2563eb' },
  { name: 'Royal Violet', hex: '#7c3aed' },
  { name: 'Sakura Pink', hex: '#ec4899' },
  { name: 'Sandstone Beige', hex: '#d6c7b2' },
];

export const ProductEditorModal: React.FC<ProductEditorModalProps> = ({ product, isOpen, onClose }) => {
  const { addProduct, updateProduct } = useAdmin();

  const [activeTab, setActiveTab] = useState<'GENERAL' | 'PRICING' | 'VARIANTS' | 'MEDIA'>('GENERAL');
  const [formError, setFormError] = useState<string | null>(null);
  
  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [department, setDepartment] = useState<'MEN' | 'KIDS'>('MEN');
  const [world, setWorld] = useState<string>('DARK SHONEN');
  const [franchise, setFranchise] = useState<AnimeFranchise>('Toriwear Originals');
  const [universe, setUniverse] = useState<PopUniverse>('ORIGINALS');
  const [category, setCategory] = useState<'T-Shirts' | 'Oversized Tees' | 'Hoodies' | 'Cargoes' | 'Accessories'>('Oversized Tees');
  const [fit, setFit] = useState<FitType>('Oversized');
  const [gsm, setGsm] = useState(240);
  const [fabric, setFabric] = useState('100% Combed Heavyweight Cotton');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [storyQuote, setStoryQuote] = useState('');
  const [drop, setDrop] = useState('DROP 002 — SHINOBI');
  
  // Pricing & IP
  const [price, setPrice] = useState(1199);
  const [mrp, setMrp] = useState(1599);
  const [costPrice, setCostPrice] = useState(450);
  const [gstRate, setGstRate] = useState(5);
  const [licenseRightsStatus, setLicenseRightsStatus] = useState<LicenseRightsStatus>('Owned IP');

  // Media (unlimited gallery images & unlimited file sizes via chunked streaming)
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrlInput, setNewImageUrlInput] = useState('');
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [publishingStatus, setPublishingStatus] = useState<PublishingStatus>('PUBLISHED');

  // Variants & interactive color/weight builder state
  const [variants, setVariants] = useState<AdminProductVariant[]>([]);
  const [selectedColorName, setSelectedColorName] = useState('Obsidian Black');
  const [selectedColorHex, setSelectedColorHex] = useState('#111115');
  const [defaultWeightGrams, setDefaultWeightGrams] = useState(340);
  const [customVariantSize, setCustomVariantSize] = useState('');
  const [customVariantStock, setCustomVariantStock] = useState(25);
  const [availableCategories, setAvailableCategories] = useState<StoreCategory[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    apiClient.getCategories('ALL', true).then((list) => setAvailableCategories(list)).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku);
      const dept = product.department || (product.universe === 'KIDS' ? 'KIDS' : 'MEN');
      setDepartment(dept);
      setWorld(product.world || (dept === 'KIDS' ? 'CUTE ADVENTURE' : 'DARK SHONEN'));
      setFranchise(product.franchise || 'Toriwear Originals');
      setUniverse(product.universe || (dept === 'KIDS' ? 'KIDS' : 'ORIGINALS'));
      setCategory(product.category);
      setFit(product.fit);
      setGsm(product.gsm);
      setFabric(product.fabric);
      setDescription(product.description);
      setShortDescription(product.shortDescription);
      setStoryQuote(product.storyQuote || '');
      setDrop(product.drop);
      setPrice(product.price);
      setMrp(product.mrp);
      setCostPrice(product.costPrice);
      setGstRate(product.gstRate);
      setLicenseRightsStatus(product.licenseRightsStatus);
      setImageUrls(
        Array.isArray(product.images) && product.images.length > 0
          ? product.images.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
          : ['']
      );
      setNewImageUrlInput('');
      setPublishingStatus(product.publishingStatus);
      setCategoryIds(Array.isArray(product.categoryIds) ? product.categoryIds : []);
      const initialVariants = product.variants || [];
      setVariants(initialVariants);
      const firstVariant = initialVariants[0];
      setSelectedColorName(firstVariant?.colorName || (dept === 'KIDS' ? 'Solar Yellow' : 'Obsidian Black'));
      setSelectedColorHex(firstVariant?.colorHex || (dept === 'KIDS' ? '#eab308' : '#111115'));
      setDefaultWeightGrams(Number(firstVariant?.weightGrams) || (dept === 'KIDS' ? 200 : 340));
    } else {
      // New product defaults
      const generatedSku = `TORI-${Date.now().toString().slice(-4)}`;
      setName('');
      setSku(generatedSku);
      setDepartment('MEN');
      setWorld('DARK SHONEN');
      setFranchise('Toriwear Originals');
      setUniverse('ORIGINALS');
      setCategory('Oversized Tees');
      setFit('Oversized');
      setGsm(240);
      setFabric('100% Combed Heavyweight Cotton');
      setDescription('Crafted from premium 240 GSM combed cotton with high-density screen printing.');
      setShortDescription('Heavyweight drop-shoulder oversized streetwear silhouette.');
      setStoryQuote('Wear Your World.');
      setDrop('DROP 002 — SHINOBI');
      setPrice(1199);
      setMrp(1599);
      setCostPrice(420);
      setGstRate(5);
      setLicenseRightsStatus('Owned IP');
      setImageUrls([
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&auto=format&fit=crop&q=80',
      ]);
      setNewImageUrlInput('');
      setPublishingStatus('PUBLISHED');
      setSelectedColorName('Obsidian Black');
      setSelectedColorHex('#111115');
      setDefaultWeightGrams(340);
      setCustomVariantSize('');
      setCustomVariantStock(25);
      setCategoryIds([]);
      setVariants([
        { id: `var-s-${Date.now()}`, sku: `${generatedSku}-S`, size: 'S', colorName: 'Obsidian Black', colorHex: '#111115', price: 1199, stock: 20, reserved: 0, barcode: '8901001', weightGrams: 320 },
        { id: `var-m-${Date.now()}`, sku: `${generatedSku}-M`, size: 'M', colorName: 'Obsidian Black', colorHex: '#111115', price: 1199, stock: 35, reserved: 0, barcode: '8901002', weightGrams: 340 },
        { id: `var-l-${Date.now()}`, sku: `${generatedSku}-L`, size: 'L', colorName: 'Obsidian Black', colorHex: '#111115', price: 1199, stock: 40, reserved: 0, barcode: '8901003', weightGrams: 360 },
        { id: `var-xl-${Date.now()}`, sku: `${generatedSku}-XL`, size: 'XL', colorName: 'Obsidian Black', colorHex: '#111115', price: 1199, stock: 25, reserved: 0, barcode: '8901004', weightGrams: 380 },
      ]);
    }
    setFormError(null);
    setActiveTab('GENERAL');
  }, [product, isOpen]);

  // Adjust defaults when department toggles in Create Mode
  const handleDepartmentChange = (newDept: 'MEN' | 'KIDS') => {
    setDepartment(newDept);
    if (!product) {
      if (newDept === 'KIDS') {
        setWorld('CUTE ADVENTURE');
        setUniverse('KIDS');
        setGsm(180);
        setFit('Comfort Fit');
        setSelectedColorName('Solar Yellow');
        setSelectedColorHex('#eab308');
        setDefaultWeightGrams(200);
        setImageUrls((prev) => {
          const kidsDefault = 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&auto=format&fit=crop&q=80';
          if (prev.length === 0) return [kidsDefault];
          return [kidsDefault, ...prev.slice(1)];
        });
        setVariants([
          { id: `var-45y-${Date.now()}`, sku: `${sku}-4-5Y`, size: '4–5Y' as any, colorName: 'Solar Yellow', colorHex: '#eab308', price, stock: 20, reserved: 0, barcode: '8902001', weightGrams: 180 },
          { id: `var-67y-${Date.now()}`, sku: `${sku}-6-7Y`, size: '6–7Y' as any, colorName: 'Solar Yellow', colorHex: '#eab308', price, stock: 30, reserved: 0, barcode: '8902002', weightGrams: 200 },
          { id: `var-89y-${Date.now()}`, sku: `${sku}-8-9Y`, size: '8–9Y' as any, colorName: 'Solar Yellow', colorHex: '#eab308', price, stock: 25, reserved: 0, barcode: '8902003', weightGrams: 220 },
        ]);
      } else {
        setWorld('DARK SHONEN');
        setUniverse('ORIGINALS');
        setGsm(240);
        setFit('Oversized');
        setSelectedColorName('Obsidian Black');
        setSelectedColorHex('#111115');
        setDefaultWeightGrams(340);
        setImageUrls((prev) => {
          const menDefault = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80';
          if (prev.length === 0) return [menDefault];
          return [menDefault, ...prev.slice(1)];
        });
        setVariants([
          { id: `var-s-${Date.now()}`, sku: `${sku}-S`, size: 'S', colorName: 'Obsidian Black', colorHex: '#111115', price, stock: 20, reserved: 0, barcode: '8901001', weightGrams: 320 },
          { id: `var-m-${Date.now()}`, sku: `${sku}-M`, size: 'M', colorName: 'Obsidian Black', colorHex: '#111115', price, stock: 35, reserved: 0, barcode: '8901002', weightGrams: 340 },
          { id: `var-l-${Date.now()}`, sku: `${sku}-L`, size: 'L', colorName: 'Obsidian Black', colorHex: '#111115', price, stock: 40, reserved: 0, barcode: '8901003', weightGrams: 360 },
          { id: `var-xl-${Date.now()}`, sku: `${sku}-XL`, size: 'XL', colorName: 'Obsidian Black', colorHex: '#111115', price, stock: 25, reserved: 0, barcode: '8901004', weightGrams: 380 },
        ]);
      }
    }
  };

  if (!isOpen) return null;

  const autoDiscount = mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const estimatedProfit = price - costPrice;
  const marginPercent = price > 0 ? Math.round((estimatedProfit / price) * 100) : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation checks
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Product Name / Title is required.');
      setActiveTab('GENERAL');
      return;
    }

    const cleanSku = sku.trim();
    if (!cleanSku) {
      setFormError('Base SKU is required (e.g. TORI-TSHIRT-01).');
      setActiveTab('GENERAL');
      return;
    }

    if (!price || price <= 0) {
      setFormError('Selling price must be greater than ₹0.');
      setActiveTab('PRICING');
      return;
    }

    // Default streetwear fallback image if admin cleared all slots
    const defaultImage = department === 'KIDS'
      ? 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80';

    const rawImages = imageUrls.map((img) => img.trim()).filter(Boolean);
    const validImages = rawImages.filter(isValidProductImageUrl);
    if (rawImages.length > 0 && validImages.length === 0) {
      setFormError('Please provide valid image URLs (http/https, /assets path, or file upload).');
      setActiveTab('MEDIA');
      return;
    }
    const finalImages = validImages.length > 0 ? validImages : [defaultImage];

    // Ensure variants exist and sanitize color/weight/SKU values
    const safeColorName = selectedColorName.trim() || (department === 'KIDS' ? 'Solar Yellow' : 'Obsidian Black');
    const safeColorHex = selectedColorHex || '#111115';
    const safeWeight = Math.max(1, Number(defaultWeightGrams) || (department === 'KIDS' ? 200 : 340));

    const sanitizedVariants = variants.map((v, i) => ({
      ...v,
      size: (String(v.size || 'M').trim() || 'M') as AdminProductVariant['size'],
      sku: (v.sku || `${cleanSku}-${v.size || i + 1}`).trim(),
      colorName: (v.colorName || safeColorName).trim(),
      colorHex: v.colorHex || safeColorHex,
      price: Number(v.price) || Number(price),
      stock: Math.max(0, Number(v.stock) || 0),
      weightGrams: Math.max(1, Number(v.weightGrams) || safeWeight),
    }));

    const finalVariants = sanitizedVariants.length > 0 ? sanitizedVariants : [
      { id: `var-s-${Date.now()}`, sku: `${cleanSku}-S`, size: 'S' as const, colorName: safeColorName, colorHex: safeColorHex, price, stock: 20, reserved: 0, barcode: `890${Date.now().toString().slice(-6)}1`, weightGrams: safeWeight },
      { id: `var-m-${Date.now()}`, sku: `${cleanSku}-M`, size: 'M' as const, colorName: safeColorName, colorHex: safeColorHex, price, stock: 35, reserved: 0, barcode: `890${Date.now().toString().slice(-6)}2`, weightGrams: safeWeight },
      { id: `var-l-${Date.now()}`, sku: `${cleanSku}-L`, size: 'L' as const, colorName: safeColorName, colorHex: safeColorHex, price, stock: 40, reserved: 0, barcode: `890${Date.now().toString().slice(-6)}3`, weightGrams: safeWeight },
      { id: `var-xl-${Date.now()}`, sku: `${cleanSku}-XL`, size: 'XL' as const, colorName: safeColorName, colorHex: safeColorHex, price, stock: 25, reserved: 0, barcode: `890${Date.now().toString().slice(-6)}4`, weightGrams: safeWeight },
    ];

    const derivedColorsMap = new Map<string, string>();
    finalVariants.forEach((v) => {
      if (v.colorName && !derivedColorsMap.has(v.colorName)) {
        derivedColorsMap.set(v.colorName, v.colorHex || '#111115');
      }
    });
    const derivedColors = Array.from(derivedColorsMap.entries()).map(([cName, hex]) => ({ name: cName, hex }));
    const derivedSizes = Array.from(new Set(finalVariants.map((v) => v.size)));

    const productPayload: Partial<AdminProduct> & { colors?: { name: string; hex: string }[]; sizes?: string[] } = {
      name: cleanName,
      sku: cleanSku,
      department,
      world,
      franchise: franchise || (world as any) || 'Toriwear Originals',
      universe,
      category,
      fit,
      gsm,
      fabric,
      description: description.trim() || 'Premium heavyweight streetwear silhouette by TORIWEAR.',
      shortDescription: shortDescription.trim() || `${gsm} GSM combed cotton streetwear fit.`,
      storyQuote: storyQuote.trim() || 'Wear Your World.',
      drop: drop.trim() || 'DROP 002 — SHINOBI',
      price: Number(price),
      mrp: Number(mrp) || Math.round(Number(price) * 1.3),
      costPrice: Number(costPrice) || 450,
      discountPercent: autoDiscount,
      gstRate: Number(gstRate) || 5,
      licenseRightsStatus,
      images: finalImages,
      publishingStatus,
      categoryIds,
      variants: finalVariants,
      colors: derivedColors,
      sizes: derivedSizes,
    };

    setIsSaving(true);
    try {
      if (product) {
        const res = await updateProduct(product.id, productPayload);
        if (!res.success) {
          setFormError(res.message || 'Failed to update product in database.');
          setIsSaving(false);
          return;
        }
        setIsSaving(false);
        onClose();
      } else {
        const res = await addProduct(productPayload);
        if (!res.success) {
          setFormError(res.message || 'Failed to persist product to database.');
          setIsSaving(false);
          return;
        }
        setIsSaving(false);
        onClose();
      }
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred while saving the product to the database.');
      setIsSaving(false);
    }
  };

  const handleUpdateVariantField = <K extends keyof AdminProductVariant>(
    idx: number,
    field: K,
    value: AdminProductVariant[K]
  ) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
  };

  const handleUpdateVariantColor = (idx: number, colorName: string, colorHex?: string) => {
    const matchedPreset = STREETWEAR_COLOR_PRESETS.find(
      (c) => c.name.toLowerCase() === colorName.trim().toLowerCase()
    );
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i !== idx) return v;
        return {
          ...v,
          colorName,
          colorHex: colorHex ?? matchedPreset?.hex ?? v.colorHex,
        };
      })
    );
  };

  const handleApplyColorToAllVariants = () => {
    const cName = selectedColorName.trim() || 'Obsidian Black';
    const cHex = selectedColorHex || '#111115';
    setVariants((prev) => prev.map((v) => ({ ...v, colorName: cName, colorHex: cHex })));
  };

  const handleApplyWeightToAllVariants = () => {
    const w = Math.max(1, Number(defaultWeightGrams) || (department === 'KIDS' ? 200 : 340));
    setVariants((prev) => prev.map((v) => ({ ...v, weightGrams: w })));
  };

  const handleAddSizeVariant = (sizeLabel: string, stockOverride?: number) => {
    const cleanSize = sizeLabel.trim();
    if (!cleanSize) return;
    const activeColor = selectedColorName.trim() || (department === 'KIDS' ? 'Solar Yellow' : 'Obsidian Black');
    const activeHex = selectedColorHex || '#111115';
    const activeWeight = Math.max(1, Number(defaultWeightGrams) || (department === 'KIDS' ? 200 : 340));

    const existing = variants.find(
      (v) =>
        String(v.size).trim().toLowerCase() === cleanSize.toLowerCase() &&
        v.colorName.trim().toLowerCase() === activeColor.toLowerCase()
    );
    if (existing) {
      setFormError(`Size ${cleanSize} in ${activeColor} already exists in variants.`);
      return;
    }
    setFormError(null);

    const colorSlug = activeColor
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 4);
    const sameSizeExists = variants.some(
      (v) => String(v.size).trim().toLowerCase() === cleanSize.toLowerCase()
    );
    const generatedVariantSku = sameSizeExists && colorSlug
      ? `${sku || 'TORI'}-${cleanSize}-${colorSlug}`
      : `${sku || 'TORI'}-${cleanSize}`;

    setVariants((prev) => [
      ...prev,
      {
        id: `var-${cleanSize.toLowerCase().replace(/[^a-z0-9]+/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        sku: generatedVariantSku,
        size: cleanSize as any,
        colorName: activeColor,
        colorHex: activeHex,
        price,
        stock: Math.max(0, stockOverride ?? customVariantStock ?? 25),
        reserved: 0,
        barcode: `890${Date.now().toString().slice(-6)}`,
        weightGrams: activeWeight,
      },
    ]);
  };

  // Unlimited media helpers
  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error(`Failed to read image ${file.name}`));
        }
      };
      reader.onerror = () => reject(new Error(`Failed to read image ${file.name}`));
      reader.readAsDataURL(file);
    });

  const uploadSingleImageFile = async (
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<string> => {
    try {
      return await uploadCmsImageAsset(file, onProgress);
    } catch (err: any) {
      // Only fall back to inline Data URL for small files (<= 4 MB) if offline; large files require server chunk upload
      if (file.size <= 4 * 1024 * 1024) {
        return await readFileAsDataUrl(file);
      }
      throw err;
    }
  };

  const handleUploadMultipleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    e.target.value = '';

    setFormError(null);
    setIsUploadingImages(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        setUploadProgressText(`Uploading ${i + 1}/${files.length} (0%)...`);
        const url = await uploadSingleImageFile(file, (pct) => {
          setUploadProgressText(`Uploading ${i + 1}/${files.length} (${pct}%)...`);
        });
        uploadedUrls.push(url);
      }
      setImageUrls((prev) => {
        const nonEmpty = prev.filter((u) => u.trim().length > 0);
        return [...nonEmpty, ...uploadedUrls];
      });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to upload one or more images.');
    } finally {
      setIsUploadingImages(false);
      setUploadProgressText('');
    }
  };

  const handleReplaceImageAt = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFormError(null);
    setIsUploadingImages(true);
    setUploadProgressText('Uploading 0%...');
    try {
      const url = await uploadSingleImageFile(file, (pct) => {
        setUploadProgressText(`Uploading ${pct}%...`);
      });
      setImageUrls((prev) => prev.map((item, i) => (i === idx ? url : item)));
    } catch (err: any) {
      setFormError(err?.message || 'Failed to upload replacement image.');
    } finally {
      setIsUploadingImages(false);
      setUploadProgressText('');
    }
  };

  const handleAddImageUrl = () => {
    const trimmed = newImageUrlInput.trim();
    if (!trimmed) {
      setImageUrls((prev) => [...prev, '']);
      return;
    }
    if (!isValidProductImageUrl(trimmed)) {
      setFormError('Enter a valid image URL (https://..., http://..., /assets/..., or upload a file).');
      return;
    }
    setFormError(null);
    setImageUrls((prev) => {
      const nonEmpty = prev.filter((u) => u.trim().length > 0);
      return [...nonEmpty, trimmed];
    });
    setNewImageUrlInput('');
  };

  const handleMoveImage = (idx: number, direction: 'UP' | 'DOWN' | 'TOP') => {
    setImageUrls((prev) => {
      const next = [...prev];
      if (direction === 'TOP' && idx > 0) {
        const [picked] = next.splice(idx, 1);
        if (picked !== undefined) next.unshift(picked);
        return next;
      }
      if (direction === 'UP' && idx > 0) {
        const prevItem = next[idx - 1];
        const curItem = next[idx];
        if (prevItem !== undefined && curItem !== undefined) {
          next[idx - 1] = curItem;
          next[idx] = prevItem;
        }
        return next;
      }
      if (direction === 'DOWN' && idx < next.length - 1) {
        const nextItem = next[idx + 1];
        const curItem = next[idx];
        if (nextItem !== undefined && curItem !== undefined) {
          next[idx + 1] = curItem;
          next[idx] = nextItem;
        }
        return next;
      }
      return prev;
    });
  };

  const handleRemoveImage = (idx: number) => {
    setImageUrls((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length > 0 ? next : [''];
    });
  };

  const configuredImageCount = imageUrls.filter((u) => u.trim().length > 0).length;
  const currentWorlds = department === 'KIDS' ? KIDS_WORLDS : MEN_WORLDS;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="w-full max-w-4xl bg-[#14141c] border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#181824]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-600/10 text-red-500 border border-red-500/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {product ? `Edit Product: ${product.name}` : 'Create New Streetwear Product'}
              </h2>
              <p className="text-xs text-neutral-400">
                Configure specs, IP licensing, pricing tiers, and size inventory.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-neutral-800 bg-neutral-900/40 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('GENERAL')}
            className={`py-3 px-4 border-b-2 font-medium flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'GENERAL'
                ? 'border-red-500 text-white font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>1. General Specs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PRICING')}
            className={`py-3 px-4 border-b-2 font-medium flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'PRICING'
                ? 'border-red-500 text-white font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>2. Pricing & IP Rights</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VARIANTS')}
            className={`py-3 px-4 border-b-2 font-medium flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'VARIANTS'
                ? 'border-red-500 text-white font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. Sizes & Inventory ({variants.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MEDIA')}
            className={`py-3 px-4 border-b-2 font-medium flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'MEDIA'
                ? 'border-red-500 text-white font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>4. Media & Publishing ({configuredImageCount})</span>
          </button>
        </div>

        {/* Modal Body & Form */}
        <form noValidate onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* In-Modal Error Banner */}
          {formError && (
            <div className="p-3.5 bg-red-950/70 border border-red-800 rounded-xl text-red-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <div className="flex-1 font-medium">{formError}</div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-red-400 hover:text-white text-xs cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* TAB 1: GENERAL SPECS */}
          <div className={activeTab === 'GENERAL' ? 'space-y-4' : 'hidden'}>
            {/* Department Switcher */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Department Target *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleDepartmentChange('MEN')}
                  className={`p-3 rounded-xl border text-xs text-left cursor-pointer transition-all flex items-center justify-between ${
                    department === 'MEN'
                      ? 'border-red-500 bg-red-600/15 text-white font-bold ring-1 ring-red-500'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm">Men's Streetwear</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">240 GSM Oversized & Drop-Shoulder</div>
                  </div>
                  <span className="text-lg">🔥</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDepartmentChange('KIDS')}
                  className={`p-3 rounded-xl border text-xs text-left cursor-pointer transition-all flex items-center justify-between ${
                    department === 'KIDS'
                      ? 'border-sky-500 bg-sky-600/15 text-white font-bold ring-1 ring-sky-500'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm">Kids' Anime Apparel</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">180 GSM Soft Combed Cotton (4Y–9Y)</div>
                  </div>
                  <span className="text-lg">👶</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Shadow Monarch Oversized Tee"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Base SKU *
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="TORI-TSHIRT-01"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Target World / Fictional Realm *
                </label>
                <select
                  value={world}
                  onChange={(e) => setWorld(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  {currentWorlds.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.subtitle})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Franchise / Saga
                </label>
                <input
                  type="text"
                  value={franchise}
                  onChange={(e) => setFranchise(e.target.value as AnimeFranchise)}
                  placeholder="Solo Leveling, Naruto, etc."
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Drop Series
                </label>
                <input
                  type="text"
                  value={drop}
                  onChange={(e) => setDrop(e.target.value)}
                  placeholder="DROP 002 — SHINOBI"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Fabric GSM Weight
                </label>
                <input
                  type="number"
                  value={gsm}
                  onChange={(e) => setGsm(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Fit Type
                </label>
                <input
                  type="text"
                  value={fit}
                  onChange={(e) => setFit(e.target.value as FitType)}
                  placeholder="Oversized, Relaxed, etc."
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Fabric Composition
                </label>
                <input
                  type="text"
                  value={fabric}
                  onChange={(e) => setFabric(e.target.value)}
                  placeholder="100% Combed Heavyweight Cotton"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Multi-Category Assignment */}
            {availableCategories.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Storefront Categories (Multi-Select)
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                  {availableCategories.map((cat) => {
                    const selected = categoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setCategoryIds((prev) =>
                            prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                          selected
                            ? 'bg-red-600/20 border-red-500 text-white'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-red-400" />}
                        <span>{cat.name}</span>
                        <span className="text-[9px] font-mono text-neutral-500 uppercase">({cat.department})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Product Story Quote (Character Lore)
              </label>
              <input
                type="text"
                value={storyQuote}
                onChange={(e) => setStoryQuote(e.target.value)}
                placeholder="e.g. Arise. Shadows obey only the true monarch."
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Full Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product narrative, fabric feel, printing technique, and styling notes..."
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500 resize-none"
              />
            </div>
          </div>

          {/* TAB 2: PRICING & IP RIGHTS */}
          <div className={activeTab === 'PRICING' ? 'space-y-5' : 'hidden'}>
            {/* Financial calculations preview bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div>
                <div className="text-[10px] uppercase text-neutral-400 font-semibold">Selling Price</div>
                <div className="text-base font-bold text-white font-mono">₹{price}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-neutral-400 font-semibold">Discount vs MRP</div>
                <div className="text-base font-bold text-emerald-400 font-mono">{autoDiscount}% OFF</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-neutral-400 font-semibold">Gross Profit / Unit</div>
                <div className="text-base font-bold text-blue-400 font-mono">₹{estimatedProfit}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-neutral-400 font-semibold">Operating Margin</div>
                <div className="text-base font-bold text-purple-400 font-mono">{marginPercent}%</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Selling Price (₹ INR) *
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  MRP / List Price (₹ INR)
                </label>
                <input
                  type="number"
                  value={mrp}
                  onChange={(e) => setMrp(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Cost Price (COGS in ₹)
                </label>
                <input
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Apparel GST Slab
                </label>
                <select
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value={5}>5% GST (Apparel under ₹1,000 / Standard)</option>
                  <option value={12}>12% GST (Apparel over ₹1,000 / Premium)</option>
                  <option value={0}>0% Tax Exempt</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  IP & Commercial License Rights Status *
                </label>
                <select
                  value={licenseRightsStatus}
                  onChange={(e) => setLicenseRightsStatus(e.target.value as LicenseRightsStatus)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="Owned IP">Owned IP (100% Original Toriwear Artwork)</option>
                  <option value="Licensed">Licensed Commercial Partner</option>
                  <option value="Pending Authorization">Pending Authorization (Legal Review)</option>
                  <option value="Not Authorized">Not Authorized (Blocked from Sale)</option>
                </select>
              </div>
            </div>

            {/* IP Safeguard Banner */}
            {licenseRightsStatus === 'Not Authorized' && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
                <div>
                  <span className="font-bold block text-red-200">Intellectual Property Safeguard Active:</span>
                  Products marked as "Not Authorized" cannot be published or sold on the live storefront to ensure strict copyright and trademark compliance.
                </div>
              </div>
            )}

            {licenseRightsStatus === 'Owned IP' && (
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 text-purple-400" />
                <span>100% Owned Toriwear Intellectual Property. Cleared for worldwide D2C and wholesale.</span>
              </div>
            )}
          </div>

          {/* TAB 3: SIZES & VARIANTS */}
          <div className={activeTab === 'VARIANTS' ? 'space-y-4' : 'hidden'}>
            <datalist id="tori-color-presets">
              {STREETWEAR_COLOR_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name} />
              ))}
            </datalist>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Size Variants, Colors, Weight & On-Hand Inventory
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Total stock: {variants.reduce((a, b) => a + (b.stock || 0), 0)} units across {variants.length} variant{variants.length === 1 ? '' : 's'}
                </p>
              </div>

              {/* Quick Add Size Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-neutral-400 font-mono mr-1">Quick Add ({selectedColorName}):</span>
                {(department === 'KIDS' ? ['3–4Y', '4–5Y', '6–7Y', '8–9Y', '10–11Y'] : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => handleAddSizeVariant(sz)}
                    className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono font-bold cursor-pointer transition border border-neutral-700"
                    title={`Add size ${sz} in ${selectedColorName} (${defaultWeightGrams}g)`}
                  >
                    +{sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Color & Weight Builder Controls */}
            <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* Color Picker + Name */}
                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                    Select / Edit Variant Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedColorHex}
                      onChange={(e) => setSelectedColorHex(e.target.value)}
                      className="w-9 h-8 rounded bg-neutral-950 border border-neutral-700 cursor-pointer p-0.5 shrink-0"
                      title="Pick custom color hex"
                    />
                    <input
                      type="text"
                      list="tori-color-presets"
                      value={selectedColorName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedColorName(val);
                        const preset = STREETWEAR_COLOR_PRESETS.find(
                          (c) => c.name.toLowerCase() === val.trim().toLowerCase()
                        );
                        if (preset) setSelectedColorHex(preset.hex);
                      }}
                      placeholder="Color name (e.g. Crimson Red)"
                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyColorToAllVariants}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[10px] font-mono font-semibold text-neutral-200 whitespace-nowrap cursor-pointer"
                      title="Apply selected color to all rows below"
                    >
                      Apply All
                    </button>
                  </div>
                </div>

                {/* Weight (g) */}
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                    Weight (Grams)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={defaultWeightGrams}
                      onChange={(e) => setDefaultWeightGrams(Math.max(1, Number(e.target.value) || 0))}
                      className="w-20 px-2.5 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyWeightToAllVariants}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[10px] font-mono font-semibold text-neutral-200 whitespace-nowrap cursor-pointer"
                      title="Apply weight to all rows below"
                    >
                      Apply All
                    </button>
                  </div>
                </div>

                {/* Custom Size + Stock Add */}
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                    Add Custom Size + Color Row
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={customVariantSize}
                      onChange={(e) => setCustomVariantSize(e.target.value)}
                      placeholder="Size (e.g. M)"
                      className="w-24 px-2.5 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                    />
                    <input
                      type="number"
                      min={0}
                      value={customVariantStock}
                      onChange={(e) => setCustomVariantStock(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="Qty"
                      className="w-16 px-2 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const sz = customVariantSize.trim();
                        if (!sz) {
                          setFormError('Enter a size label (e.g. M, L, 4-5Y) to add a custom variant.');
                          return;
                        }
                        handleAddSizeVariant(sz, customVariantStock);
                        setCustomVariantSize('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Swatch Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-neutral-800/80">
                <span className="text-[10px] font-mono text-neutral-500 mr-1">Color Presets:</span>
                {STREETWEAR_COLOR_PRESETS.map((preset) => {
                  const isActive = selectedColorName.trim().toLowerCase() === preset.name.toLowerCase();
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setSelectedColorName(preset.name);
                        setSelectedColorHex(preset.hex);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono transition cursor-pointer border ${
                        isActive
                          ? 'bg-neutral-800 text-white border-red-500 ring-1 ring-red-500/40'
                          : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                      }`}
                      title={`Select ${preset.name} (${preset.hex})`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-neutral-600 shrink-0"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span>{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border border-neutral-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-neutral-900 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="p-3">Size</th>
                    <th className="p-3">Variant SKU</th>
                    <th className="p-3">Color (Picker & Name)</th>
                    <th className="p-3">Stock Units</th>
                    <th className="p-3">Weight (g)</th>
                    <th className="p-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {variants.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-neutral-800/30">
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={v.size}
                          onChange={(e) => handleUpdateVariantField(idx, 'size', e.target.value as any)}
                          className="w-16 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white font-bold font-mono text-xs focus:outline-none focus:border-red-500"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={v.sku}
                          onChange={(e) => handleUpdateVariantField(idx, 'sku', e.target.value)}
                          className="w-36 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-neutral-300 font-mono text-xs focus:outline-none focus:border-red-500"
                        />
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={v.colorHex || '#111115'}
                            onChange={(e) => handleUpdateVariantColor(idx, v.colorName, e.target.value)}
                            className="w-7 h-7 rounded bg-neutral-900 border border-neutral-700 cursor-pointer p-0.5 shrink-0"
                            title="Pick swatch hex color"
                          />
                          <input
                            type="text"
                            list="tori-color-presets"
                            value={v.colorName}
                            onChange={(e) => handleUpdateVariantColor(idx, e.target.value)}
                            placeholder="Color name"
                            className="w-36 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-xs focus:outline-none focus:border-red-500"
                          />
                        </div>
                      </td>
                      <td className="p-2.5">
                        <input
                          type="number"
                          min={0}
                          value={v.stock}
                          onChange={(e) => handleUpdateVariantField(idx, 'stock', Math.max(0, Number(e.target.value) || 0))}
                          className="w-20 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white font-mono text-xs focus:outline-none focus:border-red-500"
                        />
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            value={v.weightGrams || 0}
                            onChange={(e) => handleUpdateVariantField(idx, 'weightGrams', Math.max(1, Number(e.target.value) || 0))}
                            className="w-20 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white font-mono text-xs focus:outline-none focus:border-red-500"
                          />
                          <span className="text-[11px] font-mono text-neutral-500">g</span>
                        </div>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setVariants(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 rounded text-neutral-500 hover:text-red-400 cursor-pointer"
                          title="Remove variant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TAB 4: MEDIA & PUBLISHING (UNLIMITED GALLERY IMAGES) */}
          <div className={activeTab === 'MEDIA' ? 'space-y-5' : 'hidden'}>
            <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold">UNLIMITED HD GALLERY · {configuredImageCount} {configuredImageCount === 1 ? 'IMAGE' : 'IMAGES'} ACTIVE</span>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                {configuredImageCount <= 6
                  ? `All ${configuredImageCount} shown in storefront grid`
                  : `6 shown in grid + "More Images" full-screen viewer for all ${configuredImageCount}`}
              </span>
            </div>

            {/* Bulk Multi-File Upload & URL Adder Bar */}
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    Add Unlimited Product Images
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Select multiple photos at once or paste image URLs. Add 4, 6, 10, 20, or more — customers see the exact gallery.
                  </p>
                </div>

                <label
                  className={`px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 whitespace-nowrap shadow-sm ${
                    isUploadingImages ? 'opacity-60 cursor-wait' : 'cursor-pointer'
                  }`}
                >
                  {isUploadingImages ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{isUploadingImages ? (uploadProgressText || 'Uploading HD Images...') : 'Upload Multiple HD Photos'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isUploadingImages}
                    className="hidden"
                    onChange={handleUploadMultipleFiles}
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={newImageUrlInput}
                    onChange={(e) => setNewImageUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddImageUrl();
                      }
                    }}
                    placeholder="Paste image URL (https://...) and click + Add Image"
                    className="w-full pl-8 pr-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 whitespace-nowrap border border-neutral-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Image</span>
                </button>
              </div>
            </div>

            {/* Ordered Gallery Image List */}
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {imageUrls.map((imgUrl, idx) => {
                const trimmedUrl = imgUrl.trim();
                const hasPreview = Boolean(trimmedUrl);
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center gap-3 ${
                      idx === 0
                        ? 'bg-neutral-900 border-red-500/40'
                        : 'bg-neutral-900/70 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    {/* Preview Thumbnail */}
                    <div className="relative w-16 h-20 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-950 shrink-0 flex items-center justify-center">
                      {hasPreview ? (
                        <img
                          src={trimmedUrl}
                          alt={`Product view ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-neutral-600" />
                      )}
                      <span
                        className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                          idx === 0 ? 'bg-red-600 text-white' : 'bg-black/80 text-neutral-200'
                        }`}
                      >
                        {idx === 0 ? '#1 PRIMARY' : `#${idx + 1}`}
                      </span>
                    </div>

                    {/* URL Input & Actions */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={imgUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setImageUrls((prev) => prev.map((u, i) => (i === idx ? val : u)));
                          }}
                          placeholder={`Image #${idx + 1} URL or uploaded file path...`}
                          className="flex-1 min-w-0 px-3 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                        />
                        <label
                          className={`px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-[11px] font-mono font-semibold transition flex items-center gap-1 whitespace-nowrap border border-neutral-700 ${
                            isUploadingImages ? 'opacity-60 cursor-wait' : 'cursor-pointer'
                          }`}
                          title="Upload or replace this image slot"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Upload HD</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingImages}
                            className="hidden"
                            onChange={(e) => handleReplaceImageAt(idx, e)}
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-neutral-500">
                          {idx === 0
                            ? 'Shown as catalog card thumbnail & gallery image #1'
                            : idx < 6
                            ? `Visible directly in PDP 6-image grid (Slot #${idx + 1})`
                            : `Opens in Customer Fullscreen "More Images" Gallery (Photo #${idx + 1})`}
                        </span>

                        <div className="flex items-center gap-1">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, 'TOP')}
                              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] font-mono text-amber-300 border border-neutral-700 flex items-center gap-1 cursor-pointer"
                              title="Make Primary Image"
                            >
                              <Star className="w-3 h-3" />
                              <span>Set Primary</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveImage(idx, 'UP')}
                            className={`p-1 rounded border border-neutral-700 text-neutral-300 ${
                              idx === 0 ? 'opacity-30 cursor-not-allowed' : 'bg-neutral-800 hover:bg-neutral-700 cursor-pointer'
                            }`}
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === imageUrls.length - 1}
                            onClick={() => handleMoveImage(idx, 'DOWN')}
                            className={`p-1 rounded border border-neutral-700 text-neutral-300 ${
                              idx === imageUrls.length - 1
                                ? 'opacity-30 cursor-not-allowed'
                                : 'bg-neutral-800 hover:bg-neutral-700 cursor-pointer'
                            }`}
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1 rounded bg-neutral-800 hover:bg-red-900/60 border border-neutral-700 text-neutral-400 hover:text-red-300 cursor-pointer"
                            title="Remove Image"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Compact Thumbnail Overview Strip */}
            {configuredImageCount > 0 && (
              <div className="pt-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-2">
                  Live Gallery Order ({configuredImageCount} Total)
                </div>
                <div className="flex flex-wrap gap-2">
                  {imageUrls
                    .map((url, originalIdx) => ({ url: url.trim(), originalIdx }))
                    .filter((item) => Boolean(item.url))
                    .map((item, displayIdx) => (
                      <div key={item.originalIdx} className="relative">
                        <img
                          src={item.url}
                          alt={`Gallery preview ${displayIdx + 1}`}
                          className={`w-14 h-16 rounded-lg object-cover border bg-neutral-900 ${
                            displayIdx === 0
                              ? 'border-red-500 ring-1 ring-red-500/40'
                              : displayIdx < 6
                              ? 'border-neutral-700'
                              : 'border-emerald-500/50'
                          }`}
                        />
                        <span className="absolute bottom-1 left-1 bg-black/85 text-[9px] text-white px-1 rounded font-mono">
                          {displayIdx === 0 ? '1·Main' : `#${displayIdx + 1}`}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Publishing Status Control */}
            <div className="pt-4 border-t border-neutral-800">
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Publishing Lifecycle Status *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {(['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as PublishingStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setPublishingStatus(st)}
                    className={`p-3 rounded-xl border text-xs text-left cursor-pointer transition-all ${
                      publishingStatus === st
                        ? 'border-red-500 bg-red-600/10 text-white font-semibold ring-1 ring-red-500'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div className="uppercase tracking-wider font-mono text-[11px] font-bold">{st}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      {st === 'PUBLISHED' ? 'Live on storefront immediately' : st === 'DRAFT' ? 'Internal only' : st === 'SCHEDULED' ? 'Scheduled drop' : st === 'ARCHIVED' ? 'Hidden / Archived' : 'Verification step'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-md shadow-red-600/20 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving to Database...' : product ? 'Save Product Changes' : 'Create & Publish Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

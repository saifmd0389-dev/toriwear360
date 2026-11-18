import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderTree,
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Search,
  Layers,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  PackageCheck,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { StoreCategory } from '../../types';
import { useAdmin } from '../AdminDataContext';

const slugify = (val: string) =>
  val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const CategoryManagementView: React.FC = () => {
  const { products, showToast } = useAdmin();

  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState<'ALL' | 'MEN' | 'KIDS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [department, setDepartment] = useState<'MEN' | 'KIDS' | 'ALL'>('ALL');
  const [parentId, setParentId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [showInNav, setShowInNav] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Bulk Product Assignment Modal
  const [assignCat, setAssignCat] = useState<StoreCategory | null>(null);
  const [assignedProductIds, setAssignedProductIds] = useState<Set<string>>(new Set());
  const [assignSearch, setAssignSearch] = useState('');
  const [assignDept, setAssignDept] = useState<'ALL' | 'MEN' | 'KIDS'>('ALL');
  const [isAssignSaving, setIsAssignSaving] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<StoreCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const notifyCategoriesChanged = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tori_categories_updated'));
    }
  };

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await apiClient.getCategories('ALL', true);
      setCategories([...list].sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setSlugTouched(false);
    setDepartment('ALL');
    setParentId('');
    setDescription('');
    setSeoTitle('');
    setSeoDescription('');
    setShowInNav(true);
    setIsActive(true);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEditModal = (cat: StoreCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setSlugTouched(true);
    setDepartment((cat.department as 'MEN' | 'KIDS' | 'ALL') || 'ALL');
    setParentId(cat.parentId || '');
    setDescription(cat.description || '');
    setSeoTitle(cat.seoTitle || '');
    setSeoDescription(cat.seoDescription || '');
    setShowInNav(cat.showInNav !== false);
    setIsActive(cat.isActive !== false);
    setFormError(null);
    setEditorOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanSlug = slugify(slug || cleanName);
    if (!cleanName) {
      setFormError('Category name is required.');
      return;
    }
    if (!cleanSlug) {
      setFormError('A valid URL slug is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<StoreCategory> = {
        name: cleanName,
        slug: cleanSlug,
        department,
        parentId: parentId || null,
        description: description.trim() || undefined,
        seoTitle: seoTitle.trim() || undefined,
        seoDescription: seoDescription.trim() || undefined,
        showInNav,
        isActive,
        displayOrder: editingCategory ? editingCategory.displayOrder : (categories.length + 1) * 10,
      };

      const res = editingCategory
        ? await apiClient.adminUpdateCategory(editingCategory.id, payload)
        : await apiClient.adminCreateCategory(payload);

      if (!res.success) {
        setFormError(res.error || 'Failed to save category.');
        setIsSaving(false);
        return;
      }

      showToast(editingCategory ? `Category "${cleanName}" updated.` : `Category "${cleanName}" created.`);
      setEditorOpen(false);
      await loadCategories();
      notifyCategoriesChanged();
    } catch (err: any) {
      setFormError(err?.message || 'Error saving category.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (cat: StoreCategory) => {
    const nextActive = !cat.isActive;
    const res = await apiClient.adminUpdateCategory(cat.id, { isActive: nextActive });
    if (res.success) {
      showToast(`"${cat.name}" is now ${nextActive ? 'active' : 'hidden'}.`);
      await loadCategories();
      notifyCategoriesChanged();
    } else {
      showToast(res.error || 'Could not toggle category visibility.');
    }
  };

  const handleMoveOrder = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    const current = categories[index];
    const neighbor = categories[targetIdx];
    const currentOrder = Number.isFinite(Number(current.displayOrder)) ? Number(current.displayOrder) : index + 1;
    const neighborOrder = Number.isFinite(Number(neighbor.displayOrder)) ? Number(neighbor.displayOrder) : targetIdx + 1;
    const nextNeighborOrder = currentOrder === neighborOrder ? neighborOrder + direction : neighborOrder;
    const nextCurrentOrder = currentOrder === neighborOrder ? currentOrder : neighborOrder;

    await Promise.all([
      apiClient.adminUpdateCategory(current.id, { displayOrder: nextCurrentOrder }),
      apiClient.adminUpdateCategory(neighbor.id, { displayOrder: nextNeighborOrder }),
    ]);
    await loadCategories();
    notifyCategoriesChanged();
  };

  const openAssignModal = (cat: StoreCategory) => {
    const initial = new Set<string>();
    for (const p of products) {
      if (Array.isArray(p.categoryIds) && p.categoryIds.includes(cat.id)) {
        initial.add(p.id);
      }
    }
    setAssignedProductIds(initial);
    setAssignSearch('');
    setAssignDept('ALL');
    setAssignCat(cat);
  };

  const handleToggleAssignProduct = (productId: string) => {
    setAssignedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleSaveAssignments = async () => {
    if (!assignCat) return;
    setIsAssignSaving(true);
    try {
      const res = await apiClient.adminAssignCategoryProducts(assignCat.id, Array.from(assignedProductIds));
      if (!res.success) {
        showToast(res.error || 'Failed to assign products.');
        setIsAssignSaving(false);
        return;
      }
      showToast(`Assigned ${assignedProductIds.size} product(s) to "${assignCat.name}".`);
      setAssignCat(null);
      await loadCategories();
      notifyCategoriesChanged();
      window.dispatchEvent(new CustomEvent('tori_admin_products_refresh'));
    } finally {
      setIsAssignSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await apiClient.adminDeleteCategory(deleteTarget.id);
      if (!res.success) {
        showToast(res.error || 'Failed to delete category.');
        setIsDeleting(false);
        return;
      }
      showToast(`Deleted "${deleteTarget.name}". All products remain safe and unlinked.`);
      setDeleteTarget(null);
      await loadCategories();
      notifyCategoriesChanged();
      window.dispatchEvent(new CustomEvent('tori_admin_products_refresh'));
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      if (deptFilter !== 'ALL' && c.department !== deptFilter && c.department !== 'ALL') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [categories, deptFilter, searchQuery]);

  const assignFilteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (assignDept !== 'ALL' && p.department !== assignDept) return false;
      if (assignSearch.trim()) {
        const q = assignSearch.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.sku || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, assignDept, assignSearch]);

  const categoryNameMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-red-600" />
            <span>Dynamic Storefront Categories</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, reorder, configure SEO metadata, and assign products to custom storefront category routes.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-2 shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Category</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-slate-500 font-medium">Total Categories</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{categories.length}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-slate-500 font-medium">Active Live</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
            {categories.filter((c) => c.isActive !== false).length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-slate-500 font-medium">Navigation Pills</div>
          <div className="text-2xl font-bold text-sky-600 mt-1 font-mono">
            {categories.filter((c) => c.isActive !== false && c.showInNav !== false).length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-slate-500 font-medium">Total Products in Vault</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{products.length}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories by name or slug..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {(['ALL', 'MEN', 'KIDS'] as const).map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setDeptFilter(dept)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                deptFilter === dept
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {dept === 'ALL' ? 'All Departments' : dept}
            </button>
          ))}
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
            <span>Loading dynamic categories...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-16 text-center space-y-2 text-xs text-slate-500">
            <Layers className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-semibold text-slate-700">No categories match your filter</div>
            <div>Create a new category to dynamically organize products on the storefront.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-mono">
                <tr>
                  <th className="p-3.5 pl-4">Order</th>
                  <th className="p-3.5">Category &amp; Slug</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Parent</th>
                  <th className="p-3.5">Assigned Products</th>
                  <th className="p-3.5">Visibility</th>
                  <th className="p-3.5 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((cat, idx) => {
                  const realIndex = categories.findIndex((c) => c.id === cat.id);
                  const liveCount =
                    typeof cat.productCount === 'number'
                      ? cat.productCount
                      : products.filter((p) => Array.isArray(p.categoryIds) && p.categoryIds.includes(cat.id)).length;
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 pl-4 font-mono">
                        <div className="flex items-center gap-1">
                          <span className="w-6 text-slate-500 font-bold">#{idx + 1}</span>
                          <button
                            type="button"
                            disabled={realIndex <= 0}
                            onClick={() => handleMoveOrder(realIndex, -1)}
                            title="Move Up"
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 cursor-pointer"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={realIndex >= categories.length - 1}
                            onClick={() => handleMoveOrder(realIndex, 1)}
                            title="Move Down"
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 cursor-pointer"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{cat.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">/category/{cat.slug}</div>
                        {cat.seoTitle && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">SEO: {cat.seoTitle}</div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                            cat.department === 'MEN'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : cat.department === 'KIDS'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {cat.department}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-500">
                        {cat.parentId ? categoryNameMap.get(cat.parentId) || cat.parentId : '—'}
                      </td>

                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => openAssignModal(cat)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition-colors cursor-pointer"
                        >
                          <PackageCheck className="w-3.5 h-3.5 text-red-600" />
                          <span>{liveCount} Products</span>
                        </button>
                      </td>

                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(cat)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                            cat.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {cat.isActive !== false ? (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span>Hidden</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="p-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openAssignModal(cat)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-medium cursor-pointer"
                          >
                            Assign
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(cat)}
                            title="Edit Category"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(cat)}
                            title="Delete Category"
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Category Modal */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditorOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-sm text-slate-900">
                {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create Storefront Category'}
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!slugTouched) setSlug(slugify(e.target.value));
                    }}
                    placeholder="e.g. Heavyweight Hoodies"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">URL Slug *</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugify(e.target.value));
                    }}
                    placeholder="heavyweight-hoodies"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as 'MEN' | 'KIDS' | 'ALL')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-red-500"
                  >
                    <option value="ALL">All Departments</option>
                    <option value="MEN">Men&apos;s Streetwear</option>
                    <option value="KIDS">Kids&apos; Apparel</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Parent Category (Optional)</label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-red-500"
                  >
                    <option value="">None (Top-Level Category)</option>
                    {categories
                      .filter((c) => !editingCategory || c.id !== editingCategory.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.department})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short editorial description shown on /category/:slug page..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Category SEO Metadata
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">SEO Title</label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder="e.g. Anime Oversized Tees & 240 GSM Streetwear | TORI-WEAR"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">SEO Description</label>
                  <textarea
                    rows={2}
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    placeholder="Meta description for Google & social sharing cards..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <span className="font-medium text-slate-800">Active on Storefront</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInNav}
                    onChange={(e) => setShowInNav(e.target.checked)}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <span className="font-medium text-slate-800">Show in Storefront Category Pills</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingCategory ? 'Update Category' : 'Create Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Assign Products Modal */}
      {assignCat && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setAssignCat(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-xs flex flex-col max-h-[85vh]"
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-slate-900">
                  Assign Products to &ldquo;{assignCat.name}&rdquo;
                </div>
                <div className="text-[11px] text-slate-500">
                  {assignedProductIds.size} selected out of {products.length} catalog products
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignCat(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Filter products by title or SKU..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex items-center gap-1">
                {(['ALL', 'MEN', 'KIDS'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAssignDept(d)}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      assignDept === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {assignFilteredProducts.map((p) => {
                const checked = assignedProductIds.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-red-50/70 border-red-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleAssignProduct(p.id)}
                        className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4 shrink-0"
                      />
                      {p.images?.[0] && (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {p.sku} · {p.department || 'MEN'} · ₹{p.price}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignCat(null)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAssignSaving}
                onClick={handleSaveAssignments}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {isAssignSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Assignments ({assignedProductIds.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Unlink-Only Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 space-y-4 text-xs"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Delete Category &ldquo;{deleteTarget.name}&rdquo;?
                </h3>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Deleting this category only removes the category tag and storefront route.{' '}
                  <strong>All assigned products are safely unlinked and never deleted.</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Category</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

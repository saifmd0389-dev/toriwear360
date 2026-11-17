import React, { useState } from 'react';
import { useAdmin } from '../AdminDataContext';
import { AdminProduct } from '../types';
import { ProductEditorModal } from './ProductEditorModal';
import {
  Package,
  Search,
  Plus,
  Edit3,
  Copy,
  Archive,
  Trash2,
  ShieldCheck,
  Percent,
  X,
} from 'lucide-react';

export const ProductsView: React.FC<{ 
  onOpenAddModal?: () => void;
  editingProduct?: AdminProduct | null;
  setEditingProduct?: (p: AdminProduct | null) => void;
}> = ({ onOpenAddModal, editingProduct: propEditingProduct, setEditingProduct: propSetEditingProduct }) => {
  const { 
    products, 
    archiveProduct, 
    deleteProduct, 
    duplicateProduct, 
    bulkUpdateProducts 
  } = useAdmin();

  const [internalEditingProduct, setInternalEditingProduct] = useState<AdminProduct | null>(null);
  const [internalAddModalOpen, setInternalAddModalOpen] = useState(false);

  const editingProduct = propEditingProduct !== undefined ? propEditingProduct : internalEditingProduct;
  const setEditingProduct = propSetEditingProduct || setInternalEditingProduct;
  const handleOpenAddModal = onOpenAddModal || (() => {
    setInternalEditingProduct(null);
    setInternalAddModalOpen(true);
  });
  const isModalOpen = internalAddModalOpen || editingProduct !== null;
  const handleCloseModal = () => {
    setInternalAddModalOpen(false);
    setEditingProduct(null);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedFranchise, setSelectedFranchise] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedLicense, setSelectedLicense] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [productToDelete, setProductToDelete] = useState<AdminProduct | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountPercentInput, setDiscountPercentInput] = useState<number>(15);

  // Filter products
  const filtered = products.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = p.name.toLowerCase().includes(q) || 
                    p.sku.toLowerCase().includes(q) || 
                    p.franchise.toLowerCase().includes(q) ||
                    p.catalogNumber.includes(q);
      if (!match) return false;
    }
    if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
    if (selectedFranchise !== 'ALL' && p.franchise !== selectedFranchise) return false;
    if (selectedStatus !== 'ALL' && p.publishingStatus !== selectedStatus) return false;
    if (selectedLicense !== 'ALL' && p.licenseRightsStatus !== selectedLicense) return false;
    return true;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-red-500" />
            <span>Product Catalog & SKU Management</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage {products.length} heavy apparel items, IP rights licensing, multi-variants & pricing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-md shadow-red-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-[#14141c] p-4 rounded-2xl border border-neutral-800 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by product name, SKU, franchise, or catalog number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Select filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedFranchise}
              onChange={(e) => setSelectedFranchise(e.target.value)}
              className="px-3 py-2 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="ALL">All Universes / Sagas</option>
              <option value="Naruto">Naruto</option>
              <option value="Dragon Ball">Dragon Ball</option>
              <option value="One Piece">One Piece</option>
              <option value="Demon Slayer">Demon Slayer</option>
              <option value="Jujutsu Kaisen">Jujutsu Kaisen</option>
              <option value="Solo Leveling">Solo Leveling</option>
              <option value="Toriwear Originals">Toriwear Originals (Owned IP)</option>
              <option value="Marvel">Marvel Heroverse</option>
              <option value="DC Universe">DC Gotham Noir</option>
            </select>

            <select
              value={selectedLicense}
              onChange={(e) => setSelectedLicense(e.target.value)}
              className="px-3 py-2 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="ALL">All License Rights</option>
              <option value="Owned IP">Owned IP (100% Toriwear)</option>
              <option value="Licensed">Licensed Partner</option>
              <option value="Pending Authorization">Pending Authorization</option>
              <option value="Not Authorized">Not Authorized (Blocked)</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED">Published (Live)</option>
              <option value="DRAFT">Draft</option>
              <option value="REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar if items selected */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-600/10 border border-red-500/30 text-xs text-neutral-200">
            <span className="font-semibold text-white">
              {selectedIds.length} products selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => bulkUpdateProducts(selectedIds, 'PUBLISH')}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] cursor-pointer"
              >
                Publish Live
              </button>
              <button
                onClick={() => bulkUpdateProducts(selectedIds, 'ARCHIVE')}
                className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-[11px] cursor-pointer"
              >
                Archive
              </button>
              <button
                onClick={() => setShowDiscountModal(true)}
                className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-[11px] cursor-pointer flex items-center gap-1"
              >
                <Percent className="w-3 h-3" />
                <span>Apply Discount %</span>
              </button>
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-2.5 py-1 rounded bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium text-[11px] cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Products Data Table */}
      <div className="bg-[#14141c] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#181824] text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800 select-none">
              <tr>
                <th className="p-3.5 pl-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={handleSelectAll}
                    className="rounded bg-neutral-900 border-neutral-700 text-red-600 focus:ring-red-500"
                  />
                </th>
                <th className="p-3.5">Product</th>
                <th className="p-3.5">SKU / Universe</th>
                <th className="p-3.5">Pricing</th>
                <th className="p-3.5">Inventory</th>
                <th className="p-3.5">IP Rights</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Sales</th>
                <th className="p-3.5 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-neutral-500">
                    <Package className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                    <p className="text-sm font-medium">No products matching the selected filters.</p>
                    <button 
                      onClick={() => { 
                        setSearchQuery(''); 
                        setSelectedFranchise('ALL'); 
                        setSelectedStatus('ALL'); 
                        setSelectedCategory('ALL');
                        setSelectedLicense('ALL');
                      }}
                      className="mt-3 text-xs text-red-400 hover:underline cursor-pointer"
                    >
                      Clear all filters
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0);
                  const isLow = totalStock <= 15;
                  const isSelected = selectedIds.includes(p.id);

                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-neutral-800/40 transition-colors ${isSelected ? 'bg-red-500/5' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 pl-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(p.id)}
                          className="rounded bg-neutral-900 border-neutral-700 text-red-600 focus:ring-red-500"
                        />
                      </td>

                      {/* Product Name & Thumbnail */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className="w-11 h-11 rounded-lg object-cover bg-neutral-900 border border-neutral-800 flex-shrink-0"
                          />
                          <div>
                            <div className="font-semibold text-white hover:text-red-400 transition-colors cursor-pointer" onClick={() => setEditingProduct(p)}>
                              {p.name}
                            </div>
                            <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                              <span>{p.gsm} GSM</span>
                              <span>•</span>
                              <span>{p.fit}</span>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-neutral-500">#{p.catalogNumber}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SKU & Universe */}
                      <td className="p-3.5">
                        <div className="font-mono text-neutral-300 font-medium">{p.sku}</div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">{p.franchise}</div>
                      </td>

                      {/* Pricing */}
                      <td className="p-3.5 font-mono">
                        <div className="text-white font-bold">₹{p.price.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-neutral-500 line-through">₹{p.mrp.toLocaleString('en-IN')}</div>
                      </td>

                      {/* Stock */}
                      <td className="p-3.5">
                        <div className={`font-mono font-semibold ${isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {totalStock} units
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          {p.variants.length} sizes (S–XXL)
                        </div>
                      </td>

                      {/* License Rights Status */}
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          p.licenseRightsStatus === 'Owned IP' 
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                            : p.licenseRightsStatus === 'Licensed'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : p.licenseRightsStatus === 'Pending Authorization'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          <ShieldCheck className="w-3 h-3" />
                          <span>{p.licenseRightsStatus}</span>
                        </span>
                      </td>

                      {/* Publishing Status */}
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold ${
                          p.publishingStatus === 'PUBLISHED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : p.publishingStatus === 'APPROVED'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : p.publishingStatus === 'SCHEDULED'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                            : p.publishingStatus === 'REVIEW'
                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                            : p.publishingStatus === 'ARCHIVED'
                            ? 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700/60'
                        }`}>
                          {p.publishingStatus}
                        </span>
                      </td>

                      {/* Sales Count */}
                      <td className="p-3.5 font-mono text-neutral-300">
                        {p.totalSold} sold
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingProduct(p)}
                            title="Edit Product"
                            className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => duplicateProduct(p.id)}
                            title="Duplicate Product"
                            className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => archiveProduct(p.id)}
                            title="Archive"
                            className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductToDelete(p);
                            }}
                            title="Delete"
                            className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="p-3.5 bg-[#181824] border-t border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
          <span>Showing {filtered.length} of {products.length} catalog items</span>
          <span className="font-mono text-[11px]">All items synced with customer storefront database</span>
        </div>
      </div>

      {/* Product Editor Modal */}
      <ProductEditorModal 
        isOpen={isModalOpen} 
        product={editingProduct} 
        onClose={handleCloseModal} 
      />

      {/* Single Product Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setProductToDelete(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-red-500 mb-4">
              <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Product</h3>
                <p className="text-xs text-neutral-400">Permanently delete from catalog</p>
              </div>
            </div>

            <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800 mb-5 flex items-center gap-3">
              {productToDelete.images?.[0] ? (
                <img src={productToDelete.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover bg-neutral-800" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-500">
                  <Package className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{productToDelete.name}</p>
                <p className="text-xs text-neutral-400 font-mono">SKU: {productToDelete.sku} • ₹{productToDelete.price}</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed mb-6">
              Are you sure you want to permanently delete this product? It will be removed from your catalog and will no longer appear on the live storefront.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteProduct(productToDelete.id);
                  setProductToDelete(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-red-600/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowBulkDeleteModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-red-500 mb-4">
              <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Selected Products</h3>
                <p className="text-xs text-neutral-400">{selectedIds.length} items selected</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed mb-6">
              Are you sure you want to permanently delete the <strong className="text-white">{selectedIds.length} selected products</strong> from your catalog? This will remove them immediately from the database and live storefront.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  bulkUpdateProducts(selectedIds, 'DELETE');
                  setSelectedIds([]);
                  setShowBulkDeleteModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-red-600/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete {selectedIds.length} Items</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowDiscountModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-red-500 mb-4">
              <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20">
                <Percent className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Apply Bulk Discount</h3>
                <p className="text-xs text-neutral-400">To {selectedIds.length} selected products</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Discount Percentage (%)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[10, 15, 20, 25, 30, 40, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercentInput(pct)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        discountPercentInput === pct
                          ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={95}
                    value={discountPercentInput}
                    onChange={(e) => setDiscountPercentInput(Math.max(1, Math.min(95, Number(e.target.value) || 0)))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-red-500 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-sm">%</span>
                </div>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed">
                This will recalculate selling prices as MRP × (1 - {discountPercentInput}%) across all {selectedIds.length} selected products.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDiscountModal(false)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  bulkUpdateProducts(selectedIds, 'DISCOUNT', discountPercentInput);
                  setShowDiscountModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-red-600/30"
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Apply {discountPercentInput}% Discount</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

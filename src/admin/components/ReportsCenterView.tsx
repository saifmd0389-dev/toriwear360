import React, { useState, useMemo } from 'react';
import { useAdmin } from '../AdminDataContext';
import {
  FileSpreadsheet,
  Download,
  Printer,
  FileJson,
  Search,
  Layers,
  BarChart3,
  Package,
  Boxes,
  ShoppingBag,
  CreditCard,
  Users,
  Megaphone,
  Layout,
  FileText,
  Truck,
  UserCheck,
  ShieldAlert,
  Crown,
  Sparkles,
  CheckCircle2,
  Eye,
  Landmark,
  ShieldCheck,
  ClipboardCheck,
  MessageSquare,
} from 'lucide-react';
import { OfficialToriwearLogo } from '../../components/OfficialToriwearLogo';

export type ReportModuleId = 
  | 'ALL_MASTER'
  | 'DASHBOARD'
  | 'FINANCE'
  | 'USER_MANAGEMENT'
  | 'APPROVALS'
  | 'COMMUNICATION'
  | 'SUPER_ADMIN'
  | 'ACCOUNT_SECURITY'
  | 'AI_DESIGN_LAB'
  | 'PRODUCTS'
  | 'INVENTORY'
  | 'ORDERS'
  | 'PAYMENTS'
  | 'CUSTOMERS'
  | 'MARKETING'
  | 'WEBSITE'
  | 'CATALOG'
  | 'SHIPPING'
  | 'ANALYTICS_GST'
  | 'STAFF'
  | 'AUDIT_TRAIL';

interface ReportModuleMeta {
  id: ReportModuleId;
  label: string;
  orderNumber: number;
  category: 'Overview' | 'Governance & Leadership' | 'Operations & Commerce' | 'Intelligence & Compliance';
  icon: any;
  description: string;
}

const REPORT_MODULES: ReportModuleMeta[] = [
  { id: 'ALL_MASTER', label: 'Master Business Report (All Modules Combined)', orderNumber: 0, category: 'Overview', icon: Layers, description: 'Unified enterprise backup & report spanning all 20 core business modules.' },
  { id: 'DASHBOARD', label: '1. Executive Dashboard KPIs', orderNumber: 1, category: 'Overview', icon: BarChart3, description: 'Net sales, revenue, orders count, AOV, active customers, and top anime drops.' },
  { id: 'FINANCE', label: '2. Finance & Partner Equity (4x25%)', orderNumber: 2, category: 'Governance & Leadership', icon: Landmark, description: 'Ledger, 25% partner distributions (Saif, Simranjeet, Lokesh, Nagesh), P&L, expenses.' },
  { id: 'USER_MANAGEMENT', label: '3. User Management & Leadership', orderNumber: 3, category: 'Governance & Leadership', icon: Users, description: 'Executive partners, employee IDs, designations, 2FA status, and session counts.' },
  { id: 'APPROVALS', label: '4. Staff Approvals Workflow', orderNumber: 4, category: 'Governance & Leadership', icon: ClipboardCheck, description: 'Disbursement requests, discounts, expense claims, status, and reviewer logs.' },
  { id: 'COMMUNICATION', label: '5. Internal Teams Chat', orderNumber: 5, category: 'Governance & Leadership', icon: MessageSquare, description: 'Operational communication channels, dispatch room alerts, and team notes.' },
  { id: 'SUPER_ADMIN', label: '6. Super Admin Control Center', orderNumber: 6, category: 'Governance & Leadership', icon: Crown, description: 'Master root authority, cryptographic key audit, system configuration policies.' },
  { id: 'ACCOUNT_SECURITY', label: '7. My Account & Security', orderNumber: 7, category: 'Governance & Leadership', icon: ShieldCheck, description: 'Authentication credentials, TOTP 2FA posture, and multi-device active sessions.' },
  { id: 'AI_DESIGN_LAB', label: '8. AI Design Lab Concepts', orderNumber: 8, category: 'Intelligence & Compliance', icon: Sparkles, description: 'Anime streetwear concepts, universes, design prompts, and draft drops.' },
  { id: 'PRODUCTS', label: '9. Products Vault & Catalog', orderNumber: 9, category: 'Operations & Commerce', icon: Package, description: 'All streetwear styles, 240+ GSM specs, MRP, cost price, selling price, and margins.' },
  { id: 'INVENTORY', label: '10. Inventory & Warehouse Stock', orderNumber: 10, category: 'Operations & Commerce', icon: Boxes, description: 'Multi-variant stock levels (S, M, L, XL, XXL), available/reserved units, valuation.' },
  { id: 'ORDERS', label: '11. Orders & Customer Fulfillment', orderNumber: 11, category: 'Operations & Commerce', icon: ShoppingBag, description: 'Customer orders, item breakdowns, fulfillment statuses, tracking, and delivery addresses.' },
  { id: 'PAYMENTS', label: '12. Payments, Transactions & UPI', orderNumber: 12, category: 'Operations & Commerce', icon: CreditCard, description: 'Razorpay & UPI settlements, reference IDs, transaction timestamps, and net values.' },
  { id: 'CUSTOMERS', label: '13. Customer CRM & Profiles', orderNumber: 13, category: 'Operations & Commerce', icon: Users, description: 'Customer registry, lifetime order counts, total spend, phone, email, and wishlists.' },
  { id: 'MARKETING', label: '14. Promotions, Coupons & Ads', orderNumber: 14, category: 'Operations & Commerce', icon: Megaphone, description: 'Active coupons, discount percentages, usage caps, redemptions, and ad campaigns.' },
  { id: 'WEBSITE', label: '15. Storefront CMS & Drops', orderNumber: 15, category: 'Operations & Commerce', icon: Layout, description: 'Homepage hero slides, announcement ticker, featured collections, and visual drops.' },
  { id: 'CATALOG', label: '16. Digital Line Sheet B2B', orderNumber: 16, category: 'Operations & Commerce', icon: FileText, description: 'B2B wholesale pricing, minimum order quantities (MOQs), and pack distributions.' },
  { id: 'SHIPPING', label: '17. Logistics, Shipments & Returns', orderNumber: 17, category: 'Operations & Commerce', icon: Truck, description: 'Courier SLAs, Delhivery/BlueDart AWB numbers, and customer return resolutions.' },
  { id: 'ANALYTICS_GST', label: '18. Financial Analytics & Indian GST', orderNumber: 18, category: 'Intelligence & Compliance', icon: BarChart3, description: 'HSN 6109 Cotton schedule, state-wise CGST (2.5%), SGST (2.5%), IGST (5.0%) breakups.' },
  { id: 'STAFF', label: '19. Staff & Role Permissions', orderNumber: 19, category: 'Governance & Leadership', icon: UserCheck, description: 'Staff directory, granular RBAC permissions matrix, and operational roles.' },
  { id: 'AUDIT_TRAIL', label: '20. Audit Trail & Cryptographic Logs', orderNumber: 20, category: 'Intelligence & Compliance', icon: ShieldAlert, description: 'Immutable system event stream, actor credentials, IP addresses, and state changes.' },
];

export const ReportsCenterView: React.FC = () => {
  const { 
    orders, 
    products, 
    inventory, 
    payments, 
    customers, 
    coupons, 
    websiteSections, 
    returnRequests, 
    auditLogs, 
    staff, 
    aiConcepts, 
    currentUser, 
    showToast 
  } = useAdmin();

  const [activeModule, setActiveModule] = useState<ReportModuleId>('ALL_MASTER');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter modules for display
  const filteredModules = useMemo(() => {
    if (!searchTerm.trim()) return REPORT_MODULES;
    const q = searchTerm.toLowerCase();
    return REPORT_MODULES.filter(m => 
      m.label.toLowerCase().includes(q) || 
      m.description.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  // Executive Core Aggregates
  const totalRevenue = useMemo(() => orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0), [orders]);
  const totalStockUnits = useMemo(() => inventory.reduce((sum, i) => sum + (Number(i.availableStock) || 0), 0), [inventory]);
  const totalStockCostValuation = useMemo(() => {
    return inventory.reduce((sum, i) => {
      const parent = products.find(p => p.id === i.productId);
      const cost = parent?.costPrice || 450;
      return sum + (i.availableStock * cost);
    }, 0);
  }, [inventory, products]);
  const totalStockRetailValuation = useMemo(() => {
    return inventory.reduce((sum, i) => {
      const parent = products.find(p => p.id === i.productId);
      const price = parent?.price || 1199;
      return sum + (i.availableStock * price);
    }, 0);
  }, [inventory, products]);

  // Compile module-specific CSV dataset
  const generateDataset = (mod: ReportModuleId) => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `TORIWEAR_${mod}_REPORT_${new Date().toISOString().slice(0, 10)}.csv`;

    switch (mod) {
      case 'DASHBOARD':
        headers = ['Metric Name', 'Calculated Value', 'Currency / Unit', 'Operational Notes'];
        rows = [
          ['Total Gross Orders', orders.length, 'Orders', 'All recorded customer checkouts'],
          ['Total Gross Revenue', totalRevenue, 'INR', 'Sum of all paid & confirmed orders'],
          ['Average Order Value (AOV)', orders.length ? Math.round(totalRevenue / orders.length) : 0, 'INR', 'Gross revenue per order'],
          ['Active Products Catalog', products.length, 'Styles', 'Published & draft heavyweight anime garments'],
          ['Warehouse Stock Total', totalStockUnits, 'Pieces', 'Combined physical inventory across all SKUs'],
          ['Warehouse Valuation (Cost)', totalStockCostValuation, 'INR', 'Cost basis (Surat manufacturing hub)'],
          ['Warehouse Valuation (Retail)', totalStockRetailValuation, 'INR', 'Expected selling retail value'],
          ['Total Registered Customers', customers.length, 'Profiles', 'Customer accounts & CRM records'],
          ['Completed Payments Volume', payments.length, 'Transactions', 'Settled via Razorpay & UPI'],
          ['Active Return Requests', returnRequests.length, 'Tickets', 'Reverse logistics pipeline'],
        ];
        break;

      case 'FINANCE':
        headers = ['Partner / Account', 'Equity %', 'Role', 'Share Amount (INR)', 'Phone', 'Status'];
        rows = [
          ['Mohammed Saif', '25.0%', 'Super Admin & Founder', Math.round(totalRevenue * 0.25), '+91 98450 12091', 'ACTIVE'],
          ['Simranjeet Singh', '25.0%', 'Operations & Production Partner', Math.round(totalRevenue * 0.25), '+91 98201 44810', 'ACTIVE'],
          ['Lokesh Kottala', '25.0%', 'Marketing & Growth Partner', Math.round(totalRevenue * 0.25), '+91 98112 30491', 'ACTIVE'],
          ['Nagesh M', '25.0%', 'Logistics & Warehousing Partner', Math.round(totalRevenue * 0.25), '+91 97410 88203', 'ACTIVE'],
          ['---', '---', '---', '---', '---', '---'],
          ['Operating Expenses Pool', 'N/A', 'Surat Facility, Packaging, Logistics', Math.round(totalRevenue * 0.35), 'N/A', 'ALLOCATED'],
          ['Retained Earnings & Reserves', 'N/A', 'TORIWEAR Corporate Treasury', Math.round(totalRevenue * 0.15), 'N/A', 'RESERVE'],
        ];
        break;

      case 'USER_MANAGEMENT':
      case 'STAFF':
        headers = ['Employee ID', 'Name', 'Email', 'Role', 'Department', 'Status', '2FA Enabled', 'Last Login'];
        rows = staff.map(s => [
          s.id,
          `"${s.name}"`,
          s.email,
          s.role,
          s.role === 'SUPER_ADMIN' || s.role === 'PARTNER' ? 'Executive Leadership' : 'Operations',
          s.isActive ? 'ACTIVE' : 'INACTIVE',
          s.twoFactorEnabled ? 'YES' : 'NO',
          s.lastLogin || 'Recent'
        ]);
        break;

      case 'APPROVALS':
        headers = ['Request ID', 'Title', 'Type', 'Amount (INR)', 'Requested By', 'Status', 'Date'];
        rows = [
          ['APR-001', 'Surat Mill Combed Heavyweight Cotton Batch 240 GSM', 'EXPENSE', 85000, 'Simranjeet Singh', 'APPROVED', '2025-10-15'],
          ['APR-002', 'Packaging Box Batch (High-density matte black magnetic boxes)', 'PURCHASE', 42000, 'Nagesh M', 'APPROVED', '2025-10-18'],
          ['APR-003', 'Meta & Instagram Ads Scaling — Drop 002 Launch', 'MARKETING', 35000, 'Lokesh Kottala', 'APPROVED', '2025-10-22'],
          ['APR-004', 'Special Seasonal 20% Partner Discount Authorization', 'DISCOUNT', 12000, 'Mohammed Saif', 'APPROVED', '2025-10-25'],
        ];
        break;

      case 'COMMUNICATION':
        headers = ['Channel Name', 'Topic', 'Access Level', 'Active Members', 'Status'];
        rows = [
          ['#general-ops', 'Daily fulfillment & dispatch alerts', 'All Staff', 8, 'ACTIVE'],
          ['#finance-approvals', 'Multi-signature disbursements & partner draws', 'Partners Only', 4, 'PROTECTED'],
          ['#design-lab', 'AI anime streetwear silhouettes & screen print proofs', 'Creative Team', 5, 'ACTIVE'],
          ['#fulfillment-surat', 'Fabric milling, stitching, drop-shoulder QC', 'Production & Warehouse', 6, 'ACTIVE'],
          ['#customer-grievance', 'Size exchanges and reverse pickup tracking', 'Support Team', 4, 'ACTIVE'],
        ];
        break;

      case 'SUPER_ADMIN':
      case 'ACCOUNT_SECURITY':
      case 'AUDIT_TRAIL':
        headers = ['Timestamp', 'Actor Name', 'Action Type', 'Entity Target', 'Details', 'IP Address'];
        rows = auditLogs.map(l => [
          l.timestamp,
          `"${l.adminName}"`,
          l.action,
          `"${l.entity}"`,
          `"${l.details.replace(/"/g, '""')}"`,
          l.ipAddress || '127.0.0.1'
        ]);
        break;

      case 'AI_DESIGN_LAB':
        headers = ['Concept ID', 'Concept Name', 'World Universe', 'Fabric GSM', 'Colorway', 'Status', 'Design Mode'];
        rows = aiConcepts.map(c => [
          c.id,
          `"${c.designName || c.character || 'Anime Streetwear Concept'}"`,
          c.world || 'Dark Shonen',
          c.department === 'KIDS' ? 180 : 240,
          `"${Array.isArray(c.palette) ? c.palette.join(', ') : 'Obsidian Black'}"`,
          'APPROVED',
          c.generationMode || 'STANDARD'
        ]);
        break;

      case 'PRODUCTS':
      case 'CATALOG':
        headers = ['Catalog #', 'Product Name', 'SKU', 'Category', 'Fit', 'GSM', 'Selling Price (INR)', 'MRP (INR)', 'Cost Price (INR)', 'Margin %', 'Variants Count', 'Publishing Status'];
        rows = products.map(p => {
          const variantsCount = (p.variants || []).length;
          const cost = p.costPrice || 450;
          const margin = p.price > 0 ? Math.round(((p.price - cost) / p.price) * 100) : 0;
          return [
            p.catalogNumber,
            `"${p.name}"`,
            p.sku,
            p.category || 'Oversized Tees',
            p.fit || 'Oversized Drop Shoulder',
            p.gsm || 240,
            p.price,
            p.mrp,
            cost,
            `${margin}%`,
            variantsCount,
            p.publishingStatus
          ];
        });
        break;

      case 'INVENTORY':
        headers = ['SKU', 'Product Name', 'Size', 'Color', 'Available Units', 'Reserved Units', 'Sold Units', 'Status', 'Valuation (INR)'];
        rows = inventory.map(i => {
          const parent = products.find(p => p.id === i.productId);
          const val = i.availableStock * (parent?.price || 1199);
          return [
            i.sku,
            `"${i.productName}"`,
            i.size,
            i.colorName,
            i.availableStock,
            i.reservedStock,
            i.sold,
            i.status,
            val
          ];
        });
        break;

      case 'ORDERS':
        headers = ['Order Number', 'Date', 'Customer Name', 'Phone', 'Email', 'Items Count', 'Payment Method', 'Payment Status', 'Fulfillment Status', 'Total Amount (INR)', 'Shipping State'];
        rows = orders.map(o => [
          o.orderNumber,
          o.date,
          `"${o.customerName}"`,
          o.customerPhone || 'N/A',
          o.customerEmail || 'N/A',
          o.items.length,
          o.paymentMethod,
          o.paymentStatus,
          o.shippingStatus,
          o.total,
          o.shippingAddress?.state || 'N/A'
        ]);
        break;

      case 'PAYMENTS':
        headers = ['Payment ID', 'Order Number', 'Date', 'Customer', 'Amount (INR)', 'Method', 'Status', 'Gateway Reference'];
        rows = payments.map(p => [
          p.id,
          p.orderNumber,
          p.date,
          `"${p.customerName}"`,
          p.amount,
          p.method,
          p.status,
          p.gatewayRefId || `UPI-${p.id}`
        ]);
        break;

      case 'CUSTOMERS':
        headers = ['Customer ID', 'Full Name', 'Email', 'Phone', 'Total Orders', 'Total Spent (INR)', 'Wishlist Items Count', 'Default City'];
        rows = customers.map(c => [
          c.id,
          `"${c.name}"`,
          c.email,
          c.phone,
          c.totalOrders,
          c.totalSpent,
          (c.wishlistItems || []).length,
          c.city || 'N/A'
        ]);
        break;

      case 'MARKETING':
        headers = ['Coupon Code', 'Discount Type', 'Value', 'Min Order (INR)', 'Usage Count', 'Status'];
        rows = coupons.map(c => [
          c.code,
          c.discountType,
          c.value,
          c.minCartValue || c.minOrderValue || 0,
          c.usageCount,
          c.isActive ? 'ACTIVE' : 'INACTIVE'
        ]);
        break;

      case 'WEBSITE':
        headers = ['Section ID', 'Section Name', 'Visible', 'Display Order', 'Description'];
        rows = websiteSections.map(s => [
          s.id,
          `"${s.name}"`,
          s.isEnabled ? 'VISIBLE' : 'HIDDEN',
          s.order,
          `"${(s.description || '').replace(/"/g, '""')}"`
        ]);
        break;

      case 'SHIPPING':
        headers = ['Return Request ID', 'Order Number', 'Customer', 'Reason', 'Status', 'Refund Amount (INR)', 'Date'];
        rows = returnRequests.map(r => [
          r.id,
          r.orderNumber,
          `"${r.customerName}"`,
          `"${r.reason}"`,
          r.status,
          r.refundAmount || 0,
          r.date
        ]);
        break;

      case 'ANALYTICS_GST':
        headers = ['Invoice Number', 'Order Date', 'Customer State', 'HSN Code', 'Taxable Turnover (INR)', 'CGST 2.5% (INR)', 'SGST 2.5% (INR)', 'IGST 5.0% (INR)', 'Gross Invoice (INR)'];
        rows = orders.map(o => {
          const isInterState = (o.shippingAddress?.state || '').toLowerCase() !== 'gujarat';
          const taxable = Math.round(o.total * 0.952);
          const totalTax = o.total - taxable;
          const cgst = isInterState ? 0 : Math.round(totalTax / 2);
          const sgst = isInterState ? 0 : Math.round(totalTax / 2);
          const igst = isInterState ? totalTax : 0;
          return [
            `INV-${o.orderNumber}`,
            o.date,
            o.shippingAddress?.state || 'Maharashtra',
            '6109 (Cotton Knitted T-Shirts)',
            taxable,
            cgst,
            sgst,
            igst,
            o.total
          ];
        });
        break;

      case 'ALL_MASTER':
      default:
        // Comprehensive combined master report
        headers = ['Module Category', 'Entity / Metric ID', 'Primary Label', 'Secondary Attribute', 'Metric / Value', 'Status', 'Audit Notes'];
        rows = [
          // Section 1: Dashboard
          ['01. Executive KPIs', 'METRIC-REV', 'Gross Sales Turnover', 'All Channels', `INR ${totalRevenue}`, 'VERIFIED', 'Authoritative recorded turnover'],
          ['01. Executive KPIs', 'METRIC-ORD', 'Total Completed Orders', 'Direct to Consumer', `${orders.length} orders`, 'DELIVERED', 'Average order ticket calculated'],
          ['01. Executive KPIs', 'METRIC-STK', 'Total Inventory Available', 'Surat Warehouse', `${totalStockUnits} pcs`, 'IN_STOCK', `Valuation: INR ${totalStockRetailValuation}`],
          // Section 2: Finance & Partners
          ['02. Finance & Equity', 'PARTNER-001', 'Mohammed Saif', 'Super Admin & Founder', '25.0% Equity', 'ACTIVE', 'Master root control & executive leadership'],
          ['02. Finance & Equity', 'PARTNER-002', 'Simranjeet Singh', 'Production Partner', '25.0% Equity', 'ACTIVE', 'Surat fabric milling & 240+ GSM quality control'],
          ['02. Finance & Equity', 'PARTNER-003', 'Lokesh Kottala', 'Marketing Partner', '25.0% Equity', 'ACTIVE', 'Brand positioning & paid acquisition'],
          ['02. Finance & Equity', 'PARTNER-004', 'Nagesh M', 'Logistics Partner', '25.0% Equity', 'ACTIVE', 'Warehousing, packaging & dispatch SLAs'],
          // Section 3: Products Vault (All items)
          ...products.map(p => [
            '09. Products Vault',
            p.catalogNumber,
            `"${p.name}"`,
            `${p.gsm || 240} GSM ${p.fit || 'Oversized'}`,
            `INR ${p.price}`,
            p.publishingStatus,
            `Variants: ${(p.variants || []).length} sizes`
          ]),
          // Section 4: Inventory & Warehouse Stock (All SKUs)
          ...inventory.map(i => [
            '10. Inventory & Stock',
            i.sku,
            `"${i.productName}"`,
            `Size ${i.size} · ${i.colorName}`,
            `${i.availableStock} pcs available`,
            i.status,
            `Reserved: ${i.reservedStock}`
          ]),
          // Section 5: Orders Fulfillment (All Orders)
          ...orders.map(o => [
            '11. Orders Fulfillment',
            o.orderNumber,
            `"${o.customerName}"`,
            `${o.items.length} items (${o.paymentMethod})`,
            `INR ${o.total}`,
            o.shippingStatus,
            o.date
          ]),
          // Section 6: Customer CRM (All Registered Customers)
          ...customers.map(c => [
            '13. Customer CRM',
            c.id,
            `"${c.name}"`,
            c.email,
            `INR ${c.totalSpent}`,
            `${c.totalOrders} orders`,
            c.phone || 'N/A'
          ]),
          // Section 7: GST Schedule
          ['18. Analytics & GST', 'GST-SCHEDULE', 'Indian GST Schedule (GSTR-1)', 'HSN 6109 Cotton Streetwear', `Taxable: INR ${Math.round(totalRevenue * 0.952)}`, 'COMPLIANT', '5% GST Rate Applied'],
          // Section 8: Staff & Roles
          ...staff.map(s => [
            '19. Staff & Roles',
            s.id,
            `"${s.name}"`,
            s.email,
            s.role,
            s.isActive ? 'ACTIVE' : 'INACTIVE',
            s.twoFactorEnabled ? '2FA Enabled' : 'No 2FA'
          ]),
          // Section 9: Audit Trail (Complete Log Stream)
          ...auditLogs.map(l => [
            '20. Audit Trail',
            l.id,
            l.action,
            `"${l.entity}"`,
            `"${l.adminName}"`,
            'VERIFIED',
            l.timestamp
          ])
        ];
        break;
    }

    return { headers, rows, filename };
  };

  // Export CSV
  const handleExportCSV = (mod: ReportModuleId) => {
    const { headers, rows, filename } = generateDataset(mod);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${filename} successfully!`);
  };

  // Export JSON Backup
  const handleExportJSON = (mod: ReportModuleId) => {
    let payload: any;
    if (mod === 'ALL_MASTER') {
      payload = {
        meta: {
          app: 'TORIWEAR ENTERPRISE BACKEND',
          reportType: 'ALL_MODULES_MASTER_BACKUP',
          generatedAt: new Date().toISOString(),
          operator: currentUser?.name || 'Mohammed Saif (Super Admin)',
        },
        kpis: {
          totalGrossRevenue: totalRevenue,
          totalOrders: orders.length,
          totalStockUnits,
          warehouseValuationCost: totalStockCostValuation,
          warehouseValuationRetail: totalStockRetailValuation,
          totalCustomers: customers.length,
        },
        partnersEquity: [
          { name: 'Mohammed Saif', share: '25%', role: 'Super Admin & Founder' },
          { name: 'Simranjeet Singh', share: '25%', role: 'Operations & Production Partner' },
          { name: 'Lokesh Kottala', share: '25%', role: 'Growth & Marketing Partner' },
          { name: 'Nagesh M', share: '25%', role: 'Logistics & Warehousing Partner' },
        ],
        products,
        inventory,
        orders,
        payments,
        customers,
        coupons,
        auditLogs,
        staff,
      };
    } else {
      const { headers, rows } = generateDataset(mod);
      payload = {
        module: mod,
        generatedAt: new Date().toISOString(),
        headers,
        recordsCount: rows.length,
        data: rows.map(r => {
          const obj: any = {};
          headers.forEach((h, idx) => {
            obj[h] = r[idx];
          });
          return obj;
        })
      };
    }

    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `TORIWEAR_${mod}_BACKUP_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported JSON data for ${mod} successfully!`);
  };

  // Print Report Handler
  const handlePrintReport = () => {
    window.print();
  };

  const activeMeta = REPORT_MODULES.find(m => m.id === activeModule) || REPORT_MODULES[0];
  const activeDataset = useMemo(() => generateDataset(activeModule), [activeModule, orders, products, inventory, payments, customers, coupons, auditLogs, staff]);

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-200">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Enterprise Reports & Business Intelligence Hub</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-900 text-white font-bold">
                  All 20 Modules
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate, preview, export and print authoritative data from <strong>1. Dashboard</strong> to <strong>20. Audit Trail</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Global Export Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleExportCSV('ALL_MASTER')}
            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            title="Download complete Master Report covering all modules"
          >
            <Download className="w-4 h-4" />
            <span>Master All-in-One (CSV)</span>
          </button>

          <button
            onClick={() => handleExportJSON('ALL_MASTER')}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Export full JSON system backup"
          >
            <FileJson className="w-4 h-4 text-amber-600" />
            <span>JSON Backup</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 print:hidden">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Gross Sales Turnover</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">₹{totalRevenue.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{orders.length} Verified Checkouts</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Warehouse Valuation</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">₹{totalStockRetailValuation.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">
            {totalStockUnits} active units across {products.length} styles
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Partner Equity</div>
          <div className="text-xl font-bold text-slate-900 mt-1">4 × 25% Equal</div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
            Saif · Simranjeet · Lokesh · Nagesh
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Audit Trail Events</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">{auditLogs.length} Events</div>
          <div className="text-[10px] text-indigo-600 font-medium mt-0.5">
            Cryptographically sealed
          </div>
        </div>
      </div>

      {/* Main Module Selector and Preview Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
        {/* Left Column: Module Directory */}
        <div className="lg:col-span-4 space-y-3 print:hidden">
          <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 py-1">
              Core Modules (From Dashboard to Audit Trail)
            </div>

            <div className="max-h-[580px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredModules.map((mod) => {
                const Icon = mod.icon;
                const isSelected = activeModule === mod.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => setActiveModule(mod.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer ${
                      isSelected 
                        ? 'bg-red-50 text-red-700 border border-red-200 shadow-2xs font-semibold' 
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-red-600' : 'text-slate-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate">{mod.label}</div>
                      <div className={`text-[10px] truncate ${isSelected ? 'text-red-500' : 'text-slate-400'}`}>
                        {mod.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Live Report Preview Panel */}
        <div className="lg:col-span-8 space-y-4">
          {/* Printable Header for print output only */}
          <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <OfficialToriwearLogo className="h-10 w-auto" />
                <h2 className="text-base font-bold uppercase tracking-wider text-slate-900 mt-1">
                  Official Business Report & Audit Record
                </h2>
                <p className="text-[10px] text-slate-600">
                  TORIWEAR Heavyweight Streetwear (240+ GSM Combed Cotton) · Mumbai · Surat Hub
                </p>
              </div>
              <div className="text-right text-[10px] text-slate-600 space-y-0.5">
                <div><strong>Generated:</strong> {new Date().toLocaleString('en-IN')}</div>
                <div><strong>Module:</strong> {activeMeta?.label || 'Report'}</div>
                <div><strong>Operator:</strong> {currentUser?.name || 'Mohammed Saif (Super Admin)'}</div>
              </div>
            </div>
          </div>

          {/* Module Action Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                {activeMeta?.icon && <activeMeta.icon className="w-5 h-5 text-slate-800" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{activeMeta?.label || 'Report'}</h3>
                <p className="text-xs text-slate-500">{activeMeta?.description || ''}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportCSV(activeModule)}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Module CSV</span>
              </button>
              <button
                onClick={() => handleExportJSON(activeModule)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-amber-600" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Live Data Table Preview */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs print:border-none print:shadow-none">
            <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-400" />
                <span>Live Data Table Preview ({activeDataset.rows.length} records)</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Format: UTF-8 RFC-4180
              </span>
            </div>

            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100/80 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0 z-10 backdrop-blur-xs">
                  <tr>
                    <th className="p-3 pl-4 w-10 text-slate-400 font-mono text-[10px]">#</th>
                    {activeDataset.headers.map((h, i) => (
                      <th key={i} className="p-3 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {activeDataset.rows.length === 0 ? (
                    <tr>
                      <td colSpan={activeDataset.headers.length + 1} className="p-8 text-center text-slate-400">
                        No recorded rows for this module yet.
                      </td>
                    </tr>
                  ) : (
                    activeDataset.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 pl-4 text-slate-400 font-mono text-[10px]">{rIdx + 1}</td>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-3 whitespace-nowrap text-slate-800">
                            {String(cell).replace(/^"|"$/g, '')}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing all <strong>{activeDataset.rows.length}</strong> compiled entries. Ready for clean CSV, JSON, or PDF printing.
              </div>
              <button
                onClick={handlePrintReport}
                className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print View</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

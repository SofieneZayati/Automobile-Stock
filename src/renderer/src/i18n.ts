export type Language = 'fr' | 'en' | 'ar'

const copy = {
  fr: {
    dashboard: 'Tableau de bord',
    stock: 'Pièces & stock',
    invoices: 'Factures',
    clients: 'Clients',
    suppliers: 'Fournisseurs',
    settings: 'Paramètres',
    search: 'Rechercher une pièce, référence ou OEM…',
    newInvoice: 'Nouvelle facture',
    addPart: 'Ajouter une pièce',
    stockEntry: 'Entrée de stock',
    overview: "Vue d'ensemble",
    lowStock: 'Stock faible',
    recentInvoices: 'Factures récentes',
    allParts: 'Toutes les pièces',
    parts: 'pièces',
    inStock: 'En stock',
    invoiceDraft: 'Brouillon de facture',
    customer: 'Client',
    walkIn: 'Client comptoir',
    designation: 'Désignation',
    ref: 'Référence',
    qty: 'Qté',
    unitPrice: 'Prix unitaire',
    total: 'Total',
    subtotal: 'Sous-total HT',
    vat: 'TVA',
    totalTtc: 'Total TTC',
    saveDraft: 'Enregistrer',
    print: 'Aperçu / Imprimer',
    finalize: 'Valider la facture'
  },
  en: {
    dashboard: 'Dashboard',
    stock: 'Parts & stock',
    invoices: 'Invoices',
    clients: 'Customers',
    suppliers: 'Suppliers',
    settings: 'Settings',
    search: 'Search part, reference or OEM…',
    newInvoice: 'New invoice',
    addPart: 'Add part',
    stockEntry: 'Stock entry',
    overview: 'Overview',
    lowStock: 'Low stock',
    recentInvoices: 'Recent invoices',
    allParts: 'All parts',
    parts: 'parts',
    inStock: 'In stock',
    invoiceDraft: 'Invoice draft',
    customer: 'Customer',
    walkIn: 'Walk-in customer',
    designation: 'Description',
    ref: 'Reference',
    qty: 'Qty',
    unitPrice: 'Unit price',
    total: 'Total',
    subtotal: 'Subtotal',
    vat: 'VAT',
    totalTtc: 'Grand total',
    saveDraft: 'Save draft',
    print: 'Preview / Print',
    finalize: 'Finalize invoice'
  },
  ar: {
    dashboard: 'لوحة التحكم',
    stock: 'القطع والمخزون',
    invoices: 'الفواتير',
    clients: 'الحرفاء',
    suppliers: 'المزودون',
    settings: 'الإعدادات',
    search: 'ابحث عن قطعة أو مرجع أو رقم OEM…',
    newInvoice: 'فاتورة جديدة',
    addPart: 'إضافة قطعة',
    stockEntry: 'إضافة للمخزون',
    overview: 'نظرة عامة',
    lowStock: 'مخزون منخفض',
    recentInvoices: 'آخر الفواتير',
    allParts: 'كل القطع',
    parts: 'قطعة',
    inStock: 'في المخزون',
    invoiceDraft: 'مسودة فاتورة',
    customer: 'الحريف',
    walkIn: 'حريف مباشر',
    designation: 'البيان',
    ref: 'المرجع',
    qty: 'الكمية',
    unitPrice: 'سعر الوحدة',
    total: 'المجموع',
    subtotal: 'المجموع دون أداء',
    vat: 'الأداء',
    totalTtc: 'المجموع شامل الأداء',
    saveDraft: 'حفظ',
    print: 'معاينة / طباعة',
    finalize: 'تأكيد الفاتورة'
  }
} as const

export type CopyKey = keyof typeof copy.fr

export function t(lang: Language, key: CopyKey): string {
  return copy[lang][key]
}

export function localeFor(lang: Language): string {
  if (lang === 'ar') return 'ar-TN'
  if (lang === 'en') return 'en-TN'
  return 'fr-TN'
}

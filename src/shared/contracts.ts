export type Language = 'fr' | 'en' | 'ar'

export type Part = {
  id: number
  reference: string
  designation: string
  oemReference: string | null
  vehicleCompatibility: string | null
  categoryId: number | null
  categoryName: string | null
  supplierId: number | null
  purchasePriceMillimes: number
  salePriceMillimes: number
  quantity: number
  lowStockThreshold: number
  location: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreatePartInput = {
  reference: string
  designation: string
  oemReference?: string
  vehicleCompatibility?: string
  categoryName?: string
  purchasePriceMillimes?: number
  salePriceMillimes: number
  initialQuantity?: number
  lowStockThreshold?: number
  location?: string
  notes?: string
}

export type AdjustStockInput = {
  partId: number
  delta: number
  reason: 'PURCHASE' | 'CORRECTION' | 'RETURN' | 'OTHER'
  note?: string
}

export type DashboardSummary = {
  activePartCount: number
  lowStockCount: number
  outOfStockCount: number
  todayInvoiceCount: number
  todaySalesMillimes: number
}

export type RecentInvoice = {
  id: number
  number: string
  customerName: string
  finalizedAt: string
  totalTtcMillimes: number
}

export type DashboardOverview = {
  summary: DashboardSummary
  lowStockParts: Part[]
  recentInvoices: RecentInvoice[]
}

export type CreateInvoiceLineInput = {
  partId?: number
  reference: string
  designation: string
  quantity: number
  unitPriceHtMillimes: number
  discountPercent?: number
  taxPercent?: number
}

export type FinalizeInvoiceInput = {
  customerName?: string
  customerAddress?: string
  customerTaxId?: string
  notes?: string
  lines: CreateInvoiceLineInput[]
}

export type FinalizedInvoiceLine = {
  reference: string
  designation: string
  quantity: number
  unitPriceHtMillimes: number
  discountMillimes: number
  taxPercent: number
  lineHtMillimes: number
  taxMillimes: number
  lineTtcMillimes: number
}

export type FinalizedInvoice = {
  id: number
  number: string
  customerName: string
  customerAddress: string | null
  customerTaxId: string | null
  notes: string | null
  finalizedAt: string
  subtotalHtMillimes: number
  discountMillimes: number
  taxMillimes: number
  totalTtcMillimes: number
  lines: FinalizedInvoiceLine[]
}

export type DesktopApi = {
  platform: string
  parts: {
    list: (query?: string) => Promise<Part[]>
    create: (input: CreatePartInput) => Promise<Part>
    adjustStock: (input: AdjustStockInput) => Promise<Part>
  }
  dashboard: {
    overview: () => Promise<DashboardOverview>
  }
  invoices: {
    finalize: (input: FinalizeInvoiceInput) => Promise<FinalizedInvoice>
    get: (id: number) => Promise<FinalizedInvoice | null>
  }
}

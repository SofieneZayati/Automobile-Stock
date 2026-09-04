export type Part = {
  id: number
  ref: string
  designation: string
  vehicle: string
  category: string
  qty: number
  threshold: number
  priceMillimes: number
  location: string
}

export const parts: Part[] = [
  { id: 1, ref: 'BM-PEU-014', designation: 'Filtre à huile', vehicle: 'Peugeot / Citroën', category: 'Filtration', qty: 24, threshold: 6, priceMillimes: 12500, location: 'A-03' },
  { id: 2, ref: 'BM-REN-027', designation: 'Plaquettes de frein avant', vehicle: 'Renault Clio IV', category: 'Freinage', qty: 4, threshold: 5, priceMillimes: 68000, location: 'B-12' },
  { id: 3, ref: 'BM-CIT-008', designation: 'Courroie accessoires', vehicle: 'Citroën C3', category: 'Moteur', qty: 9, threshold: 3, priceMillimes: 39500, location: 'C-04' },
  { id: 4, ref: 'BM-REN-041', designation: 'Rotule de direction', vehicle: 'Renault Symbol', category: 'Direction', qty: 2, threshold: 4, priceMillimes: 32000, location: 'D-02' },
  { id: 5, ref: 'BM-PEU-033', designation: 'Balai essuie-glace', vehicle: 'Peugeot 208', category: 'Carrosserie', qty: 16, threshold: 5, priceMillimes: 22500, location: 'E-07' }
]

export const recentInvoices = [
  { number: 'F-2026-0048', customer: 'Client comptoir', date: '04/09/2026 · 18:42', total: 136000, status: 'Payée' },
  { number: 'F-2026-0047', customer: 'Garage El Manar', date: '04/09/2026 · 16:15', total: 289500, status: 'Payée' },
  { number: 'F-2026-0046', customer: 'M. Trabelsi', date: '04/09/2026 · 11:03', total: 79500, status: 'Payée' }
]

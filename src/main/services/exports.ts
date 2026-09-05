import { app, dialog } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { listParts } from '../repositories/parts'
import type { Part, StockExportResult } from '../../shared/contracts'

export async function exportPartsCsv(
  query = '',
  includeArchived = false
): Promise<StockExportResult | null> {
  const parts = listParts(query, includeArchived)
  const stamp = new Intl.DateTimeFormat('en-CA').format(new Date())

  const result = await dialog.showSaveDialog({
    title: 'Exporter le stock Ben Mahmoud',
    defaultPath: join(
      app.getPath('documents'),
      `Ben-Mahmoud-Stock-${stamp}.csv`
    ),
    buttonLabel: 'Exporter',
    filters: [{ name: 'Fichier CSV', extensions: ['csv'] }]
  })

  if (result.canceled || !result.filePath) return null

  const target = result.filePath.toLowerCase().endsWith('.csv')
    ? result.filePath
    : `${result.filePath}.csv`

  const header = [
    'Référence',
    'Désignation',
    'Référence OEM',
    'Compatibilité',
    'Catégorie',
    'Fournisseur',
    'Emplacement',
    'Prix achat DT',
    'Prix vente DT',
    'Quantité',
    'Seuil stock faible',
    'Statut',
    'Notes'
  ]

  const rows = [
    header,
    ...parts.map(partToCsvRow)
  ]

  const content = rows
    .map((row) => row.map(csvCell).join(';'))
    .join('\r\n')

  writeFileSync(target, `\uFEFF${content}\r\n`, 'utf8')

  return {
    path: target,
    rowCount: parts.length
  }
}

function partToCsvRow(part: Part): Array<string | number> {
  return [
    part.reference,
    part.designation,
    part.oemReference ?? '',
    part.vehicleCompatibility ?? '',
    part.categoryName ?? '',
    part.supplierName ?? '',
    part.location ?? '',
    formatMillimes(part.purchasePriceMillimes),
    formatMillimes(part.salePriceMillimes),
    part.quantity,
    part.lowStockThreshold,
    part.isActive ? 'Actif' : 'Archivé',
    part.notes ?? ''
  ]
}

function formatMillimes(value: number): string {
  return (value / 1000).toFixed(3).replace('.', ',')
}

function csvCell(value: string | number): string {
  const text = String(value)
  return `"${text.replaceAll('"', '""')}"`
}

import { app, dialog, type WebContents } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PdfExportResult } from '../../shared/contracts'

export async function saveCurrentInvoicePdf(
  webContents: WebContents,
  suggestedName?: string
): Promise<PdfExportResult | null> {
  const safeName = sanitizeFileName(suggestedName || 'Facture')
  const result = await dialog.showSaveDialog({
    title: 'Enregistrer la facture en PDF',
    defaultPath: join(
      app.getPath('documents'),
      safeName.toLowerCase().endsWith('.pdf')
        ? safeName
        : `${safeName}.pdf`
    ),
    buttonLabel: 'Enregistrer le PDF',
    filters: [{ name: 'Document PDF', extensions: ['pdf'] }]
  })

  if (result.canceled || !result.filePath) return null

  const target = result.filePath.toLowerCase().endsWith('.pdf')
    ? result.filePath
    : `${result.filePath}.pdf`

  const data = await webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    landscape: false
  })

  if (!data || data.length === 0) {
    throw new Error('Le PDF généré est vide.')
  }

  writeFileSync(target, data)

  return { path: target }
}

function sanitizeFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120)

  return cleaned || 'Facture'
}

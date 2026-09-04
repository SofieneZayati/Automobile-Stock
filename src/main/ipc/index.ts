import { ipcMain } from 'electron'
import { adjustStock, createPart, listParts } from '../repositories/parts'
import { getDashboardOverview } from '../services/dashboard'
import { finalizeInvoice, getInvoice } from '../services/invoices'
import type { AdjustStockInput, CreatePartInput, FinalizeInvoiceInput } from '../../shared/contracts'

export function registerIpcHandlers(): void {
  ipcMain.handle('parts:list', (_event, query?: string) => listParts(typeof query === 'string' ? query : ''))
  ipcMain.handle('parts:create', (_event, input: CreatePartInput) => createPart(input))
  ipcMain.handle('parts:adjust-stock', (_event, input: AdjustStockInput) => adjustStock(input))

  ipcMain.handle('dashboard:overview', () => getDashboardOverview())

  ipcMain.handle('invoices:finalize', (_event, input: FinalizeInvoiceInput) => finalizeInvoice(input))
  ipcMain.handle('invoices:get', (_event, id: number) => getInvoice(id))
}

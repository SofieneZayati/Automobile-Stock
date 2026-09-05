import { ipcMain } from 'electron'
import { adjustStock, createPart, listParts } from '../repositories/parts'
import { createClient, listClients, updateClient } from '../repositories/clients'
import { getDashboardOverview } from '../services/dashboard'
import { finalizeInvoice, getInvoice, listInvoices } from '../services/invoices'
import { createBackup, restoreBackup } from '../services/backup'
import { getBusinessSettings, updateBusinessSettings } from '../services/settings'
import type { AdjustStockInput, BusinessSettings, CreateClientInput, CreatePartInput, FinalizeInvoiceInput, UpdateClientInput } from '../../shared/contracts'

export function registerIpcHandlers(): void {
  ipcMain.handle('parts:list', (_event, query?: string) => listParts(typeof query === 'string' ? query : ''))
  ipcMain.handle('parts:create', (_event, input: CreatePartInput) => createPart(input))
  ipcMain.handle('parts:adjust-stock', (_event, input: AdjustStockInput) => adjustStock(input))

  ipcMain.handle('clients:list', (_event, query?: string) =>
    listClients(typeof query === 'string' ? query : '')
  )
  ipcMain.handle('clients:create', (_event, input: CreateClientInput) => createClient(input))
  ipcMain.handle('clients:update', (_event, input: UpdateClientInput) => updateClient(input))

  ipcMain.handle('dashboard:overview', () => getDashboardOverview())

  ipcMain.handle('invoices:finalize', (_event, input: FinalizeInvoiceInput) => finalizeInvoice(input))
  ipcMain.handle('invoices:get', (_event, id: number) => getInvoice(id))
  ipcMain.handle('invoices:list', (_event, query?: string) => listInvoices(typeof query === 'string' ? query : ''))

  ipcMain.handle('backup:create', () => createBackup())
  ipcMain.handle('backup:restore', () => restoreBackup())

  ipcMain.handle('settings:business:get', () => getBusinessSettings())
  ipcMain.handle('settings:business:update', (_event, settings: BusinessSettings) =>
    updateBusinessSettings(settings)
  )
}

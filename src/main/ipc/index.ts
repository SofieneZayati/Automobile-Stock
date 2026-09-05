import { ipcMain } from 'electron'
import { adjustStock, createPart, listParts, listStockMovements, setPartActive, updatePart } from '../repositories/parts'
import { createClient, listClients, updateClient } from '../repositories/clients'
import { createSupplier, listSuppliers, updateSupplier } from '../repositories/suppliers'
import { getDashboardOverview } from '../services/dashboard'
import { finalizeInvoice, getInvoice, listInvoices } from '../services/invoices'
import { createBackup, restoreBackup } from '../services/backup'
import { getBusinessSettings, updateBusinessSettings } from '../services/settings'
import type { AdjustStockInput, BusinessSettings, CreateClientInput, CreatePartInput, CreateSupplierInput, FinalizeInvoiceInput, UpdateClientInput, UpdatePartInput, UpdateSupplierInput } from '../../shared/contracts'

export function registerIpcHandlers(): void {
  ipcMain.handle('parts:list', (_event, query?: string, includeArchived?: boolean) =>
    listParts(typeof query === 'string' ? query : '', includeArchived === true)
  )
  ipcMain.handle('parts:create', (_event, input: CreatePartInput) => createPart(input))
  ipcMain.handle('parts:update', (_event, input: UpdatePartInput) => updatePart(input))
  ipcMain.handle('parts:set-active', (_event, partId: number, isActive: boolean) =>
    setPartActive(partId, isActive === true)
  )
  ipcMain.handle('parts:adjust-stock', (_event, input: AdjustStockInput) => adjustStock(input))
  ipcMain.handle('parts:movements', (_event, partId: number) => listStockMovements(partId))

  ipcMain.handle('clients:list', (_event, query?: string) =>
    listClients(typeof query === 'string' ? query : '')
  )
  ipcMain.handle('clients:create', (_event, input: CreateClientInput) => createClient(input))
  ipcMain.handle('clients:update', (_event, input: UpdateClientInput) => updateClient(input))

  ipcMain.handle('suppliers:list', (_event, query?: string) =>
    listSuppliers(typeof query === 'string' ? query : '')
  )
  ipcMain.handle('suppliers:create', (_event, input: CreateSupplierInput) => createSupplier(input))
  ipcMain.handle('suppliers:update', (_event, input: UpdateSupplierInput) => updateSupplier(input))

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

import { contextBridge, ipcRenderer } from 'electron'
import type {
  AdjustStockInput,
  BusinessSettings,
  CreateClientInput,
  CreatePartInput,
  CreateSupplierInput,
  DesktopApi,
  FinalizeInvoiceInput,
  UpdateClientInput,
  UpdatePartInput,
  UpdateSupplierInput
} from '../shared/contracts'

const api: DesktopApi = {
  platform: process.platform,
  parts: {
    list: (query = '', includeArchived = false) =>
      ipcRenderer.invoke('parts:list', query, includeArchived),
    create: (input: CreatePartInput) => ipcRenderer.invoke('parts:create', input),
    update: (input: UpdatePartInput) => ipcRenderer.invoke('parts:update', input),
    setActive: (partId: number, isActive: boolean) =>
      ipcRenderer.invoke('parts:set-active', partId, isActive),
    adjustStock: (input: AdjustStockInput) => ipcRenderer.invoke('parts:adjust-stock', input),
    movements: (partId: number) => ipcRenderer.invoke('parts:movements', partId)
  },
  clients: {
    list: (query = '') => ipcRenderer.invoke('clients:list', query),
    create: (input: CreateClientInput) => ipcRenderer.invoke('clients:create', input),
    update: (input: UpdateClientInput) => ipcRenderer.invoke('clients:update', input)
  },
  suppliers: {
    list: (query = '') => ipcRenderer.invoke('suppliers:list', query),
    create: (input: CreateSupplierInput) => ipcRenderer.invoke('suppliers:create', input),
    update: (input: UpdateSupplierInput) => ipcRenderer.invoke('suppliers:update', input)
  },
  dashboard: {
    overview: () => ipcRenderer.invoke('dashboard:overview')
  },
  invoices: {
    finalize: (input: FinalizeInvoiceInput) => ipcRenderer.invoke('invoices:finalize', input),
    get: (id: number) => ipcRenderer.invoke('invoices:get', id),
    list: (query = '') => ipcRenderer.invoke('invoices:list', query),
    saveDraft: (input: FinalizeInvoiceInput, draftId?: number) =>
      ipcRenderer.invoke('invoices:draft-save', input, draftId),
    getDraft: (id: number) => ipcRenderer.invoke('invoices:draft-get', id),
    listDrafts: () => ipcRenderer.invoke('invoices:draft-list'),
    deleteDraft: (id: number) => ipcRenderer.invoke('invoices:draft-delete', id),
    cancel: (id: number, reason: string) =>
      ipcRenderer.invoke('invoices:cancel', id, reason)
  },
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    restore: () => ipcRenderer.invoke('backup:restore')
  },
  settings: {
    getBusiness: () => ipcRenderer.invoke('settings:business:get'),
    updateBusiness: (settings: BusinessSettings) =>
      ipcRenderer.invoke('settings:business:update', settings)
  }
}

contextBridge.exposeInMainWorld('desktop', api)

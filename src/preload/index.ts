import { contextBridge, ipcRenderer } from 'electron'
import type {
  AdjustStockInput,
  CreatePartInput,
  DesktopApi,
  FinalizeInvoiceInput
} from '../shared/contracts'

const api: DesktopApi = {
  platform: process.platform,
  parts: {
    list: (query = '') => ipcRenderer.invoke('parts:list', query),
    create: (input: CreatePartInput) => ipcRenderer.invoke('parts:create', input),
    adjustStock: (input: AdjustStockInput) => ipcRenderer.invoke('parts:adjust-stock', input)
  },
  dashboard: {
    overview: () => ipcRenderer.invoke('dashboard:overview')
  },
  invoices: {
    finalize: (input: FinalizeInvoiceInput) => ipcRenderer.invoke('invoices:finalize', input),
    get: (id: number) => ipcRenderer.invoke('invoices:get', id),
    list: (query = '') => ipcRenderer.invoke('invoices:list', query)
  },
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    restore: () => ipcRenderer.invoke('backup:restore')
  }
}

contextBridge.exposeInMainWorld('desktop', api)

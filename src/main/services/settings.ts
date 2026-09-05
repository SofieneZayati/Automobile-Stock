import { getDatabase } from '../database'
import type { BusinessSettings } from '../../shared/contracts'

const SETTINGS_KEY = 'business'

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  companyName: 'Etablissement Ben Mahmoud',
  activity: 'Équipement Automobiles',
  companyNameAr: 'مؤسسة بن محمود',
  activityAr: 'تجهيز السيارات',
  address: '31, Rue Chedly Kallala, 1002 Tunis',
  phone1: '71 801 813',
  phone2: '29 276 853',
  taxId: '',
  defaultTaxPercent: 19,
  invoicePrefix: 'F',
  invoiceDigits: 4,
  defaultCustomerName: 'Client comptoir'
}

export function getBusinessSettings(): BusinessSettings {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT value_json FROM app_settings WHERE key = ?'
  ).get(SETTINGS_KEY) as { value_json: string } | undefined

  if (!row) return { ...DEFAULT_BUSINESS_SETTINGS }

  try {
    return normalizeBusinessSettings(JSON.parse(row.value_json))
  } catch {
    return { ...DEFAULT_BUSINESS_SETTINGS }
  }
}

export function updateBusinessSettings(input: BusinessSettings): BusinessSettings {
  const db = getDatabase()
  const settings = normalizeBusinessSettings(input)

  db.prepare(`
    INSERT INTO app_settings(key, value_json, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = datetime('now')
  `).run(SETTINGS_KEY, JSON.stringify(settings))

  db.prepare(`
    INSERT INTO audit_log(entity_type, entity_id, action, details_json)
    VALUES ('settings', NULL, 'UPDATE_BUSINESS', ?)
  `).run(JSON.stringify({
    companyName: settings.companyName,
    defaultTaxPercent: settings.defaultTaxPercent,
    invoicePrefix: settings.invoicePrefix,
    invoiceDigits: settings.invoiceDigits
  }))

  return settings
}

export function normalizeBusinessSettings(value: unknown): BusinessSettings {
  const input = isRecord(value) ? value : {}

  return {
    companyName: requiredText(input.companyName, DEFAULT_BUSINESS_SETTINGS.companyName, 120),
    activity: requiredText(input.activity, DEFAULT_BUSINESS_SETTINGS.activity, 120),
    companyNameAr: optionalText(input.companyNameAr, DEFAULT_BUSINESS_SETTINGS.companyNameAr, 120),
    activityAr: optionalText(input.activityAr, DEFAULT_BUSINESS_SETTINGS.activityAr, 120),
    address: requiredText(input.address, DEFAULT_BUSINESS_SETTINGS.address, 220),
    phone1: optionalText(input.phone1, DEFAULT_BUSINESS_SETTINGS.phone1, 40),
    phone2: optionalText(input.phone2, DEFAULT_BUSINESS_SETTINGS.phone2, 40),
    taxId: optionalText(input.taxId, '', 80),
    defaultTaxPercent: percentage(input.defaultTaxPercent, DEFAULT_BUSINESS_SETTINGS.defaultTaxPercent),
    invoicePrefix: invoicePrefix(input.invoicePrefix),
    invoiceDigits: invoiceDigits(input.invoiceDigits),
    defaultCustomerName: requiredText(
      input.defaultCustomerName,
      DEFAULT_BUSINESS_SETTINGS.defaultCustomerName,
      120
    )
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== 'string') return fallback
  const text = value.trim()
  return text ? text.slice(0, max) : fallback
}

function optionalText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== 'string') return fallback
  return value.trim().slice(0, max)
}

function percentage(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return fallback
  return Math.round(parsed * 1000) / 1000
}

function invoicePrefix(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_BUSINESS_SETTINGS.invoicePrefix
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8)
  return normalized || DEFAULT_BUSINESS_SETTINGS.invoicePrefix
}

function invoiceDigits(value: unknown): number {
  const parsed = typeof value === 'number' ? Math.round(value) : Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < 3 || parsed > 8) {
    return DEFAULT_BUSINESS_SETTINGS.invoiceDigits
  }
  return parsed
}

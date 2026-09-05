import { getDatabase } from '../database'
import type {
  Client,
  CreateClientInput,
  UpdateClientInput
} from '../../shared/contracts'

export function listClients(query = ''): Client[] {
  const db = getDatabase()
  const needle = query.trim()
  const params = needle
    ? [`%${needle}%`, `%${needle}%`, `%${needle}%`, `%${needle}%`]
    : []

  const rows = db.prepare(`
    SELECT id, name, phone, address, tax_id, notes, created_at, updated_at
    FROM clients
    ${needle
      ? 'WHERE name LIKE ? COLLATE NOCASE OR phone LIKE ? COLLATE NOCASE OR tax_id LIKE ? COLLATE NOCASE OR address LIKE ? COLLATE NOCASE'
      : ''}
    ORDER BY name COLLATE NOCASE, id
    LIMIT 500
  `).all(...params) as Array<{
    id: number
    name: string
    phone: string | null
    address: string | null
    tax_id: string | null
    notes: string | null
    created_at: string
    updated_at: string
  }>

  return rows.map(mapClient)
}

export function createClient(input: CreateClientInput): Client {
  const db = getDatabase()
  const name = requiredText(input.name, 'name')
  const phone = cleanText(input.phone)
  const address = cleanText(input.address)
  const taxId = cleanText(input.taxId)
  const notes = cleanText(input.notes)

  const result = db.prepare(`
    INSERT INTO clients(name, phone, address, tax_id, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, phone, address, taxId, notes)

  const id = Number(result.lastInsertRowid)

  db.prepare(`
    INSERT INTO audit_log(entity_type, entity_id, action, details_json)
    VALUES ('client', ?, 'CREATE', ?)
  `).run(id, JSON.stringify({ name, phone, taxId }))

  const client = getClient(id)
  if (!client) throw new Error('Created client could not be loaded')
  return client
}

export function updateClient(input: UpdateClientInput): Client {
  const db = getDatabase()
  if (!Number.isInteger(input.id) || input.id <= 0) {
    throw new Error('Invalid client id')
  }

  const existing = getClient(input.id)
  if (!existing) throw new Error('Client not found')

  const name = requiredText(input.name, 'name')
  const phone = cleanText(input.phone)
  const address = cleanText(input.address)
  const taxId = cleanText(input.taxId)
  const notes = cleanText(input.notes)

  const result = db.prepare(`
    UPDATE clients
    SET
      name = ?,
      phone = ?,
      address = ?,
      tax_id = ?,
      notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name, phone, address, taxId, notes, input.id)

  if (result.changes !== 1) throw new Error('Client could not be updated')

  db.prepare(`
    INSERT INTO audit_log(entity_type, entity_id, action, details_json)
    VALUES ('client', ?, 'UPDATE', ?)
  `).run(input.id, JSON.stringify({ name, phone, taxId }))

  const client = getClient(input.id)
  if (!client) throw new Error('Updated client could not be loaded')
  return client
}

function getClient(id: number): Client | null {
  const db = getDatabase()
  const row = db.prepare(`
    SELECT id, name, phone, address, tax_id, notes, created_at, updated_at
    FROM clients
    WHERE id = ?
  `).get(id) as {
    id: number
    name: string
    phone: string | null
    address: string | null
    tax_id: string | null
    notes: string | null
    created_at: string
    updated_at: string
  } | undefined

  return row ? mapClient(row) : null
}

function mapClient(row: {
  id: number
  name: string
  phone: string | null
  address: string | null
  tax_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}): Client {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    taxId: row.tax_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function cleanText(value?: string): string | null {
  const text = value?.trim()
  return text ? text.slice(0, 500) : null
}

function requiredText(value: string, field: string): string {
  const text = value?.trim()
  if (!text) throw new Error(`${field} is required`)
  return text.slice(0, 160)
}

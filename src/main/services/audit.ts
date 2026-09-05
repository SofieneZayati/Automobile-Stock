import { getDatabase } from '../database'
import type { AuditEntry } from '../../shared/contracts'

export function listAuditEntries(limitValue = 100): AuditEntry[] {
  const limit = Number.isInteger(limitValue)
    ? Math.max(1, Math.min(500, limitValue))
    : 100

  const rows = getDatabase().prepare(`
    SELECT
      id,
      entity_type,
      entity_id,
      action,
      details_json,
      created_at
    FROM audit_log
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: number
    entity_type: string
    entity_id: number | null
    action: string
    details_json: string | null
    created_at: string
  }>

  return rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    details: parseDetails(row.details_json),
    createdAt: row.created_at
  }))
}

function parseDetails(value: string | null): Record<string, unknown> | null {
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

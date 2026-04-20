/**
 * Prevailing-wage top-up lines on pay stubs: dedup via `source_clock_session_id`;
 * legacy rows may still have `[pw:<uuid>]` prefix in `description` (parse for migration).
 */

import type { PayStubAdditionalLineRow } from './payStubDeductions'

/** Regex: leading tag `[pw:<uuid>] ` then human-readable remainder. */
const PW_TAG_RE = /^\[pw:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\s*(.*)$/i

/** Strip legacy machine prefix from description for display and new saves. */
export function stripPrevailingWageTag(description: string): string {
  const m = description.trim().match(PW_TAG_RE)
  if (m?.[2] != null) return m[2].trim()
  return description.trim()
}

export function parsePrevailingSessionId(description: string): string | null {
  const m = description.trim().match(PW_TAG_RE)
  return m?.[1] ?? null
}

export function existingLineForSession(
  lines: PayStubAdditionalLineRow[],
  sessionId: string,
): PayStubAdditionalLineRow | undefined {
  const sid = sessionId.trim().toLowerCase()
  for (const line of lines) {
    const fromDesc = parsePrevailingSessionId(line.description)
    if (fromDesc && fromDesc.toLowerCase() === sid) return line
    const col = line.source_clock_session_id
    if (col && String(col).toLowerCase() === sid) return line
  }
  return undefined
}

export function buildPrevailingWageHumanPart(args: {
  workDateYmd: string
  prevailingRate: number
  baseRate: number
}): string {
  const { workDateYmd, prevailingRate, baseRate } = args
  const p = prevailingRate.toFixed(2)
  const b = baseRate.toFixed(2)
  return `Prevailing top-up ${workDateYmd}: $${p}/hr − $${b}/hr`
}

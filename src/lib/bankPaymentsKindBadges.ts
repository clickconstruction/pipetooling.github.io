/** Shared per-origin (localStorage) kind labels/colors for Jobs → Bank payments AR sorting. */

import { formatMercuryKind } from './mercuryKindLabels'

export type MercuryKindBadge = {
  /** Empty string → display `formatMercuryKind` (mercuryKindLabels) */
  nickname: string
  /** `#rrggbb` lowercase */
  color: string
}

const STORAGE_KEY = 'bank_payments_kind_badges_v1'

const NEUTRAL_BADGE_BG = '#e5e7eb'

export function defaultKindBadgeColor(): string {
  return NEUTRAL_BADGE_BG
}

/** Same string as list badges and `jobs_ledger_payments.payment_type` when applying bank payments. */
export function mercuryKindPaymentTypeLabel(kind: string, kindBadges: Record<string, MercuryKindBadge>): string {
  const nick = (kindBadges[kind]?.nickname ?? '').trim()
  if (nick.length > 0) return nick
  return formatMercuryKind(kind)
}

/** Normalize to `#rrggbb` or null if invalid. */
export function normalizeHexColor(input: string): string | null {
  const s = input.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1]
    const g = s[2]
    const b = s[3]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return null
}

function isValidKindKey(k: string): boolean {
  return typeof k === 'string' && k.length > 0 && k.length <= 120
}

function normalizeBadgeEntry(raw: unknown): MercuryKindBadge | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const nickname = typeof o.nickname === 'string' ? o.nickname.trim() : ''
  const colorRaw = typeof o.color === 'string' ? o.color.trim() : ''
  const color = normalizeHexColor(colorRaw) ?? (colorRaw.length === 0 ? defaultKindBadgeColor() : null)
  if (!color) return null
  return { nickname, color }
}

export function loadBankPaymentsKindBadges(): Record<string, MercuryKindBadge> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return {}
    const out: Record<string, MercuryKindBadge> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isValidKindKey(k)) continue
      const n = normalizeBadgeEntry(v)
      if (n) out[k] = n
    }
    return out
  } catch {
    return {}
  }
}

export function saveBankPaymentsKindBadges(map: Record<string, MercuryKindBadge>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / private mode */
  }
}

/** Keep only badge entries whose kind is in the allowed set (from Mercury sample query). */
export function pruneKindBadgesToChoices(
  badges: Record<string, MercuryKindBadge>,
  allowedKinds: readonly string[],
): Record<string, MercuryKindBadge> {
  const allow = new Set(allowedKinds)
  const out: Record<string, MercuryKindBadge> = {}
  for (const [k, v] of Object.entries(badges)) {
    if (allow.has(k)) out[k] = v
  }
  return out
}

/** Relative luminance of `#rrggbb`; returns `'#111827'` or `#ffffff` for readable contrast. */
export function pickTextOnBackground(hex: string): '#111827' | '#ffffff' {
  const n = normalizeHexColor(hex)
  if (!n) return '#111827'
  const r = parseInt(n.slice(1, 3), 16) / 255
  const g = parseInt(n.slice(3, 5), 16) / 255
  const b = parseInt(n.slice(5, 7), 16) / 255
  const linear = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const rs = linear[0] ?? 0
  const gs = linear[1] ?? 0
  const bs = linear[2] ?? 0
  const L = 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  return L > 0.55 ? '#111827' : '#ffffff'
}

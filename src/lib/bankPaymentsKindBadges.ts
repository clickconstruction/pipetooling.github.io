/**
 * Kind labels/colors for Jobs → Bank payments: canonical copy in `app_settings` (dev-written);
 * `localStorage` mirrors as a cache after fetch/save.
 */

import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { APP_SETTINGS_KEY_BANK_PAYMENTS_KIND_BADGES } from './appSettingsKeys'
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

/** Parse JSON object (already parsed) into a validated badge map. */
export function parseBankPaymentsKindBadgesObject(parsed: unknown): Record<string, MercuryKindBadge> {
  if (parsed === null || typeof parsed !== 'object') return {}
  const out: Record<string, MercuryKindBadge> = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isValidKindKey(k)) continue
    const n = normalizeBadgeEntry(v)
    if (n) out[k] = n
  }
  return out
}

export function loadBankPaymentsKindBadges(): Record<string, MercuryKindBadge> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parseBankPaymentsKindBadgesObject(parsed)
  } catch {
    return {}
  }
}

/** Read org-wide badges from `app_settings`. Returns `{ badges, rowExists }` so callers can migrate local-only data when no row. */
export async function fetchBankPaymentsKindBadgesFromAppSettings(): Promise<{
  badges: Record<string, MercuryKindBadge>
  rowExists: boolean
}> {
  try {
    const data = (await withSupabaseRetry(
      async () =>
        supabase
          .from('app_settings')
          .select('value_text')
          .eq('key', APP_SETTINGS_KEY_BANK_PAYMENTS_KIND_BADGES)
          .maybeSingle(),
      'fetch_bank_payments_kind_badges',
    )) as { value_text: string | null } | null
    if (data == null) {
      return { badges: {}, rowExists: false }
    }
    const text = data.value_text
    if (text == null || text.trim() === '') {
      return { badges: {}, rowExists: true }
    }
    try {
      const parsed: unknown = JSON.parse(text)
      return { badges: parseBankPaymentsKindBadgesObject(parsed), rowExists: true }
    } catch {
      return { badges: {}, rowExists: true }
    }
  } catch {
    return { badges: {}, rowExists: false }
  }
}

/** Dev-only (RLS): upsert global Kind badges JSON. */
export async function upsertBankPaymentsKindBadgesToAppSettings(
  map: Record<string, MercuryKindBadge>,
): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.from('app_settings').upsert(
        { key: APP_SETTINGS_KEY_BANK_PAYMENTS_KIND_BADGES, value_text: JSON.stringify(map) },
        { onConflict: 'key' },
      ),
    'upsert_bank_payments_kind_badges',
  )
}

export function saveBankPaymentsKindBadgesLocalCache(map: Record<string, MercuryKindBadge>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / private mode */
  }
}

export function saveBankPaymentsKindBadges(map: Record<string, MercuryKindBadge>): void {
  saveBankPaymentsKindBadgesLocalCache(map)
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

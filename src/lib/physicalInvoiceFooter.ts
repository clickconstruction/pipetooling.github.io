import { APP_SETTINGS_KEY_PHYSICAL_INVOICE_FOOTER_PRESETS_V1 } from './appSettingsKeys'
import { supabase } from './supabase'
import { STRIPE_INVOICE_FOOTER_MAX_CHARS } from './stripeInvoiceFooter'
import { withSupabaseRetry } from '../utils/errorHandling'

/** Same cap as Stripe invoice footer (PDF/email body). */
export const PHYSICAL_INVOICE_FOOTER_MAX_CHARS = STRIPE_INVOICE_FOOTER_MAX_CHARS

/** Max dev-added presets per organization (`app_settings`). */
export const PHYSICAL_INVOICE_FOOTER_CUSTOM_PRESET_MAX = 20

/** Shipped display labels for builtin presets (overridable in Settings). */
export const PHYSICAL_INVOICE_FOOTER_SHIPPED_LABEL_STANDARD = 'Standard'
export const PHYSICAL_INVOICE_FOOTER_SHIPPED_LABEL_ALTERNATE = 'Alternate'

/** Max length for preset display labels (Settings + Bill Customer UI). */
export const PHYSICAL_INVOICE_FOOTER_LABEL_MAX_CHARS = 200

const LS_KEY_PHYSICAL_INVOICE_FOOTER_PRESETS = 'pipetooling-physical-invoice-footer-presets'

/** Shipped default bodies (repo). */
export const PHYSICAL_INVOICE_FOOTER_PRESET_STANDARD = `PipeTooling — Click Plumbing and Electrical
Questions about this invoice? Reply to this email or call the office.
Ph: 801-252-5155
12925 FM 20 Kingsbury TX 78638`

export const PHYSICAL_INVOICE_FOOTER_PRESET_ALTERNATE = `Payment is due by the due date shown above. Thank you for your business.
Click Plumbing and Electrical
office@clickplumbing.com | Ph: 801-252-5155
12925 FM 20 Kingsbury TX 78638`

export type PhysicalInvoiceFooterBuiltinId = 'standard' | 'alternate'

export type PhysicalInvoiceFooterPreset = {
  id: string
  label: string
  body: string
}

export type PhysicalInvoiceFooterCustomPreset = {
  id: string
  label: string
  body: string
}

type PhysicalInvoiceFooterLsV2 = {
  v: 2
  builtinOverrides?: Partial<Record<PhysicalInvoiceFooterBuiltinId, string>>
  builtinLabelOverrides?: Partial<Record<PhysicalInvoiceFooterBuiltinId, string>>
  customPresets?: PhysicalInvoiceFooterCustomPreset[]
  /** Omitted or `'standard'` in memory means shipped default. Persist only when `'alternate'` or a custom id. */
  defaultPresetId?: string
}

/** @deprecated Legacy shape; migrated to v2 on read from local mirror only. */
type PhysicalInvoiceFooterLegacyStored = {
  standard?: string
  alternate?: string
}

const BUILTIN_DEFS: Array<{
  id: PhysicalInvoiceFooterBuiltinId
  label: string
  shippedBody: string
}> = [
  { id: 'standard', label: PHYSICAL_INVOICE_FOOTER_SHIPPED_LABEL_STANDARD, shippedBody: PHYSICAL_INVOICE_FOOTER_PRESET_STANDARD },
  { id: 'alternate', label: PHYSICAL_INVOICE_FOOTER_SHIPPED_LABEL_ALTERNATE, shippedBody: PHYSICAL_INVOICE_FOOTER_PRESET_ALTERNATE },
]

export type NormalizedPhysicalInvoiceFooterStorage = {
  builtinOverrides: Partial<Record<PhysicalInvoiceFooterBuiltinId, string>>
  builtinLabelOverrides: Partial<Record<PhysicalInvoiceFooterBuiltinId, string>>
  customPresets: PhysicalInvoiceFooterCustomPreset[]
  /** `null` = standard (default on open). */
  defaultPresetId: string | null
}

const EMPTY_NORMALIZED: NormalizedPhysicalInvoiceFooterStorage = {
  builtinOverrides: {},
  builtinLabelOverrides: {},
  customPresets: [],
  defaultPresetId: null,
}

/** After fetch/save we pin normalized state so getters stay consistent until next refresh. */
let sessionNormalized: NormalizedPhysicalInvoiceFooterStorage | undefined

function cloneNormalized(n: NormalizedPhysicalInvoiceFooterStorage): NormalizedPhysicalInvoiceFooterStorage {
  return {
    builtinOverrides: { ...n.builtinOverrides },
    builtinLabelOverrides: { ...n.builtinLabelOverrides },
    customPresets: n.customPresets.map((p) => ({ ...p })),
    defaultPresetId: n.defaultPresetId,
  }
}

function capFooter(s: string): string {
  return s.slice(0, PHYSICAL_INVOICE_FOOTER_MAX_CHARS)
}

function capLabel(s: string): string {
  return s.trim().slice(0, PHYSICAL_INVOICE_FOOTER_LABEL_MAX_CHARS)
}

function normalizeCustomPreset(p: PhysicalInvoiceFooterCustomPreset): PhysicalInvoiceFooterCustomPreset {
  return {
    id: p.id,
    label: p.label.trim(),
    body: capFooter(p.body),
  }
}

function parseBuiltinLabelOverrides(
  raw: unknown,
): Partial<Record<PhysicalInvoiceFooterBuiltinId, string>> {
  const out: Partial<Record<PhysicalInvoiceFooterBuiltinId, string>> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  const bo = raw as Record<string, unknown>
  if (typeof bo.standard === 'string') {
    const t = capLabel(bo.standard)
    if (t.length > 0) out.standard = t
  }
  if (typeof bo.alternate === 'string') {
    const t = capLabel(bo.alternate)
    if (t.length > 0) out.alternate = t
  }
  return out
}

/** Parse stored JSON (`v: 2`). Invalid shapes yield empty normalized storage. */
export function parsePhysicalInvoiceFooterStoredJson(parsed: unknown): NormalizedPhysicalInvoiceFooterStorage {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return cloneNormalized(EMPTY_NORMALIZED)
  }
  const o = parsed as Record<string, unknown>
  if (o.v !== 2) {
    return cloneNormalized(EMPTY_NORMALIZED)
  }
  const v2 = o as PhysicalInvoiceFooterLsV2
  const builtinOverrides: Partial<Record<PhysicalInvoiceFooterBuiltinId, string>> = {}
  if (v2.builtinOverrides && typeof v2.builtinOverrides === 'object' && !Array.isArray(v2.builtinOverrides)) {
    const bo = v2.builtinOverrides as Record<string, unknown>
    if (typeof bo.standard === 'string') builtinOverrides.standard = capFooter(bo.standard)
    if (typeof bo.alternate === 'string') builtinOverrides.alternate = capFooter(bo.alternate)
  }
  const builtinLabelOverrides = parseBuiltinLabelOverrides(v2.builtinLabelOverrides)
  let customPresets: PhysicalInvoiceFooterCustomPreset[] = []
  if (Array.isArray(v2.customPresets)) {
    customPresets = v2.customPresets
      .filter(
        (row): row is PhysicalInvoiceFooterCustomPreset =>
          row != null &&
          typeof row === 'object' &&
          typeof (row as PhysicalInvoiceFooterCustomPreset).id === 'string' &&
          typeof (row as PhysicalInvoiceFooterCustomPreset).label === 'string' &&
          typeof (row as PhysicalInvoiceFooterCustomPreset).body === 'string',
      )
      .map(normalizeCustomPreset)
      .slice(0, PHYSICAL_INVOICE_FOOTER_CUSTOM_PRESET_MAX)
  }
  let defaultPresetId: string | null = null
  if (typeof v2.defaultPresetId === 'string' && v2.defaultPresetId.trim().length > 0) {
    const d = v2.defaultPresetId.trim()
    defaultPresetId = d === 'standard' ? null : d
  }
  return { builtinOverrides, builtinLabelOverrides, customPresets, defaultPresetId }
}

function normalizedHasPersistablePayload(data: NormalizedPhysicalInvoiceFooterStorage): boolean {
  const hasBodyOv = Object.keys(data.builtinOverrides).length > 0
  const hasLabelOv = Object.keys(data.builtinLabelOverrides).length > 0
  const hasCustom = data.customPresets.length > 0
  const hasNonStandardDefault = data.defaultPresetId != null && data.defaultPresetId !== 'standard'
  return hasBodyOv || hasLabelOv || hasCustom || hasNonStandardDefault
}

/** Sparse JSON blob matching legacy local mirror shape (omit keys when equal to shipped-empty). */
function buildSparseV2OrNull(data: NormalizedPhysicalInvoiceFooterStorage): PhysicalInvoiceFooterLsV2 | null {
  const hasBodyOv = Object.keys(data.builtinOverrides).length > 0
  const hasLabelOv = Object.keys(data.builtinLabelOverrides).length > 0
  const hasCustom = data.customPresets.length > 0
  const hasNonStandardDefault = data.defaultPresetId != null && data.defaultPresetId !== 'standard'

  if (!hasBodyOv && !hasLabelOv && !hasCustom && !hasNonStandardDefault) {
    return null
  }

  return {
    v: 2,
    builtinOverrides: hasBodyOv ? data.builtinOverrides : undefined,
    builtinLabelOverrides: hasLabelOv ? data.builtinLabelOverrides : undefined,
    customPresets: hasCustom ? data.customPresets : undefined,
    defaultPresetId: hasNonStandardDefault ? data.defaultPresetId! : undefined,
  }
}

function persistLocalMirrorFromNormalized(data: NormalizedPhysicalInvoiceFooterStorage): void {
  if (typeof window === 'undefined') return
  try {
    const sparse = buildSparseV2OrNull(data)
    if (!sparse) {
      window.localStorage.removeItem(LS_KEY_PHYSICAL_INVOICE_FOOTER_PRESETS)
      return
    }
    window.localStorage.setItem(LS_KEY_PHYSICAL_INVOICE_FOOTER_PRESETS, JSON.stringify(sparse))
  } catch {
    /* quota / private mode */
  }
}

function applySessionCacheAndPersistLocalMirror(data: NormalizedPhysicalInvoiceFooterStorage): void {
  sessionNormalized = cloneNormalized(data)
  persistLocalMirrorFromNormalized(sessionNormalized)
}

/** Local mirror only (no session cache). Migrates legacy `{ standard, alternate }` rows into v2 mirror when needed. */
function readNormalizedFromLocalStorageOnly(): NormalizedPhysicalInvoiceFooterStorage {
  if (typeof window === 'undefined') {
    return cloneNormalized(EMPTY_NORMALIZED)
  }
  try {
    const raw = window.localStorage.getItem(LS_KEY_PHYSICAL_INVOICE_FOOTER_PRESETS)
    if (!raw) {
      return cloneNormalized(EMPTY_NORMALIZED)
    }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return cloneNormalized(EMPTY_NORMALIZED)
    }
    const o = parsed as Record<string, unknown>

    if (o.v === 2) {
      return parsePhysicalInvoiceFooterStoredJson(parsed)
    }

    const leg = o as PhysicalInvoiceFooterLegacyStored
    const builtinOverrides: Partial<Record<PhysicalInvoiceFooterBuiltinId, string>> = {}
    if (typeof leg.standard === 'string') builtinOverrides.standard = capFooter(leg.standard)
    if (typeof leg.alternate === 'string') builtinOverrides.alternate = capFooter(leg.alternate)
    if (Object.keys(builtinOverrides).length > 0) {
      persistLocalMirrorFromNormalized({
        builtinOverrides,
        builtinLabelOverrides: {},
        customPresets: [],
        defaultPresetId: null,
      })
    }
    return {
      builtinOverrides,
      builtinLabelOverrides: {},
      customPresets: [],
      defaultPresetId: null,
    }
  } catch {
    return cloneNormalized(EMPTY_NORMALIZED)
  }
}

/** Resolved storage: pinned session copy after fetch/save; otherwise local mirror (SSR-safe). */
function readNormalizedStorage(): NormalizedPhysicalInvoiceFooterStorage {
  if (sessionNormalized !== undefined) {
    return sessionNormalized
  }
  return readNormalizedFromLocalStorageOnly()
}

function buildPresetsFromNormalized(n: NormalizedPhysicalInvoiceFooterStorage): PhysicalInvoiceFooterPreset[] {
  const builtins: PhysicalInvoiceFooterPreset[] = BUILTIN_DEFS.map((b) => {
    const overrideLabel = n.builtinLabelOverrides[b.id]
    const labelRaw = (overrideLabel ?? b.label).trim()
    const label = labelRaw.length > 0 ? labelRaw : b.label
    return {
      id: b.id,
      label,
      body: capFooter(n.builtinOverrides[b.id] ?? b.shippedBody),
    }
  })
  const custom: PhysicalInvoiceFooterPreset[] = n.customPresets.map((p) => ({
    id: p.id,
    label: p.label.trim() || 'Untitled',
    body: capFooter(p.body),
  }))
  return [...builtins, ...custom]
}

function effectiveDefaultPresetId(n: NormalizedPhysicalInvoiceFooterStorage): string {
  const raw = n.defaultPresetId ?? 'standard'
  const customIds = new Set(n.customPresets.map((p) => p.id))
  if (raw === 'standard' || raw === 'alternate') return raw
  if (customIds.has(raw)) return raw
  return 'standard'
}

async function deletePhysicalInvoiceFooterPresetsFromAppSettings(): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.from('app_settings').delete().eq('key', APP_SETTINGS_KEY_PHYSICAL_INVOICE_FOOTER_PRESETS_V1),
    'delete_physical_invoice_footer_presets_app_settings',
  )
}

/** Persists org-wide JSON or deletes the row when presets match shipped defaults only. */
export async function upsertPhysicalInvoiceFooterPresetsToAppSettings(
  normalized: NormalizedPhysicalInvoiceFooterStorage,
): Promise<void> {
  const sparse = buildSparseV2OrNull(normalized)
  if (!sparse) {
    await deletePhysicalInvoiceFooterPresetsFromAppSettings()
    return
  }
  await withSupabaseRetry(
    async () =>
      supabase.from('app_settings').upsert(
        {
          key: APP_SETTINGS_KEY_PHYSICAL_INVOICE_FOOTER_PRESETS_V1,
          value_text: JSON.stringify(sparse),
        },
        { onConflict: 'key' },
      ),
    'upsert_physical_invoice_footer_presets_app_settings',
  )
}

/**
 * Loads org presets into session cache + local mirror.
 * Remote wins when a row exists; when no row, uses local mirror and optionally uploads from dev (Bank Payments badges pattern).
 */
export async function fetchPhysicalInvoiceFooterPresetsFromAppSettings(opts?: {
  authRole?: string | null
}): Promise<{ rowExists: boolean }> {
  try {
    const data = (await withSupabaseRetry(
      async () =>
        supabase
          .from('app_settings')
          .select('value_text')
          .eq('key', APP_SETTINGS_KEY_PHYSICAL_INVOICE_FOOTER_PRESETS_V1)
          .maybeSingle(),
      'fetch_physical_invoice_footer_presets_app_settings',
    )) as { value_text: string | null } | null

    if (data != null) {
      const text = data.value_text
      if (text != null && text.trim() !== '') {
        try {
          const parsed: unknown = JSON.parse(text)
          const next =
            parsed != null && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed as { v?: unknown }).v === 2
              ? parsePhysicalInvoiceFooterStoredJson(parsed)
              : cloneNormalized(EMPTY_NORMALIZED)
          applySessionCacheAndPersistLocalMirror(next)
        } catch {
          applySessionCacheAndPersistLocalMirror(cloneNormalized(EMPTY_NORMALIZED))
        }
      } else {
        applySessionCacheAndPersistLocalMirror(cloneNormalized(EMPTY_NORMALIZED))
      }
      return { rowExists: true }
    }

    const localOnly = readNormalizedFromLocalStorageOnly()
    applySessionCacheAndPersistLocalMirror(localOnly)
    if (opts?.authRole === 'dev' && normalizedHasPersistablePayload(localOnly)) {
      try {
        await upsertPhysicalInvoiceFooterPresetsToAppSettings(localOnly)
      } catch {
        /* RLS or network; keep local mirror only */
      }
    }
    return { rowExists: false }
  } catch {
    return { rowExists: false }
  }
}

/** All presets (builtins first, then custom) with resolved bodies for Bill Customer + Settings. */
export function listPhysicalInvoiceFooterPresets(): PhysicalInvoiceFooterPreset[] {
  const n = readNormalizedStorage()
  return buildPresetsFromNormalized(n)
}

export function getPhysicalInvoiceFooterDefaultOnOpen(): string {
  const n = readNormalizedStorage()
  const list = buildPresetsFromNormalized(n)
  const id = effectiveDefaultPresetId(n)
  const hit = list.find((p) => p.id === id)
  return hit?.body ?? list.find((p) => p.id === 'standard')?.body ?? list[0]?.body ?? ''
}

/** First matching preset id when footer text equals a preset body exactly. */
export function physicalInvoiceFooterActivePresetId(footer: string): string | null {
  for (const p of listPhysicalInvoiceFooterPresets()) {
    if (p.body === footer) return p.id
  }
  return null
}

export function physicalInvoiceFooterSummaryLine(footer: string): string {
  if (!footer.trim()) return 'None'
  const id = physicalInvoiceFooterActivePresetId(footer)
  if (id) {
    const p = listPhysicalInvoiceFooterPresets().find((x) => x.id === id)
    return p?.label ?? 'Preset'
  }
  return 'Custom'
}

/** Settings panel: builtin draft bodies + labels + custom rows + default id. */
export function getPhysicalInvoiceFooterSettingsDraft(): {
  standardBody: string
  alternateBody: string
  standardLabel: string
  alternateLabel: string
  customPresets: PhysicalInvoiceFooterCustomPreset[]
  defaultPresetId: string
} {
  const n = readNormalizedStorage()
  const standard = BUILTIN_DEFS.find((b) => b.id === 'standard')!
  const alternate = BUILTIN_DEFS.find((b) => b.id === 'alternate')!
  const stdLabel = n.builtinLabelOverrides.standard ?? standard.label
  const altLabel = n.builtinLabelOverrides.alternate ?? alternate.label
  return {
    standardBody: n.builtinOverrides.standard ?? standard.shippedBody,
    alternateBody: n.builtinOverrides.alternate ?? alternate.shippedBody,
    standardLabel: stdLabel,
    alternateLabel: altLabel,
    customPresets: n.customPresets.map((p) => ({ ...p })),
    defaultPresetId: effectiveDefaultPresetId(n),
  }
}

function computeNormalizedFromSaveOpts(opts: {
  standardBody: string
  alternateBody: string
  standardLabel: string
  alternateLabel: string
  customPresets: PhysicalInvoiceFooterCustomPreset[]
  defaultPresetId: string
}): NormalizedPhysicalInvoiceFooterStorage {
  const standard = capFooter(opts.standardBody)
  const alternate = capFooter(opts.alternateBody)
  const shippedStd = BUILTIN_DEFS.find((b) => b.id === 'standard')!.shippedBody
  const shippedAlt = BUILTIN_DEFS.find((b) => b.id === 'alternate')!.shippedBody
  const shippedStdLabel = BUILTIN_DEFS.find((b) => b.id === 'standard')!.label
  const shippedAltLabel = BUILTIN_DEFS.find((b) => b.id === 'alternate')!.label

  const builtinOverrides: Partial<Record<PhysicalInvoiceFooterBuiltinId, string>> = {}
  if (standard !== shippedStd) builtinOverrides.standard = standard
  if (alternate !== shippedAlt) builtinOverrides.alternate = alternate

  const stdL = capLabel(opts.standardLabel)
  const altL = capLabel(opts.alternateLabel)
  const builtinLabelOverrides: Partial<Record<PhysicalInvoiceFooterBuiltinId, string>> = {}
  if (stdL.length > 0 && stdL !== shippedStdLabel) builtinLabelOverrides.standard = stdL
  if (altL.length > 0 && altL !== shippedAltLabel) builtinLabelOverrides.alternate = altL

  const customPresets = opts.customPresets
    .map(normalizeCustomPreset)
    .filter((p) => p.label.length > 0 && p.body.trim().length > 0)
    .slice(0, PHYSICAL_INVOICE_FOOTER_CUSTOM_PRESET_MAX)

  const customIds = new Set(customPresets.map((p) => p.id))
  let defaultPresetId = opts.defaultPresetId.trim()
  if (defaultPresetId !== 'standard' && defaultPresetId !== 'alternate' && !customIds.has(defaultPresetId)) {
    defaultPresetId = 'standard'
  }
  const defaultToStore: string | null = defaultPresetId === 'standard' ? null : defaultPresetId

  return {
    builtinOverrides,
    builtinLabelOverrides,
    customPresets,
    defaultPresetId: defaultToStore,
  }
}

/** Saves organization-wide presets (dev Settings); updates session cache + local mirror after successful upsert/delete. */
export async function savePhysicalInvoiceFooterPresetsState(opts: {
  standardBody: string
  alternateBody: string
  standardLabel: string
  alternateLabel: string
  customPresets: PhysicalInvoiceFooterCustomPreset[]
  defaultPresetId: string
}): Promise<void> {
  const normalized = computeNormalizedFromSaveOpts(opts)
  await upsertPhysicalInvoiceFooterPresetsToAppSettings(normalized)
  applySessionCacheAndPersistLocalMirror(normalized)
}

/** Clears org presets + mirrors (built-in shipped defaults). */
export async function resetPhysicalInvoiceFooterPresetsToBuiltins(): Promise<void> {
  sessionNormalized = undefined
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LS_KEY_PHYSICAL_INVOICE_FOOTER_PRESETS)
    }
  } catch {
    /* ignore */
  }
  try {
    await deletePhysicalInvoiceFooterPresetsFromAppSettings()
  } catch {
    /* ignore */
  }
}

/** @deprecated Use listPhysicalInvoiceFooterPresets / getPhysicalInvoiceFooterDefaultOnOpen */
export function getPhysicalInvoiceFooterPresetStandard(): string {
  return listPhysicalInvoiceFooterPresets().find((p) => p.id === 'standard')?.body ?? PHYSICAL_INVOICE_FOOTER_PRESET_STANDARD
}

/** @deprecated Use listPhysicalInvoiceFooterPresets */
export function getPhysicalInvoiceFooterPresetAlternate(): string {
  return listPhysicalInvoiceFooterPresets().find((p) => p.id === 'alternate')?.body ?? PHYSICAL_INVOICE_FOOTER_PRESET_ALTERNATE
}

/** @deprecated Use physicalInvoiceFooterActivePresetId */
export function physicalInvoiceFooterActivePreset(footer: string): PhysicalInvoiceFooterBuiltinId | null {
  const id = physicalInvoiceFooterActivePresetId(footer)
  if (id === 'standard' || id === 'alternate') return id
  return null
}

/** @deprecated Use savePhysicalInvoiceFooterPresetsState */
export function savePhysicalInvoiceFooterPresetsFromForm(standardDraft: string, alternateDraft: string): void {
  const draft = getPhysicalInvoiceFooterSettingsDraft()
  void savePhysicalInvoiceFooterPresetsState({
    standardBody: standardDraft,
    alternateBody: alternateDraft,
    standardLabel: draft.standardLabel,
    alternateLabel: draft.alternateLabel,
    customPresets: draft.customPresets,
    defaultPresetId: draft.defaultPresetId,
  })
}

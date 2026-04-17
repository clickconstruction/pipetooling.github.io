import { normalizePhysicalInvoiceFooterPlainText } from './physicalInvoiceDocument'
import { STRIPE_INVOICE_FOOTER_MAX_CHARS } from './stripeInvoiceFooter'

/** Same cap as Stripe invoice footer / physical invoice footer (invoice description memo). */
export const BILL_CUSTOMER_MEMO_MAX_CHARS = STRIPE_INVOICE_FOOTER_MAX_CHARS

/** Max dev-added presets (localStorage) per browser. */
export const BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX = 20

export const BILL_CUSTOMER_MEMO_SHIPPED_LABEL_STANDARD = 'Standard'
export const BILL_CUSTOMER_MEMO_SHIPPED_LABEL_ALTERNATE = 'Alternate'

export const BILL_CUSTOMER_MEMO_LABEL_MAX_CHARS = 200

const LS_KEY_BILL_CUSTOMER_MEMO_PRESETS = 'pipetooling-bill-customer-memo-presets'

/** Shipped default bodies (repo); empty until customized in Settings. */
export const BILL_CUSTOMER_MEMO_PRESET_STANDARD = ''

export const BILL_CUSTOMER_MEMO_PRESET_ALTERNATE = ''

export type BillCustomerMemoBuiltinId = 'standard' | 'alternate'

export type BillCustomerMemoPreset = {
  id: string
  label: string
  body: string
}

export type BillCustomerMemoCustomPreset = {
  id: string
  label: string
  body: string
}

type BillCustomerMemoLsV2 = {
  v: 2
  builtinOverrides?: Partial<Record<BillCustomerMemoBuiltinId, string>>
  builtinLabelOverrides?: Partial<Record<BillCustomerMemoBuiltinId, string>>
  customPresets?: BillCustomerMemoCustomPreset[]
  defaultPresetId?: string
}

const BUILTIN_DEFS: Array<{
  id: BillCustomerMemoBuiltinId
  label: string
  shippedBody: string
}> = [
  { id: 'standard', label: BILL_CUSTOMER_MEMO_SHIPPED_LABEL_STANDARD, shippedBody: BILL_CUSTOMER_MEMO_PRESET_STANDARD },
  { id: 'alternate', label: BILL_CUSTOMER_MEMO_SHIPPED_LABEL_ALTERNATE, shippedBody: BILL_CUSTOMER_MEMO_PRESET_ALTERNATE },
]

type NormalizedBillCustomerMemoStorage = {
  builtinOverrides: Partial<Record<BillCustomerMemoBuiltinId, string>>
  builtinLabelOverrides: Partial<Record<BillCustomerMemoBuiltinId, string>>
  customPresets: BillCustomerMemoCustomPreset[]
  defaultPresetId: string | null
}

function capMemoBody(raw: string): string {
  return normalizePhysicalInvoiceFooterPlainText(raw).slice(0, BILL_CUSTOMER_MEMO_MAX_CHARS)
}

function capLabel(s: string): string {
  return s.trim().slice(0, BILL_CUSTOMER_MEMO_LABEL_MAX_CHARS)
}

function normalizeCustomPreset(p: BillCustomerMemoCustomPreset): BillCustomerMemoCustomPreset {
  return {
    id: p.id,
    label: p.label.trim(),
    body: capMemoBody(p.body),
  }
}

function parseBuiltinLabelOverrides(raw: unknown): Partial<Record<BillCustomerMemoBuiltinId, string>> {
  const out: Partial<Record<BillCustomerMemoBuiltinId, string>> = {}
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

function buildPresetsFromNormalized(n: NormalizedBillCustomerMemoStorage): BillCustomerMemoPreset[] {
  const builtins: BillCustomerMemoPreset[] = BUILTIN_DEFS.map((b) => {
    const overrideLabel = n.builtinLabelOverrides[b.id]
    const labelRaw = (overrideLabel ?? b.label).trim()
    const label = labelRaw.length > 0 ? labelRaw : b.label
    return {
      id: b.id,
      label,
      body: capMemoBody(n.builtinOverrides[b.id] ?? b.shippedBody),
    }
  })
  const custom: BillCustomerMemoPreset[] = n.customPresets.map((p) => ({
    id: p.id,
    label: p.label.trim() || 'Untitled',
    body: capMemoBody(p.body),
  }))
  return [...builtins, ...custom]
}

function readNormalizedStorage(): NormalizedBillCustomerMemoStorage {
  try {
    const raw = localStorage.getItem(LS_KEY_BILL_CUSTOMER_MEMO_PRESETS)
    if (!raw) {
      return {
        builtinOverrides: {},
        builtinLabelOverrides: {},
        customPresets: [],
        defaultPresetId: null,
      }
    }
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        builtinOverrides: {},
        builtinLabelOverrides: {},
        customPresets: [],
        defaultPresetId: null,
      }
    }
    const o = parsed as Record<string, unknown>
    if (o.v !== 2) {
      return {
        builtinOverrides: {},
        builtinLabelOverrides: {},
        customPresets: [],
        defaultPresetId: null,
      }
    }
    const v2 = o as BillCustomerMemoLsV2
    const builtinOverrides: Partial<Record<BillCustomerMemoBuiltinId, string>> = {}
    if (v2.builtinOverrides && typeof v2.builtinOverrides === 'object' && !Array.isArray(v2.builtinOverrides)) {
      const bo = v2.builtinOverrides as Record<string, unknown>
      if (typeof bo.standard === 'string') builtinOverrides.standard = capMemoBody(bo.standard)
      if (typeof bo.alternate === 'string') builtinOverrides.alternate = capMemoBody(bo.alternate)
    }
    const builtinLabelOverrides = parseBuiltinLabelOverrides(v2.builtinLabelOverrides)
    let customPresets: BillCustomerMemoCustomPreset[] = []
    if (Array.isArray(v2.customPresets)) {
      customPresets = v2.customPresets
        .filter(
          (row): row is BillCustomerMemoCustomPreset =>
            row != null &&
            typeof row === 'object' &&
            typeof (row as BillCustomerMemoCustomPreset).id === 'string' &&
            typeof (row as BillCustomerMemoCustomPreset).label === 'string' &&
            typeof (row as BillCustomerMemoCustomPreset).body === 'string',
        )
        .map(normalizeCustomPreset)
        .slice(0, BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX)
    }
    let defaultPresetId: string | null = null
    if (typeof v2.defaultPresetId === 'string' && v2.defaultPresetId.trim().length > 0) {
      const d = v2.defaultPresetId.trim()
      defaultPresetId = d === 'standard' ? null : d
    }
    return { builtinOverrides, builtinLabelOverrides, customPresets, defaultPresetId }
  } catch {
    return {
      builtinOverrides: {},
      builtinLabelOverrides: {},
      customPresets: [],
      defaultPresetId: null,
    }
  }
}

function persistV2(data: {
  builtinOverrides: Partial<Record<BillCustomerMemoBuiltinId, string>>
  builtinLabelOverrides: Partial<Record<BillCustomerMemoBuiltinId, string>>
  customPresets: BillCustomerMemoCustomPreset[]
  defaultPresetId: string | null
}): void {
  const hasBodyOv = Object.keys(data.builtinOverrides).length > 0
  const hasLabelOv = Object.keys(data.builtinLabelOverrides).length > 0
  const hasCustom = data.customPresets.length > 0
  const hasNonStandardDefault = data.defaultPresetId != null && data.defaultPresetId !== 'standard'

  if (!hasBodyOv && !hasLabelOv && !hasCustom && !hasNonStandardDefault) {
    localStorage.removeItem(LS_KEY_BILL_CUSTOMER_MEMO_PRESETS)
    return
  }

  const toWrite: BillCustomerMemoLsV2 = {
    v: 2,
    builtinOverrides: hasBodyOv ? data.builtinOverrides : undefined,
    builtinLabelOverrides: hasLabelOv ? data.builtinLabelOverrides : undefined,
    customPresets: hasCustom ? data.customPresets : undefined,
    defaultPresetId: hasNonStandardDefault ? data.defaultPresetId! : undefined,
  }
  localStorage.setItem(LS_KEY_BILL_CUSTOMER_MEMO_PRESETS, JSON.stringify(toWrite))
}

function effectiveDefaultPresetId(n: NormalizedBillCustomerMemoStorage): string {
  const raw = n.defaultPresetId ?? 'standard'
  const customIds = new Set(n.customPresets.map((p) => p.id))
  if (raw === 'standard' || raw === 'alternate') return raw
  if (customIds.has(raw)) return raw
  return 'standard'
}

export function listBillCustomerMemoPresets(): BillCustomerMemoPreset[] {
  const n = readNormalizedStorage()
  return buildPresetsFromNormalized(n)
}

export function getBillCustomerMemoDefaultOnOpen(): string {
  const n = readNormalizedStorage()
  const list = buildPresetsFromNormalized(n)
  const id = effectiveDefaultPresetId(n)
  const hit = list.find((p) => p.id === id)
  return hit?.body ?? list.find((p) => p.id === 'standard')?.body ?? list[0]?.body ?? ''
}

export function billCustomerMemoActivePresetId(memo: string): string | null {
  const normalizedMemo = capMemoBody(memo)
  for (const p of listBillCustomerMemoPresets()) {
    if (capMemoBody(p.body) === normalizedMemo) return p.id
  }
  return null
}

export function billCustomerMemoSummaryLine(memo: string): string {
  if (!memo.trim()) return 'None'
  const id = billCustomerMemoActivePresetId(memo)
  if (id) {
    const p = listBillCustomerMemoPresets().find((x) => x.id === id)
    return p?.label ?? 'Preset'
  }
  return 'Custom'
}

export function getBillCustomerMemoSettingsDraft(): {
  standardBody: string
  alternateBody: string
  standardLabel: string
  alternateLabel: string
  customPresets: BillCustomerMemoCustomPreset[]
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

export function saveBillCustomerMemoPresetsState(opts: {
  standardBody: string
  alternateBody: string
  standardLabel: string
  alternateLabel: string
  customPresets: BillCustomerMemoCustomPreset[]
  defaultPresetId: string
}): void {
  try {
    const standard = capMemoBody(opts.standardBody)
    const alternate = capMemoBody(opts.alternateBody)
    const shippedStd = capMemoBody(BUILTIN_DEFS.find((b) => b.id === 'standard')!.shippedBody)
    const shippedAlt = capMemoBody(BUILTIN_DEFS.find((b) => b.id === 'alternate')!.shippedBody)
    const shippedStdLabel = BUILTIN_DEFS.find((b) => b.id === 'standard')!.label
    const shippedAltLabel = BUILTIN_DEFS.find((b) => b.id === 'alternate')!.label

    const builtinOverrides: Partial<Record<BillCustomerMemoBuiltinId, string>> = {}
    if (standard !== shippedStd) builtinOverrides.standard = standard
    if (alternate !== shippedAlt) builtinOverrides.alternate = alternate

    const stdL = capLabel(opts.standardLabel)
    const altL = capLabel(opts.alternateLabel)
    const builtinLabelOverrides: Partial<Record<BillCustomerMemoBuiltinId, string>> = {}
    if (stdL.length > 0 && stdL !== shippedStdLabel) builtinLabelOverrides.standard = stdL
    if (altL.length > 0 && altL !== shippedAltLabel) builtinLabelOverrides.alternate = altL

    const customPresets = opts.customPresets
      .map(normalizeCustomPreset)
      .filter((p) => p.label.length > 0 && p.body.trim().length > 0)
      .slice(0, BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX)

    const customIds = new Set(customPresets.map((p) => p.id))
    let defaultPresetId = opts.defaultPresetId.trim()
    if (defaultPresetId !== 'standard' && defaultPresetId !== 'alternate' && !customIds.has(defaultPresetId)) {
      defaultPresetId = 'standard'
    }
    const defaultToStore: string | null = defaultPresetId === 'standard' ? null : defaultPresetId

    persistV2({
      builtinOverrides,
      builtinLabelOverrides,
      customPresets,
      defaultPresetId: defaultToStore,
    })
  } catch {
    /* private mode / quota */
  }
}

export function resetBillCustomerMemoPresetsToBuiltins(): void {
  try {
    localStorage.removeItem(LS_KEY_BILL_CUSTOMER_MEMO_PRESETS)
  } catch {
    /* ignore */
  }
}

import type { JobWithDetails } from '../types/jobWithDetails'
import type { LimitedJobDetailSnapshot } from '../types/limitedJobDetailSnapshot'
import type { PhysicalInvoiceIssuer } from './physicalInvoiceIssuer'
import { splitJobAddressForPrefill } from './txLocalityAddressSplit'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

/** Public URL path (Vite serves from `public/`). */
export const AIA_TEMPLATE_PUBLIC_PATH = '/templates/aia-g702-g703-mission-hills.xlsx'

export const AIA_G702_SHEET = 'Page 1 G702'
export const AIA_G703_SHEET = 'Continuation Sheet G703'

export type AiaFieldKind = 'text' | 'textarea' | 'number' | 'percent'

/** Collapsible `<details>` groups in the AIA G702/G703 modal (consecutive defs with the same id). */
export type AiaModalDetailsGroupId = 'change_orders'

export const AIA_MODAL_DETAILS_GROUP_SUMMARY: Record<AiaModalDetailsGroupId, string> = {
  change_orders: 'Change Orders',
}

export type AiaFieldKey =
  | 'g702_n5_project'
  | 'g702_n6_period_to'
  | 'g702_n7_project_no'
  | 'g702_n9_contract_date'
  | 'g702_d6_owner_name'
  | 'g702_d7_owner_address'
  | 'g702_d8_owner_city_state_zip'
  | 'g702_d10_contractor_name'
  | 'g702_d11_contractor_address'
  | 'g702_d12_contractor_license'
  | 'g702_h18_original_contract_sum'
  | 'g702_f49_previous_month_change_order_additions'
  | 'g702_h49_previous_month_change_order_deductions'
  | 'g702_f50_this_month_change_order_additions'
  | 'g702_h50_this_month_change_order_deductions'
  | 'g702_c28_retainage_percent'
  | 'g702_c31_retainage_material_percent'
  | 'g703_k2_project'
  | 'g703_k3_application_date'
  | 'g703_k4_period_to'
  | 'g703_k5_architect_project_no'
  | 'g703_c13_description'
  | 'g703_d13_scheduled_value'
  | 'g703_f13_this_period'
  | 'g703_g13_materials_stored'

export type AiaFieldDef = {
  key: AiaFieldKey
  label: string
  kind: AiaFieldKind
  sheetName: string
  cellRef: string
  detailsGroupId?: AiaModalDetailsGroupId
}

/** Ordered form fields and their Excel targets (Mission Hills G702/G703 template). */
export const AIA_FIELD_DEFS: readonly AiaFieldDef[] = [
  { key: 'g702_n5_project', label: 'APPLICATION NUMBER:', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'N5' },
  { key: 'g702_n6_period_to', label: 'Period to (G702)', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'N6' },
  { key: 'g702_n7_project_no', label: 'PROJECT NO:', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'N7' },
  { key: 'g702_n9_contract_date', label: 'CONTRACT DATE', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'N9' },
  { key: 'g702_d6_owner_name', label: 'OWNER NAME', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'D6' },
  { key: 'g702_d7_owner_address', label: 'OWNER STREET ADDRESS', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'D7' },
  { key: 'g702_d8_owner_city_state_zip', label: 'OWNER CITY, STATE, ZIP', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'D8' },
  { key: 'g702_d10_contractor_name', label: 'CONTRACTOR NAME', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'D10' },
  { key: 'g702_d11_contractor_address', label: 'CONTRACTOR ADDRESS', kind: 'textarea', sheetName: AIA_G702_SHEET, cellRef: 'D11' },
  { key: 'g702_d12_contractor_license', label: 'CONTRACTOR LICENSE LINE', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'D12' },
  {
    key: 'g702_h18_original_contract_sum',
    label: 'ORIGINAL CONTRACT SUM',
    kind: 'number',
    sheetName: AIA_G702_SHEET,
    cellRef: 'H18',
  },
  {
    key: 'g702_f49_previous_month_change_order_additions',
    label: 'Previous Month Change Order Additions',
    kind: 'number',
    sheetName: AIA_G702_SHEET,
    cellRef: 'F49',
    detailsGroupId: 'change_orders',
  },
  {
    key: 'g702_h49_previous_month_change_order_deductions',
    label: 'Previous Month Change Order Deductions',
    kind: 'number',
    sheetName: AIA_G702_SHEET,
    cellRef: 'H49',
    detailsGroupId: 'change_orders',
  },
  {
    key: 'g702_f50_this_month_change_order_additions',
    label: 'This Month Change Order Additions',
    kind: 'number',
    sheetName: AIA_G702_SHEET,
    cellRef: 'F50',
    detailsGroupId: 'change_orders',
  },
  {
    key: 'g702_h50_this_month_change_order_deductions',
    label: 'This Month Change Order Deductions',
    kind: 'number',
    sheetName: AIA_G702_SHEET,
    cellRef: 'H50',
    detailsGroupId: 'change_orders',
  },
  {
    key: 'g702_c28_retainage_percent',
    label: 'Retainage %',
    kind: 'percent',
    sheetName: AIA_G702_SHEET,
    cellRef: 'C28',
  },
  {
    key: 'g702_c31_retainage_material_percent',
    label: 'Retainage of Material %',
    kind: 'percent',
    sheetName: AIA_G702_SHEET,
    cellRef: 'C31',
  },
  { key: 'g703_k2_project', label: 'APPLICATION NUMBER', kind: 'text', sheetName: AIA_G703_SHEET, cellRef: 'K2' },
  { key: 'g703_k3_application_date', label: 'APPLICATION DATE', kind: 'text', sheetName: AIA_G703_SHEET, cellRef: 'K3' },
  { key: 'g703_k4_period_to', label: 'PERIOD TO:', kind: 'text', sheetName: AIA_G703_SHEET, cellRef: 'K4' },
  { key: 'g703_k5_architect_project_no', label: "ARCHITECT'S PROJECT NO:", kind: 'text', sheetName: AIA_G703_SHEET, cellRef: 'K5' },
  { key: 'g703_c13_description', label: 'DESCRIPTION OF WORK', kind: 'textarea', sheetName: AIA_G703_SHEET, cellRef: 'C13' },
  {
    key: 'g703_d13_scheduled_value',
    label: 'SCHEDULED VALUE',
    kind: 'number',
    sheetName: AIA_G703_SHEET,
    cellRef: 'D13',
  },
  {
    key: 'g703_f13_this_period',
    label: 'WORK COMPLETED THIS PERIOD',
    kind: 'number',
    sheetName: AIA_G703_SHEET,
    cellRef: 'F13',
  },
  {
    key: 'g703_g13_materials_stored',
    label: 'MATERIALS STORED ON SITE',
    kind: 'number',
    sheetName: AIA_G703_SHEET,
    cellRef: 'G13',
  },
]

/**
 * G703 header cells that mirror G702 (or `today()` on K3). If the user leaves the matching form
 * field empty, the template keeps a formula; ExcelJS can serialize `<v>NaN</v>` on save. After
 * filling mapped fields, `fillAiaG702G703Workbook` materializes any cell here that still has
 * a formula by copying the source value.
 */
export type AiaG703MirrorKind = 'g702_cell' | 'self_formula_result'

export type AiaG703MirrorDef =
  | { destRef: string; kind: 'g702_cell'; sourceRef: string }
  | { destRef: string; kind: 'self_formula_result' }

export const AIA_G703_G702_MIRROR_CELLS: readonly AiaG703MirrorDef[] = [
  { destRef: 'K2', kind: 'g702_cell', sourceRef: 'N5' },
  { destRef: 'K3', kind: 'self_formula_result' },
  { destRef: 'K4', kind: 'g702_cell', sourceRef: 'N6' },
  { destRef: 'K5', kind: 'g702_cell', sourceRef: 'N7' },
]

/** G703 cells that ship with formulas in the template; if still a formula after fill, replace with cached value to avoid bad OOXML on write. */
export const AIA_G703_MATERIALIZE_IF_FORMULA_REFS: readonly string[] = ['G13']

export type AiaFieldValues = Partial<Record<AiaFieldKey, string | number>>

function formatLongDateInAppTz(isoUtc: string | null | undefined): string {
  if (!isoUtc?.trim()) return ''
  const d = new Date(isoUtc)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d)
}

function formatLongDateFromYmd(ymd: string | null | undefined): string {
  if (!ymd?.trim()) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d)
}

function issuerAddressOneLine(issuer: PhysicalInvoiceIssuer): string {
  const lines = (issuer.addressText ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return lines.join(', ')
}

function firstFixtureDescription(job: JobWithDetails): string {
  const fx = (job.fixtures ?? []).filter((f) => (f.name ?? '').trim())
  if (fx.length === 0) return ''
  const parts = fx.slice(0, 3).map((f) => `${(f.name ?? '').trim()} × ${Number(f.count ?? 0)}`)
  const more = fx.length > 3 ? ` (+${fx.length - 3} more)` : ''
  return parts.join('; ') + more
}

/** Prefill AIA fields from job + optional physical-invoice issuer (contractor block). */
export function buildAiaPrefillFromJob(
  job: JobWithDetails | LimitedJobDetailSnapshot,
  issuer: PhysicalInvoiceIssuer | null,
): AiaFieldValues {
  const jobName = (job.job_name ?? '').trim()
  const customer = ('customer_name' in job ? job.customer_name : null) ?? ''
  const addr = splitJobAddressForPrefill((job.job_address ?? '').trim())
  const streetLine = addr.street
  const cityStZip = [addr.city, [addr.state, addr.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ').trim()

  const revenue = 'revenue' in job && job.revenue != null ? Number(job.revenue) : NaN
  const hcp = (job.hcp_number ?? '').trim()

  let contractDateStr = ''
  if ('created_at' in job && job.created_at) {
    contractDateStr = formatLongDateInAppTz(job.created_at)
  }

  const applicationDateStr = formatLongDateFromYmd(new Date().toISOString().slice(0, 10))

  const contractorName = issuer?.companyName?.trim() ?? ''
  const contractorAddr = issuer ? issuerAddressOneLine(issuer) : ''
  const contractorLicense = issuer?.licenseLine?.trim() ?? ''

  const fixtureDesc = 'fixtures' in job ? firstFixtureDescription(job as JobWithDetails) : ''

  const out: AiaFieldValues = {
    g702_n5_project: jobName,
    g702_n6_period_to: '',
    g702_n7_project_no: hcp,
    g702_n9_contract_date: contractDateStr,
    g702_d6_owner_name: (customer ?? '').trim(),
    g702_d7_owner_address: streetLine,
    g702_d8_owner_city_state_zip: cityStZip,
    g702_d10_contractor_name: contractorName,
    g702_d11_contractor_address: contractorAddr,
    g702_d12_contractor_license: contractorLicense,
    g703_k2_project: jobName,
    g703_k3_application_date: applicationDateStr,
    g703_k4_period_to: '',
    g703_k5_architect_project_no: hcp,
  }

  if (!Number.isNaN(revenue) && revenue > 0) {
    out.g702_h18_original_contract_sum = revenue
    out.g703_d13_scheduled_value = revenue
  }

  // Jobs Stages "Value Created": revenue × (pct_complete / 100)
  if ('pct_complete' in job && job.pct_complete != null && !Number.isNaN(revenue) && revenue > 0) {
    const valueCreated = revenue * (Number(job.pct_complete) / 100)
    if (Number.isFinite(valueCreated) && valueCreated > 0) {
      out.g703_f13_this_period = valueCreated
    }
  }

  if (fixtureDesc) {
    out.g703_c13_description = fixtureDesc
  }

  return out
}

export function aiaDownloadFilename(hcpOrFallback: string): string {
  const safe = (hcpOrFallback || 'job').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'job'
  const ymd = new Date().toISOString().slice(0, 10)
  return `AIA-G702-G703-${safe}-${ymd}.xlsx`
}

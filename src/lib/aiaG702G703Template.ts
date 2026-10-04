import type { JobWithDetails } from '../types/jobWithDetails'
import type { LimitedJobDetailSnapshot } from '../types/limitedJobDetailSnapshot'
import type { PhysicalInvoiceIssuer } from './physicalInvoiceIssuer'
import { splitJobAddressForPrefill } from './txLocalityAddressSplit'
import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../utils/dateUtils'

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
  | 'g702_h6_project_name'
  | 'g702_h7_project_address'
  | 'g702_h8_project_city_state_zip'
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
  { key: 'g702_h6_project_name', label: 'PROJECT NAME', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'H6' },
  { key: 'g702_h7_project_address', label: 'PROJECT STREET ADDRESS', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'H7' },
  { key: 'g702_h8_project_city_state_zip', label: 'PROJECT CITY, STATE, ZIP', kind: 'text', sheetName: AIA_G702_SHEET, cellRef: 'H8' },
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

/** The owner, 2026-10-04: retainage "is usually 10%". The form starts there and the person changes it. */
export const AIA_DEFAULT_RETAINAGE_PERCENT = 10

/** A calendar day as the paper prints it: `2026-10-04` → `10/04/2026`. Anything else → ''. */
export function formatAiaDate(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((ymd ?? '').trim())
  return m ? `${m[2]}/${m[3]}/${m[1]}` : ''
}

/** What the window reads beside the job row: the party the bills go to, and the job's signed contract. */
export type AiaPrefillFacts = {
  /** The payer's name and mailing address from its customers row. Empty strings when unknown. */
  ownerName: string
  ownerAddress: string
  /** The day the contract was signed, `YYYY-MM-DD`, or '' when the job has none. */
  contractSignedOn: string
}

type ContractDayRow = { status?: string | null; voided_at?: string | null; signed_at?: string | null; paper_signed_on?: string | null }

/**
 * The contract date for the form: the earliest day a live signed contract on the job was signed.
 * A paper's own date wins over the moment it was recorded.
 */
export function aiaContractSignedOn(rows: ReadonlyArray<ContractDayRow>): string {
  const days = rows
    .filter((r) => r.status === 'signed' && r.voided_at == null)
    .map((r) => (r.paper_signed_on ?? '').slice(0, 10) || (r.signed_at ? calendarYmdInAppTzFromIso(r.signed_at) : ''))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
  return days[0] ?? ''
}

/** City, state and zip on one line, as the owner and project blocks print them. */
function cityStateZip(addr: { city: string; state: string; zip: string }): string {
  return [addr.city, [addr.state, addr.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ').trim()
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

/**
 * Prefill the form from the job, our company (the contractor block) and the facts read beside it.
 *
 * The owner block is the party the bills go to: the GC on a job that bills its GC, else the
 * customer, with that party's own mailing address. The job's name and address are the project.
 * The application number is left for the person to type: the app keeps no count of them yet.
 */
export function buildAiaPrefillFromJob(
  job: JobWithDetails | LimitedJobDetailSnapshot,
  issuer: PhysicalInvoiceIssuer | null,
  facts?: AiaPrefillFacts | null,
): AiaFieldValues {
  const jobName = (job.job_name ?? '').trim()
  const project = splitJobAddressForPrefill((job.job_address ?? '').trim())

  const gcName = ('gcCustomer' in job ? job.gcCustomer?.name : 'gc_customer_name' in job ? job.gc_customer_name : null) ?? ''
  const customerName = ('customer_name' in job ? job.customer_name : null) ?? ''
  const ownerName = (facts?.ownerName ?? '').trim() || gcName.trim() || customerName.trim()
  const owner = splitJobAddressForPrefill((facts?.ownerAddress ?? '').trim())

  const revenue = 'revenue' in job && job.revenue != null ? Number(job.revenue) : NaN
  const jobNumber = effectiveJobLedgerNumber(job.hcp_number, 'click_number' in job ? job.click_number : null)

  const contractorName = issuer?.companyName?.trim() ?? ''
  const contractorAddr = issuer ? issuerAddressOneLine(issuer) : ''
  const contractorLicense = issuer?.licenseLine?.trim() ?? ''

  const fixtureDesc = 'fixtures' in job ? firstFixtureDescription(job as JobWithDetails) : ''

  const out: AiaFieldValues = {
    g702_n5_project: '',
    g702_n6_period_to: '',
    g702_n7_project_no: jobNumber,
    g702_n9_contract_date: formatAiaDate(facts?.contractSignedOn),
    g702_h6_project_name: jobName,
    g702_h7_project_address: project.street,
    g702_h8_project_city_state_zip: cityStateZip(project),
    g702_d6_owner_name: ownerName,
    g702_d7_owner_address: owner.street,
    g702_d8_owner_city_state_zip: cityStateZip(owner),
    g702_d10_contractor_name: contractorName,
    g702_d11_contractor_address: contractorAddr,
    g702_d12_contractor_license: contractorLicense,
    g702_c28_retainage_percent: AIA_DEFAULT_RETAINAGE_PERCENT,
    g703_k2_project: '',
    g703_k3_application_date: formatAiaDate(todayYmdInAppTz()),
    g703_k4_period_to: '',
    g703_k5_architect_project_no: jobNumber,
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

/** The file's name: the job's number, the application number when it is one, and the day. */
export function aiaDownloadFilename(jobNumberOrFallback: string, applicationNumber?: string | number | null): string {
  const safe = (jobNumberOrFallback || 'job').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'job'
  const app = String(applicationNumber ?? '').trim()
  const appPart = /^\d{1,4}$/.test(app) ? `-app-${app}` : ''
  const ymd = new Date().toISOString().slice(0, 10) // tz-ok: filename stamp
  return `AIA-G702-G703-${safe}${appPart}-${ymd}.xlsx`
}

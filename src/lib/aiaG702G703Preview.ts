import { AIA_FIELD_DEFS, type AiaFieldKey, type AiaFieldValues } from './aiaG702G703Template'

/**
 * What the downloaded workbook will say, worked out without opening it. The AIA window's paper
 * preview reads this, and `fillAiaG702G703Workbook` stamps the same numbers into the workbook's
 * formula cells so a viewer that does not recalculate shows them too. A box the form leaves
 * empty is empty in the download: nothing of the bundled template's own job carries over.
 */

/** `typed` = from the form · `blank` = the form left it empty. */
export type AiaPreviewSource = 'typed' | 'blank'

export type AiaPreviewCell = { text: string; source: AiaPreviewSource }

/** A G703 header box that is a formula onto a G702 box. */
const G703_FOLLOWS_G702: Readonly<Partial<Record<AiaFieldKey, AiaFieldKey>>> = {
  g703_k2_project: 'g702_n5_project',
  g703_k4_period_to: 'g702_n6_period_to',
  g703_k5_architect_project_no: 'g702_n7_project_no',
}

export type AiaPreviewMath = {
  /** G703 line 001, the one line the form fills. */
  line: {
    scheduledValue: number
    fromPrevious: number
    thisPeriod: number
    materialsStored: number
    totalToDate: number
    /** null when the scheduled value is 0 (the sheet shows #DIV/0!). */
    pctComplete: number | null
    balanceToFinish: number
    retainage: number
  }
  changeOrders: { additions: number; deductions: number; net: number }
  /** G702 lines 1–9. */
  originalContractSum: number
  netChangeByChangeOrders: number
  contractSumToDate: number
  totalCompletedAndStored: number
  retainageOfCompletedWork: number
  retainageOfStoredMaterial: number
  totalRetainage: number
  totalEarnedLessRetainage: number
  lessPreviousCertificates: number
  currentPaymentDue: number
  balanceToFinish: number
}

export type AiaPreview = {
  cells: Record<AiaFieldKey, AiaPreviewCell>
  math: AiaPreviewMath
}

const KIND_BY_KEY = Object.fromEntries(AIA_FIELD_DEFS.map((d) => [d.key, d.kind])) as Record<AiaFieldKey, string>

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/** The workbook's money format: `$1,234.50`, a negative in parentheses. */
export function formatAiaMoney(n: number): string {
  const abs = Math.abs(round2(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 && round2(n) !== 0 ? `($${abs})` : `$${abs}`
}

/** The workbook's `0%` format. */
export function formatAiaPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

function typedValue(values: AiaFieldValues, key: AiaFieldKey): string | number | undefined {
  const raw = values[key]
  if (raw === undefined || raw === '') return undefined
  if (KIND_BY_KEY[key] === 'number' || KIND_BY_KEY[key] === 'percent') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
    return Number.isFinite(n) ? n : undefined
  }
  return String(raw)
}

type Resolved = { value: string | number; source: AiaPreviewSource }

function resolve(values: AiaFieldValues, key: AiaFieldKey): Resolved {
  const typed = typedValue(values, key)
  if (typed !== undefined) return { value: typed, source: 'typed' }
  const follows = G703_FOLLOWS_G702[key]
  if (follows) return resolve(values, follows)
  return { value: '', source: 'blank' }
}

function cellText(key: AiaFieldKey, value: string | number): string {
  if (typeof value !== 'number') return value
  return KIND_BY_KEY[key] === 'percent' ? formatAiaPercent(value / 100) : formatAiaMoney(value)
}

/** The paper as the download will read: every mapped box, and the sheet's own math over them. */
export function buildAiaPreview(values: AiaFieldValues): AiaPreview {
  const cells = {} as Record<AiaFieldKey, AiaPreviewCell>
  const num = {} as Record<AiaFieldKey, number>
  for (const def of AIA_FIELD_DEFS) {
    const r = resolve(values, def.key)
    cells[def.key] = { text: cellText(def.key, r.value), source: r.source }
    num[def.key] = typeof r.value === 'number' ? r.value : 0
  }

  const retainagePct = num.g702_c28_retainage_percent / 100
  const materialPct = num.g702_c31_retainage_material_percent / 100

  // G703 row 13: H = E + F + G, I = H / D, J = D − H, K = H × G702!C28. Row 49 sums a column;
  // every other row is 0, so the totals are this row.
  const scheduledValue = num.g703_d13_scheduled_value
  const fromPrevious = num.g703_e13_from_previous
  const thisPeriod = num.g703_f13_this_period
  const materialsStored = num.g703_g13_materials_stored
  const totalToDate = fromPrevious + thisPeriod + materialsStored
  const lineRetainage = totalToDate * retainagePct

  // G702 rows 49–52.
  const additions =
    num.g702_f49_previous_month_change_order_additions + num.g702_f50_this_month_change_order_additions
  const deductions =
    num.g702_h49_previous_month_change_order_deductions + num.g702_h50_this_month_change_order_deductions
  const net = additions - deductions

  // G702 lines 1–9: H22 = H18 + H20 · H24 = G703!H49 · F31 = G703!G49 × C31 · F28 = G703!K49 − F31 ·
  // H34 = F28 + F31 · H36 = H24 − H34 · H42 = H36 − H40 · F45 = H22 − H36.
  const originalContractSum = num.g702_h18_original_contract_sum
  const contractSumToDate = originalContractSum + net
  const retainageOfStoredMaterial = materialsStored * materialPct
  const retainageOfCompletedWork = lineRetainage - retainageOfStoredMaterial
  const totalRetainage = retainageOfCompletedWork + retainageOfStoredMaterial
  const totalEarnedLessRetainage = totalToDate - totalRetainage
  const lessPreviousCertificates = num.g702_h40_less_previous_certificates

  return {
    cells,
    math: {
      line: {
        scheduledValue,
        fromPrevious: round2(fromPrevious),
        thisPeriod,
        materialsStored,
        totalToDate: round2(totalToDate),
        pctComplete: scheduledValue === 0 ? null : totalToDate / scheduledValue,
        balanceToFinish: round2(scheduledValue - totalToDate),
        retainage: round2(lineRetainage),
      },
      changeOrders: { additions: round2(additions), deductions: round2(deductions), net: round2(net) },
      originalContractSum,
      netChangeByChangeOrders: round2(net),
      contractSumToDate: round2(contractSumToDate),
      totalCompletedAndStored: round2(totalToDate),
      retainageOfCompletedWork: round2(retainageOfCompletedWork),
      retainageOfStoredMaterial: round2(retainageOfStoredMaterial),
      totalRetainage: round2(totalRetainage),
      totalEarnedLessRetainage: round2(totalEarnedLessRetainage),
      lessPreviousCertificates: round2(lessPreviousCertificates),
      currentPaymentDue: round2(totalEarnedLessRetainage - lessPreviousCertificates),
      balanceToFinish: round2(contractSumToDate - totalEarnedLessRetainage),
    },
  }
}

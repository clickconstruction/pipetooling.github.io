/**
 * Supply house bill lines, the reads behind What we buy (punch list #298 PR 4a, v2.7114). Every count reads the view
 * `supply_purchase_lines` and never the tables, so a quote or a paper whose sums are off is never counted. Each read
 * is paged: a read with no range stops at 1,000 rows and says nothing, and a year of bills is several thousand lines.
 * A read that fails throws, so the page shows its reason and never half the purchases. A ZZ test house's lines are
 * left out. One interface, so a smoke hands the page a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../../supabasePaging'
import { isZzTestName } from '../../jobs/zzTestJobSweep'
import type { PricingUnit } from './paperChecks'
import type { CodeTeach, PurchaseLine } from './whatWeBuy'

/** One bill's share on a job, from `supply_house_invoice_job_allocations`. */
export interface BillShare {
  invoiceId: string
  jobId: string
  /** 0 to 100. */
  pct: number
}

export interface PurchaseData {
  lines: PurchaseLine[]
  teaches: CodeTeach[]
  partNames: Map<string, string>
  houseNames: Map<string, string>
  shares: BillShare[]
  /** The jobs that carry a counted bill, by id: *JP1042 Oak Hollow C*. */
  jobNames: Map<string, string>
}

export interface PurchaseLinesIo {
  /** Rejects with the database's error when a read fails. */
  load(): Promise<PurchaseData>
}

type LineDb = {
  id: string
  invoice_id: string
  supply_house_id: string | null
  dated_on: string | null
  line_kind: string
  house_code: string | null
  description: string | null
  unit: string | null
  pricing_unit: string | null
  unit_price: number | string | null
  part_id: string | null
  quantity: number | string | null
  extended_cents: number | null
}

const num = (v: number | string | null): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

async function appClient(): Promise<SupabaseClient<Database>> {
  return (await import('../../supabase')).supabase
}

/** A job as the pickers name it: its number, then its name. */
export function jobWords(job: { hcp_number?: string | null; click_number?: string | null; job_name?: string | null }): string {
  return [(job.click_number ?? '').trim() || (job.hcp_number ?? '').trim(), (job.job_name ?? '').trim()].filter(Boolean).join(' ') || 'A job with no name'
}

export function supabasePurchaseLinesIo(given?: SupabaseClient<Database>): PurchaseLinesIo {
  return {
    async load() {
      const client = (given ?? (await appClient())) as unknown as SupabaseClient
      const [lineRows, teachRows, houseRows, shareRows] = await Promise.all([
        fetchAllRows<LineDb>(
          (from, to) => client.from('supply_purchase_lines').select('id, invoice_id, supply_house_id, dated_on, line_kind, house_code, description, unit, pricing_unit, unit_price, part_id, quantity, extended_cents').order('id').range(from, to),
          'the lines of the supply house bills',
        ),
        fetchAllRows<{ supply_house_id: string; code_key: string; part_id: string | null; not_a_part: boolean }>((from, to) => client.from('supply_part_codes').select('supply_house_id, code_key, part_id, not_a_part').order('id').range(from, to), 'the houses’ numbers for parts'),
        fetchAllRows<{ id: string; name: string | null }>((from, to) => client.from('supply_houses').select('id, name').order('id').range(from, to), 'the supply houses'),
        fetchAllRows<{ invoice_id: string; job_id: string; pct: number | string }>((from, to) => client.from('supply_house_invoice_job_allocations').select('invoice_id, job_id, pct').order('invoice_id').order('job_id').range(from, to), 'the bills’ jobs'),
      ])
      const zzHouses = new Set(houseRows.filter((h) => isZzTestName(h.name)).map((h) => h.id))
      const lines: PurchaseLine[] = lineRows
        .filter((r) => !(r.supply_house_id && zzHouses.has(r.supply_house_id)))
        .map((r) => ({
          id: r.id,
          invoiceId: r.invoice_id,
          houseId: r.supply_house_id,
          datedOn: r.dated_on,
          lineKind: r.line_kind === 'charge' ? 'charge' : 'part',
          houseCode: r.house_code ?? '',
          description: r.description ?? '',
          unit: r.unit ?? '',
          pricingUnit: (r.pricing_unit === 'per_hundred' || r.pricing_unit === 'per_thousand' ? r.pricing_unit : 'each') as PricingUnit,
          unitPrice: num(r.unit_price),
          partId: r.part_id,
          quantity: num(r.quantity),
          extendedCents: r.extended_cents,
        }))
      const teaches: CodeTeach[] = teachRows.map((t) => ({ houseId: t.supply_house_id, codeKey: t.code_key, partId: t.part_id, notAPart: t.not_a_part }))
      const counted = new Set(lines.map((l) => l.invoiceId))
      const shares: BillShare[] = shareRows.filter((s) => counted.has(s.invoice_id)).map((s) => ({ invoiceId: s.invoice_id, jobId: s.job_id, pct: Number(s.pct) || 0 }))

      const partIds = [...new Set([...lines.map((l) => l.partId), ...teaches.map((t) => t.partId)].filter((id): id is string => !!id))]
      const jobIds = [...new Set(shares.map((s) => s.jobId))]
      const [partRows, jobRows] = await Promise.all([
        fetchAllRowsChunkedIn<{ id: string; name: string | null }, string>(partIds, (chunk, from, to) => client.from('material_parts').select('id, name').in('id', chunk).order('id').range(from, to), 'the parts book’s names', { parallel: 4 }),
        fetchAllRowsChunkedIn<{ id: string; hcp_number: string | null; click_number: string | null; job_name: string | null }, string>(
          jobIds,
          (chunk, from, to) => client.from('jobs_ledger').select('id, hcp_number, click_number, job_name').in('id', chunk).order('id').range(from, to),
          'the jobs on the bills',
          { parallel: 4 },
        ),
      ])
      return {
        lines,
        teaches,
        partNames: new Map(partRows.map((p) => [p.id, (p.name ?? '').trim()])),
        houseNames: new Map(houseRows.filter((h) => !zzHouses.has(h.id)).map((h) => [h.id, (h.name ?? '').trim()])),
        shares,
        jobNames: new Map(jobRows.map((j) => [j.id, jobWords(j)])),
      }
    },
  }
}

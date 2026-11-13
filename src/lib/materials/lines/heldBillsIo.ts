/**
 * Supply house bill lines, the reads behind the list of bills that need a person (punch list #298 PR 3, v2.7110).
 * Four reads under the office's SELECT policies: every bill's row, the papers that belong to a bill, the sweep's
 * holds and the houses' names. Each is paged, since a read with no range stops at 1,000 rows and says nothing. A
 * read that fails throws, so the window shows its reason and never a short list. One interface, so a smoke hands the
 * window a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
import { fetchAllRows } from '../../supabasePaging'
import type { HoldWhy } from './billSweep'
import type { HeldHold, HeldInvoice, HeldPaper } from './heldBills'

export interface HeldBillsData {
  invoices: HeldInvoice[]
  papers: HeldPaper[]
  holds: HeldHold[]
  houseNames: Map<string, string>
}

export interface HeldBillsIo {
  /** Rejects with the database's error when any of the four reads fails. */
  load(): Promise<HeldBillsData>
}

type InvoiceDb = { id: string; supply_house_id: string | null; invoice_number: string | null; invoice_date: string | null; amount: number | string | null; link: string | null }
type PaperDb = { id: string; invoice_id: string; check_state: HeldPaper['checkState']; check_note: string | null }
type HoldDb = { invoice_id: string; why: HoldWhy; note: string | null }
type HouseDb = { id: string; name: string | null }

async function appClient(): Promise<SupabaseClient<Database>> {
  return (await import('../../supabase')).supabase
}

export function supabaseHeldBillsIo(given?: SupabaseClient<Database>): HeldBillsIo {
  return {
    async load() {
      const client = (given ?? (await appClient())) as unknown as SupabaseClient
      const [invoices, papers, holds, houses] = await Promise.all([
        fetchAllRows<InvoiceDb>((from, to) => client.from('supply_house_invoices').select('id, supply_house_id, invoice_number, invoice_date, amount, link').order('id').range(from, to), 'the supply house bills'),
        fetchAllRows<PaperDb>((from, to) => client.from('supply_papers').select('id, invoice_id, check_state, check_note').not('invoice_id', 'is', null).order('id').range(from, to), 'the bills’ papers'),
        fetchAllRows<HoldDb>((from, to) => client.from('supply_bill_holds').select('invoice_id, why, note').order('invoice_id').range(from, to), 'the bills the reader holds'),
        fetchAllRows<HouseDb>((from, to) => client.from('supply_houses').select('id, name').order('id').range(from, to), 'the supply houses'),
      ])
      return {
        invoices: invoices.map((r) => ({ id: r.id, supplyHouseId: r.supply_house_id, number: r.invoice_number ?? '', dateYmd: r.invoice_date ?? '', amountCents: Math.round(Math.abs(Number(r.amount ?? 0)) * 100), link: r.link })),
        papers: papers.map((p) => ({ id: p.id, invoiceId: p.invoice_id, checkState: p.check_state, checkNote: p.check_note ?? '' })),
        holds: holds.map((h) => ({ invoiceId: h.invoice_id, why: h.why, note: h.note ?? '' })),
        houseNames: new Map(houses.map((h) => [h.id, (h.name ?? '').trim()])),
      }
    },
  }
}

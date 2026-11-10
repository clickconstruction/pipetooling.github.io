/**
 * Supply house bill lines, the reads and writes behind the bill's row and the Look window (punch list #298 PR 1b,
 * v2.6819). The office reads `supply_papers` and `supply_paper_lines` under their SELECT policies and writes through
 * the two RPCs of 20261109210000, so a person's press goes through the gates a definer must say itself. One
 * interface, so a smoke hands the tab a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
import { formatErrorMessage } from '../../../utils/errorHandling'
import type { PaperLine } from './paperChecks'
import type { LineSave, PaperRow, PaperSave } from './paperRows'

export interface PaperIo {
  /** The papers on these bills, with their lines, by invoice id. Fail-soft: a read that fails is an empty map. */
  loadForInvoices(invoiceIds: readonly string[]): Promise<Map<string, PaperRow>>
  /** The paper and its lines for a bill, written whole. Resolves to the paper's id, or rejects in words. */
  save(invoiceId: string, paper: PaperSave, lines: readonly LineSave[]): Promise<string>
  /** Count it as read anyway. Rejects in words. */
  accept(paperId: string, note: string): Promise<void>
  /** Who accepted, by user id, for the row's words. Fail-soft. */
  namesOf(userIds: readonly string[]): Promise<Map<string, string>>
}

type PaperDbRow = {
  id: string
  invoice_id: string | null
  kind: PaperRow['kind']
  number: string
  dated_on: string | null
  order_number: string
  po_text: string
  file_path: string | null
  drive_file_id: string | null
  subtotal_cents: number | null
  tax_cents: number | null
  freight_cents: number | null
  total_cents: number | null
  read_by: string
  read_at: string | null
  check_state: PaperRow['checkState']
  check_note: string
  accepted_by: string | null
  accepted_at: string | null
}

type LineDbRow = {
  paper_id: string
  line_no: number
  line_kind: PaperLine['lineKind']
  house_code: string
  mfr_number: string
  description: string
  unit: string
  qty_ordered: number | string | null
  qty_shipped: number | string | null
  qty_backordered: number | string | null
  unit_price: number | string | null
  pricing_unit: PaperLine['pricingUnit']
  extended_cents: number | null
}

const n = (v: number | string | null): number | null => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null)

export function lineOfDb(r: LineDbRow): PaperLine {
  return {
    lineNo: r.line_no,
    lineKind: r.line_kind,
    houseCode: r.house_code ?? '',
    mfrNumber: r.mfr_number ?? '',
    description: r.description ?? '',
    unit: r.unit ?? '',
    qtyOrdered: n(r.qty_ordered),
    qtyShipped: n(r.qty_shipped),
    qtyBackordered: n(r.qty_backordered),
    unitPrice: n(r.unit_price),
    pricingUnit: r.pricing_unit ?? 'each',
    extendedCents: r.extended_cents,
  }
}

export function paperOfDb(p: PaperDbRow, lines: readonly LineDbRow[]): PaperRow {
  return {
    id: p.id,
    invoiceId: p.invoice_id,
    kind: p.kind,
    number: p.number ?? '',
    datedOn: p.dated_on,
    orderNumber: p.order_number ?? '',
    poText: p.po_text ?? '',
    filePath: p.file_path,
    driveFileId: p.drive_file_id,
    subtotalCents: p.subtotal_cents,
    taxCents: p.tax_cents,
    freightCents: p.freight_cents,
    totalCents: p.total_cents,
    readBy: p.read_by ?? '',
    readAt: p.read_at,
    checkState: p.check_state,
    checkNote: p.check_note ?? '',
    acceptedBy: p.accepted_by,
    acceptedAt: p.accepted_at,
    lines: [...lines].sort((a, b) => a.line_no - b.line_no).map(lineOfDb),
  }
}

async function appClient(): Promise<SupabaseClient<Database>> {
  return (await import('../../supabase')).supabase
}

export function supabasePaperIo(given?: SupabaseClient<Database>): PaperIo {
  const db = async (): Promise<SupabaseClient> => (given ?? (await appClient())) as unknown as SupabaseClient
  return {
    async loadForInvoices(invoiceIds) {
      const out = new Map<string, PaperRow>()
      if (invoiceIds.length === 0) return out
      try {
        const client = await db()
        // The generated types learn the two tables after the push; until then the names are strings here.
        const { data: papers, error } = await client.from('supply_papers').select('*').in('invoice_id', [...invoiceIds])
        if (error || !papers?.length) return out
        const rows = papers as PaperDbRow[]
        const { data: lines } = await client.from('supply_paper_lines').select('*').in('paper_id', rows.map((p) => p.id))
        const byPaper = new Map<string, LineDbRow[]>()
        for (const l of (lines ?? []) as LineDbRow[]) {
          const list = byPaper.get(l.paper_id) ?? []
          list.push(l)
          byPaper.set(l.paper_id, list)
        }
        // One paper per bill through the office's door; were there two, the first read stands.
        for (const p of rows) {
          if (!p.invoice_id || out.has(p.invoice_id)) continue
          out.set(p.invoice_id, paperOfDb(p, byPaper.get(p.id) ?? []))
        }
        return out
      } catch {
        return out
      }
    },
    async save(invoiceId, paper, lines) {
      const client = await db()
      const { data, error } = await client.rpc('supply_paper_save', { p_invoice_id: invoiceId, p_paper: paper, p_lines: lines })
      if (error) throw new Error(formatErrorMessage(error, 'The lines were not saved.'))
      return String(data)
    },
    async accept(paperId, note) {
      const client = await db()
      const { error } = await client.rpc('supply_paper_accept', { p_paper_id: paperId, p_note: note })
      if (error) throw new Error(formatErrorMessage(error, 'The bill was not counted as read.'))
    },
    async namesOf(userIds) {
      const out = new Map<string, string>()
      if (userIds.length === 0) return out
      try {
        const client = await db()
        const { data } = await client.from('users').select('id, name').in('id', [...userIds])
        for (const u of (data ?? []) as { id: string; name: string | null }[]) out.set(u.id, (u.name ?? '').trim())
      } catch {
        // the row reads *counted as read* with no name
      }
      return out
    },
  }
}

/**
 * The desk's read of `mail_pieces` (the Docsmit train, 6b; v2.5532): a lien envelope's piece names the rows behind it in
 * `source_ids`, its desk items from prepare and its filings once the run records, so the desk reads the run's pieces by
 * item and the Sent row's by filing with one call. The table is read loosely until the generated types carry it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { chunkIds } from '../supabasePaging'
import { mailPiecesByFiling as foldBySource, type LienMailPieceRow } from './lienMailPieces'

/** What the desk shows of a piece: the words, the footer lines, the cost, the doors, and the run's copies. */
const LIEN_MAIL_PIECE_COLUMNS = 'id, kind, recipient, status, usps_tracking, mailed_at, delivered_at, signed_by, delivery_status, source_ids, problem, price, name, organization, send_type, resend_of, resolved_at, resolved_note'

/** The pieces behind these ids, keyed by each id asked for. A chunk that fails, or a table not there yet, leaves its ids out. */
export async function readMailPiecesBySource(ids: ReadonlyArray<string>, label: string): Promise<Record<string, LienMailPieceRow[]>> {
  const out: Record<string, LienMailPieceRow[]> = {}
  for (const chunk of chunkIds([...new Set(ids)])) {
    if (chunk.length === 0) continue
    const part = await withSupabaseRetry(
      () => (supabase as unknown as SupabaseClient).from('mail_pieces').select(LIEN_MAIL_PIECE_COLUMNS).overlaps('source_ids', chunk),
      label,
    ).catch(() => [])
    const asked = new Set(chunk)
    for (const [id, pieces] of Object.entries(foldBySource((part ?? []) as LienMailPieceRow[]))) if (asked.has(id)) out[id] = pieces
  }
  return out
}

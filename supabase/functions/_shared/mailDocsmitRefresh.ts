/**
 * The read-back shared by mail-send-docsmit (`refresh`, and after a `send`) and mail-poll (the
 * Docsmit train, PR 3): one `/parties` read per piece, the fold, the filing's `sends[]` patch,
 * and the Certification PDF once a piece reads delivered. Takes the database as a small
 * structural client so a test can hand it a recording fake. No Deno globals.
 */
import type { DocsmitClient } from './docsmitClient.ts'
import { MAIL_FILING_KINDS, MAIL_OPEN_STATUSES, appendEvent, mailPieceUpdateFromParty, sendsWithPiece, ymdInZone, type MailPieceRow } from './mailSend.ts'
import { APP_CALENDAR_TZ } from './appTimeZone.ts'

export const PIECE_COLUMNS = 'id, kind, source_ids, job_id, provider, recipient, short_code, name, organization, address1, address2, city, state, postal_code, send_type, envelope, sheets, provider_message_id, client_msg_id, price, status, usps_tracking, mailed_at, delivered_at, signed_by, delivery_status, delivery_as_of, events, opened_at, pdf_bucket, pdf_path, certification_path, problem'

export const APP_TZ = APP_CALENDAR_TZ

/** The slice of a Supabase client these helpers use. */
export type MailDbResult = { data: unknown; error: { message: string } | null }
export type MailDbQuery = {
  select: (columns: string) => MailDbQuery
  eq: (column: string, value: unknown) => MailDbQuery
  in: (column: string, values: unknown[]) => MailDbQuery
  order: (column: string, opts?: { ascending?: boolean }) => MailDbQuery
  limit: (n: number) => MailDbQuery
  update: (patch: Record<string, unknown>) => MailDbQuery
  insert: (row: Record<string, unknown>) => MailDbQuery
  single: () => PromiseLike<MailDbResult>
  maybeSingle: () => PromiseLike<MailDbResult>
  then: PromiseLike<MailDbResult>['then']
}
export type MailDb = { from: (table: string) => MailDbQuery }

/** Where the Certification PDF is filed: the private bucket by raw REST with the service role. */
export type MailStore = { supabaseUrl: string; serviceKey: string }

export async function loadOpenPieces(db: MailDb, provider: string, limit = 200): Promise<MailPieceRow[]> {
  const { data, error } = await db.from('mail_pieces').select(PIECE_COLUMNS).eq('provider', provider).in('status', [...MAIL_OPEN_STATUSES]).order('updated_at', { ascending: true }).limit(limit)
  if (error) throw new Error(`mail_pieces: ${error.message}`)
  return (Array.isArray(data) ? data : []) as MailPieceRow[]
}

export async function loadPiecesByIds(db: MailDb, ids: string[]): Promise<MailPieceRow[]> {
  if (ids.length === 0) return []
  const { data, error } = await db.from('mail_pieces').select(PIECE_COLUMNS).in('id', ids)
  if (error) throw new Error(`mail_pieces: ${error.message}`)
  const rows = (Array.isArray(data) ? data : []) as MailPieceRow[]
  // In the order asked for.
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is MailPieceRow => !!r)
}

/** The USPS number, the provider and the piece onto every filing behind the piece, for the piece's recipient. */
export async function writeTrackingToFilings(db: MailDb, piece: MailPieceRow): Promise<string[]> {
  if (!MAIL_FILING_KINDS.has(piece.kind) || piece.source_ids.length === 0) return []
  const { data, error } = await db.from('job_lien_filings').select('id, sends').in('id', piece.source_ids)
  if (error) throw new Error(`job_lien_filings: ${error.message}`)
  const rows = (Array.isArray(data) ? data : []) as Array<{ id: string; sends: unknown }>
  const written: string[] = []
  for (const row of rows) {
    const next = sendsWithPiece(row.sends, piece.recipient, { id: piece.id, provider: piece.provider, usps_tracking: piece.usps_tracking, mailed_on: piece.mailed_at ? ymdInZone(piece.mailed_at, APP_TZ) : null })
    if (JSON.stringify(next) === JSON.stringify(row.sends)) continue
    const { error: upErr } = await db.from('job_lien_filings').update({ sends: next }).eq('id', row.id)
    if (upErr) throw new Error(`job_lien_filings ${row.id}: ${upErr.message}`)
    written.push(row.id)
  }
  return written
}

async function putPdf(store: MailStore, bucket: string, path: string, bytes: Uint8Array): Promise<boolean> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const res = await fetch(`${store.supabaseUrl}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { apikey: store.serviceKey, Authorization: `Bearer ${store.serviceKey}`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: copy.buffer as ArrayBuffer,
  })
  return res.ok
}

export type RefreshOne = { id: string; status: string; changed: boolean; filings: string[]; certification: boolean; error: string | null }

/** One piece: read `/parties`, fold, write the row, patch the filings, file the certification once delivered. */
export async function refreshPiece(db: MailDb, client: DocsmitClient, piece: MailPieceRow, nowIso: string, store?: MailStore): Promise<RefreshOne> {
  const out: RefreshOne = { id: piece.id, status: piece.status, changed: false, filings: [], certification: false, error: null }
  if (!piece.provider_message_id) {
    out.error = 'no provider message id'
    return out
  }
  try {
    const parties = await client.parties(piece.provider_message_id)
    const party = parties[0]
    if (!party) {
      await db.from('mail_pieces').update({ events: appendEvent(piece.events, { at: nowIso, kind: 'poll_empty' }) }).eq('id', piece.id)
      return out
    }
    const { patch, event, changed } = mailPieceUpdateFromParty(piece, party, nowIso)
    const next: MailPieceRow = { ...piece, ...patch, events: appendEvent(piece.events, { ...event, party }) }
    out.status = next.status
    out.changed = changed
    if (changed) {
      const { error } = await db.from('mail_pieces').update({ ...patch, events: next.events }).eq('id', piece.id)
      if (error) throw new Error(`mail_pieces ${piece.id}: ${error.message}`)
      if (patch.usps_tracking !== piece.usps_tracking || patch.mailed_at) out.filings = await writeTrackingToFilings(db, next)
    }
    if (next.status === 'delivered' && !next.certification_path && store) {
      const bytes = await client.documentation(piece.provider_message_id)
      if (bytes) {
        const path = `mail/${piece.id}/certification.pdf`
        if (await putPdf(store, piece.pdf_bucket, path, bytes)) {
          await db.from('mail_pieces').update({ certification_path: path, events: appendEvent(next.events, { at: nowIso, kind: 'certification_filed', path }) }).eq('id', piece.id)
          out.certification = true
        }
      }
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e)
    await db.from('mail_pieces').update({ events: appendEvent(piece.events, { at: nowIso, kind: 'poll_error', error: out.error }) }).eq('id', piece.id)
  }
  return out
}

export async function refreshPieces(db: MailDb, client: DocsmitClient, pieces: MailPieceRow[], nowIso: string, store?: MailStore): Promise<{ results: RefreshOne[]; updated: string[]; errors: Array<{ id: string; error: string }> }> {
  const results: RefreshOne[] = []
  for (const p of pieces) results.push(await refreshPiece(db, client, p, nowIso, store))
  return { results, updated: results.filter((r) => r.changed).map((r) => r.id), errors: results.filter((r) => r.error).map((r) => ({ id: r.id, error: r.error as string })) }
}

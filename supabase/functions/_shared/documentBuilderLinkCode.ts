/**
 * The Document builder's link code, made again from its row (punch list #404). Only the SHA-256 of a link's code is
 * kept in the database, with a random nonce. The code is HMAC-SHA256 of the row's id and nonce under a secret this
 * side holds (DOCUMENT_BUILDER_LINK_SECRET, or the service role key when that is not set), written in the link
 * alphabet. So a function can hand the same link to a dev on another day, or to a trade's own page, and the database
 * alone cannot. Edge only: it reads the secret from the function's own settings.
 */
import { documentBuilderHexOf, documentBuilderLinkCode, documentBuilderLinkSeed } from './documentBuilderLink.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

export async function documentBuilderSha256(value: string): Promise<string> {
  return documentBuilderHexOf(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
}

export async function documentBuilderLinkCodeOf(linkId: string, nonce: string): Promise<string> {
  const secret = Deno.env.get('DOCUMENT_BUILDER_LINK_SECRET')?.trim() || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  // One round is 32 bytes and nearly always enough. A few more are joined on the rare run of skipped bytes.
  let bytes = new Uint8Array(0)
  for (let round = 0; round < 8; round++) {
    const more = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(documentBuilderLinkSeed(linkId, nonce, round))))
    const joined = new Uint8Array(bytes.length + more.length)
    joined.set(bytes)
    joined.set(more, bytes.length)
    bytes = joined
    const code = documentBuilderLinkCode(bytes)
    if (code) return code
  }
  throw new Error('the link code could not be made')
}

export type DocumentBuilderLinkRow = { id: string; builder_key: string; sheet_id: string | null; nonce: string; made_at: string; ended_at: string | null; opened_at: string | null; last_opened_at: string | null; open_count: number }
export const DOCUMENT_BUILDER_LINK_COLUMNS = 'id, builder_key, sheet_id, nonce, made_at, ended_at, opened_at, last_opened_at, open_count'

/** A new link's row, with the old live one ended first: a new link stops the old one. */
export async function mintDocumentBuilderLink(admin: Admin, target: { builderKey: string; sheetId: string | null }, by: string | null): Promise<{ row: DocumentBuilderLinkRow; code: string }> {
  const nowIso = new Date().toISOString()
  let stop = admin.from('document_builder_links').update({ ended_at: nowIso, ended_by: by }).eq('builder_key', target.builderKey).is('ended_at', null)
  stop = target.sheetId ? stop.eq('sheet_id', target.sheetId) : stop.is('sheet_id', null)
  const { error: stopError } = await stop
  if (stopError) throw new Error(`stopping the old link: ${stopError.message}`)
  const id = crypto.randomUUID()
  const nonce = documentBuilderHexOf(crypto.getRandomValues(new Uint8Array(16)))
  const code = await documentBuilderLinkCodeOf(id, nonce)
  const { data, error } = await admin
    .from('document_builder_links')
    .insert({ id, builder_key: target.builderKey, sheet_id: target.sheetId, nonce, code_hash: await documentBuilderSha256(code), made_by: by, made_at: nowIso })
    .select(DOCUMENT_BUILDER_LINK_COLUMNS)
    .single()
  if (error) throw new Error(`making the link: ${error.message}`)
  return { row: data as DocumentBuilderLinkRow, code }
}

/**
 * The code of a sheet's live link, for a page that hands the link on. A sheet that never had a link gets one here.
 * A sheet whose link a dev switched off gets none: switching it on again is the dev's own press.
 */
export async function sheetLinkCodeFor(admin: Admin, builderKey: string, sheetId: string, by: string | null, opts: { mintIfNone: boolean }): Promise<string | null> {
  const { data, error } = await admin.from('document_builder_links').select(DOCUMENT_BUILDER_LINK_COLUMNS).eq('builder_key', builderKey).eq('sheet_id', sheetId)
  if (error) throw new Error(`the link: ${error.message}`)
  const rows = (data ?? []) as DocumentBuilderLinkRow[]
  const live = rows.find((r) => r.ended_at == null)
  if (live) return await documentBuilderLinkCodeOf(live.id, live.nonce)
  if (rows.length > 0 || !opts.mintIfNone) return null
  return (await mintDocumentBuilderLink(admin, { builderKey, sheetId }, by)).code
}

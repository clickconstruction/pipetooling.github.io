/**
 * The Document builder's link code, made again from its row (punch list #404). Only the SHA-256 of a link's code is
 * kept in the database, with a random nonce. The code is HMAC-SHA256 of the row's id and nonce under a secret this
 * side holds, written in the link alphabet. So a function can hand the same link to a dev on another day, or to a
 * trade's own page, and the database alone cannot. Edge only: it reads the secrets from the function's own settings.
 *
 * A new link is made under DOCUMENT_BUILDER_LINK_SECRET, the link's own secret. Until that is set the service role
 * key stands in. A link that exists is made again under whichever of the two its own hash answers to
 * (`documentBuilderLinkCodeAgain`), so setting the secret, or its being set after the first links, loses no address.
 */
import { documentBuilderHexOf, documentBuilderLinkCodeAgain, documentBuilderLinkCodeUnder, documentBuilderLinkHash, documentBuilderLinkSecrets } from './documentBuilderLink.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

function linkSecrets(): string[] {
  const secrets = documentBuilderLinkSecrets(Deno.env.get('DOCUMENT_BUILDER_LINK_SECRET'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  if (secrets.length === 0) throw new Error('no secret to make a link code with')
  return secrets
}

export const documentBuilderSha256 = documentBuilderLinkHash

/** A new link's code, under the secret that leads today. */
export async function documentBuilderLinkCodeOf(linkId: string, nonce: string): Promise<string> {
  return await documentBuilderLinkCodeUnder(linkSecrets()[0]!, linkId, nonce)
}

/** The code of a link that exists, or null when no secret this side holds makes it again. */
export async function documentBuilderLinkCodeOfRow(row: { id: string; nonce: string; code_hash: string }): Promise<string | null> {
  const code = await documentBuilderLinkCodeAgain(linkSecrets(), row)
  if (code == null) console.error(JSON.stringify({ event: 'document_builder_link_code_lost', link: row.id }))
  return code
}

export type DocumentBuilderLinkRow = { id: string; builder_key: string; sheet_id: string | null; nonce: string; code_hash: string; made_at: string; ended_at: string | null; opened_at: string | null; last_opened_at: string | null; open_count: number }
export const DOCUMENT_BUILDER_LINK_COLUMNS = 'id, builder_key, sheet_id, nonce, code_hash, made_at, ended_at, opened_at, last_opened_at, open_count'

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
 * A sheet whose link a dev switched off gets none: switching it on again is the dev's own press. Neither does a live
 * link whose code cannot be made again: making a new one would stop the address people already hold.
 */
export async function sheetLinkCodeFor(admin: Admin, builderKey: string, sheetId: string, by: string | null, opts: { mintIfNone: boolean }): Promise<string | null> {
  const { data, error } = await admin.from('document_builder_links').select(DOCUMENT_BUILDER_LINK_COLUMNS).eq('builder_key', builderKey).eq('sheet_id', sheetId)
  if (error) throw new Error(`the link: ${error.message}`)
  const rows = (data ?? []) as DocumentBuilderLinkRow[]
  const live = rows.find((r) => r.ended_at == null)
  if (live) return await documentBuilderLinkCodeOfRow(live)
  if (rows.length > 0 || !opts.mintIfNone) return null
  return (await mintDocumentBuilderLink(admin, { builderKey, sheetId }, by)).code
}

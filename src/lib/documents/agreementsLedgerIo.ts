/**
 * Documents → Agreements (punch list #376): the reads. The `agreements_on_file` view is one branch per table that holds
 * an agreement, `security_invoker`, so each table's own row security decides what the caller sees. It is read newest
 * first with the chips and the find box asked of the database, a page at a time. Browser io, not pure; the rules are
 * `agreementsLedger.ts`. The view is not in the generated types until the push and the types PR, so the client is cast
 * once here, and a database ahead of the push answers a refusal in words.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { AGREEMENTS_PAGE, AGREEMENTS_SELECT, AGREEMENTS_SITE_KEYS_MAX, agreementFindWords, agreementsSiteAsked, kindsOfPick, statesOfPick, type AgreementRow, type AgreementState, type AgreementsQuery, type AgreementsReader, type KindPick } from './agreementsLedger'

const db = supabase as unknown as SupabaseClient

export const AGREEMENTS_VIEW = 'agreements_on_file'

export type AgreementsRead = { rows: AgreementRow[]; more: boolean }

type Narrowable<T> = { in: (column: string, values: ReadonlyArray<string>) => T; ilike: (column: string, pattern: string) => T }

/** The chips and the find box as filters: the kinds, the states, and every typed word found in the row's `find_text`. */
function applyFilters<T extends Narrowable<T>>(q: T, query: Pick<AgreementsQuery, 'kind' | 'state' | 'typed' | 'reader' | 'site'>): T {
  let out = q
  const kinds = kindsOfPick(query.kind, query.reader)
  if (kinds) out = out.in('kind', kinds)
  const states = statesOfPick(query.state)
  if (states) out = out.in('state', states)
  for (const word of agreementFindWords(query.typed)) out = out.ilike('find_text', `*${word}*`)
  // One site's papers (punch list #439): the lines whose paper names one of the site's keys. Every other kind of line names none.
  if (agreementsSiteAsked(query.site)) out = out.in('site_address_key', (query.site?.keys ?? []).slice(0, AGREEMENTS_SITE_KEYS_MAX))
  return out
}

/** The list, newest first, `limit` rows; `more` says another page may follow. Throws with the reason. */
export async function readAgreements(query: AgreementsQuery): Promise<AgreementsRead> {
  const limit = Math.max(1, query.limit || AGREEMENTS_PAGE)
  const base = db.from(AGREEMENTS_VIEW).select(AGREEMENTS_SELECT)
  const { data, error } = await applyFilters(base, query).order('at', { ascending: false }).order('id', { ascending: false }).limit(limit)
  if (error) throw new Error(formatErrorMessage(error, 'The agreements did not read.'))
  const rows = (data ?? []) as unknown as AgreementRow[]
  return { rows, more: rows.length >= limit }
}

/** How many agreements wait on a signature under a kind chip, for the chip's count; null when it cannot be read. */
export async function countAgreementsWaiting(kind: KindPick, reader?: AgreementsReader): Promise<number | null> {
  return countAgreementsInState('waiting', kind, reader)
}

/** How many papers were made and never sent under a kind chip, for the **Not sent** chip; null when it cannot be read. */
export async function countAgreementsNotSent(kind: KindPick, reader?: AgreementsReader): Promise<number | null> {
  return countAgreementsInState('not_sent', kind, reader)
}

async function countAgreementsInState(state: AgreementState, kind: KindPick, reader?: AgreementsReader): Promise<number | null> {
  try {
    let q = db.from(AGREEMENTS_VIEW).select('id', { count: 'exact', head: true }).eq('state', state)
    const kinds = kindsOfPick(kind, reader)
    if (kinds) q = q.in('kind', kinds)
    const { count, error } = await q
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

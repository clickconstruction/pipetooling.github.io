/**
 * Messages → My email (punch list #230 PR 3): the tab's one door to the edge function `gmail-mine` (PR 2), and the
 * person's own switch on their `users` row. Each of the four actions posts the contract's request
 * (`supabase.functions.invoke(MY_MAIL_FUNCTION, { body })`) and answers the contract's Ok or its refusal. A refusal
 * may come back as a non-2xx answer whose body is the function's own (read off `error.context`, as
 * `mail/runDocsmitIo.ts` reads a refusal since v2.5532), so the tab shows the function's words. Anything else, a lost
 * signal above all, is thrown, for the screen to draw through `recoveryFailureFromError`.
 *
 * The switch reads `users.my_mail_on` and `users.my_mail_hidden_labels` beside `users.email`, the one address the
 * function reads, through the untyped client and a narrow guard on the row until the regenerated types land. Before
 * the migration is pushed the read falls back to the address alone and says so (`ready`), the switch reading on, its
 * default. The save is `my_mail_set` (`types/database-functions.ts` until then).
 */
import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { MyMailSetParams, MyMailSetRow } from '../../types/database-functions'
import { errorKindOf, withSupabaseRetry } from '../../utils/errorHandling'
import {
  MY_MAIL_FUNCTION,
  MY_MAIL_REFUSAL_WORDS,
  type MyMailListOk,
  type MyMailListRequest,
  type MyMailOpenOk,
  type MyMailOpenRequest,
  type MyMailRefusal,
  type MyMailRequest,
  type MyMailTagOk,
  type MyMailTagRequest,
  type MyMailUntagOk,
  type MyMailUntagRequest,
} from './contract'
import { cleanHiddenLabels } from './settingCard'

/** A request as the tab asks it: the action is the method's own. */
type Asked<R extends MyMailRequest> = Omit<R, 'action'>

/** The four actions of `gmail-mine`, as the signed-in person. */
export interface MyMailIo {
  list(req: Asked<MyMailListRequest>): Promise<MyMailListOk | MyMailRefusal>
  open(req: Asked<MyMailOpenRequest>): Promise<MyMailOpenOk | MyMailRefusal>
  tag(req: Asked<MyMailTagRequest>): Promise<MyMailTagOk | MyMailRefusal>
  untag(req: Asked<MyMailUntagRequest>): Promise<MyMailUntagOk | MyMailRefusal>
}

const REFUSALS: ReadonlySet<string> = new Set(Object.keys(MY_MAIL_REFUSAL_WORDS))

/** Whether an answer is the function's refusal: `ok` false, a reason the contract names, and the words for it. */
export function isMyMailRefusal(answer: unknown): answer is MyMailRefusal {
  if (!answer || typeof answer !== 'object') return false
  const a = answer as { ok?: unknown; error?: unknown; words?: unknown }
  return a.ok === false && typeof a.error === 'string' && REFUSALS.has(a.error) && typeof a.words === 'string'
}

/** The function's own body under a non-2xx answer, or null when it has none the app can read. */
async function refusalBody(error: unknown): Promise<unknown> {
  if (!(error instanceof FunctionsHttpError)) return null
  const context = error.context as { json?: () => Promise<unknown> } | null | undefined
  if (typeof context?.json !== 'function') return null
  return context.json().catch(() => null)
}

/** One action: the Ok, or the refusal; a lost signal or an answer that is neither is thrown. */
async function ask<T extends { ok: true }>(db: SupabaseClient, body: MyMailRequest): Promise<T | MyMailRefusal> {
  const { data, error } = await db.functions.invoke(MY_MAIL_FUNCTION, { body })
  const answer: unknown = data ?? (error ? await refusalBody(error) : null)
  if (isMyMailRefusal(answer)) return answer
  if (answer && typeof answer === 'object' && (answer as { ok?: unknown }).ok === true) return answer as T
  if (error) throw error
  const words = answer && typeof answer === 'object' ? (answer as { words?: unknown }).words : null
  throw new Error(typeof words === 'string' && words.trim() ? words.trim() : 'The mail reader gave an answer the app cannot read.')
}

export function supabaseMyMailIo(client: unknown = supabase): MyMailIo {
  const db = client as SupabaseClient
  return {
    list: (req) => ask<MyMailListOk>(db, { action: 'list', ...req }),
    open: (req) => ask<MyMailOpenOk>(db, { action: 'open', ...req }),
    tag: (req) => ask<MyMailTagOk>(db, { action: 'tag', ...req }),
    untag: (req) => ask<MyMailUntagOk>(db, { action: 'untag', ...req }),
  }
}

// ---------- the person's own switch ----------

/** The switch as the person's row holds it. */
export interface MyMailSetting {
  /** *Show my mail on the My email tab*: on unless the person turned it off. */
  on: boolean
  /** The Gmail labels left out of the tab. */
  hiddenLabels: string[]
  /** The person's own address, `users.email`: the one the function reads. */
  address: string
  /** The two columns answered. False before 20261101083844 is pushed: the switch reads on and cannot save yet. */
  ready: boolean
}

/** The switch and the labels as saved by `my_mail_set`. */
export type MyMailSaved = Pick<MyMailSetting, 'on' | 'hiddenLabels'>

const DEFAULT_SETTING: MyMailSetting = { on: true, hiddenLabels: [], address: '', ready: false }

/** The row's two columns and its address, read through a guard, the switch on when the column is not there. */
// until the chore(types) after 20261101083844 lands
export function myMailSettingOf(row: unknown): Omit<MyMailSetting, 'ready'> {
  const r = row && typeof row === 'object' ? (row as { email?: unknown; my_mail_on?: unknown; my_mail_hidden_labels?: unknown }) : {}
  const labels = Array.isArray(r.my_mail_hidden_labels) ? r.my_mail_hidden_labels.filter((l): l is string => typeof l === 'string') : []
  return { on: r.my_mail_on !== false, hiddenLabels: cleanHiddenLabels(labels), address: typeof r.email === 'string' ? r.email.trim() : '' }
}

/** `my_mail_set`'s row as saved, read through a guard: what was asked, where the row says nothing. */
// until the chore(types) after 20261101083844 lands
export function myMailSavedOf(data: unknown, asked: { on: boolean; hiddenLabels: readonly string[] | null }, before: readonly string[] = []): MyMailSaved {
  const row = (Array.isArray(data) ? data[0] : data) as Partial<MyMailSetRow> | null | undefined
  const on = typeof row?.is_on === 'boolean' ? row.is_on : asked.on
  const labels = Array.isArray(row?.hidden_labels) ? row.hidden_labels.filter((l): l is string => typeof l === 'string') : (asked.hiddenLabels ?? before)
  return { on, hiddenLabels: cleanHiddenLabels(labels) }
}

const SETTING_COLUMNS = 'email, my_mail_on, my_mail_hidden_labels'

/** The signed-in person's own switch (theirs by `userId`, else the session's), the switch on when nobody is signed in. */
export async function loadMyMailSetting(userId?: string | null, client: unknown = supabase): Promise<MyMailSetting> {
  const db = client as SupabaseClient
  const id = userId?.trim() || (await db.auth.getSession()).data.session?.user.id || null
  if (!id) return DEFAULT_SETTING
  try {
    const row: unknown = await withSupabaseRetry(() => db.from('users').select(SETTING_COLUMNS).eq('id', id).maybeSingle(), 'read your mail switch')
    return { ...myMailSettingOf(row), ready: true }
  } catch (e) {
    // A lost signal is thrown as it is; a refusal of the columns means the migration is not pushed yet.
    if (errorKindOf(e) === 'network') throw e
  }
  const bare: unknown = await withSupabaseRetry(() => db.from('users').select('email').eq('id', id).maybeSingle(), 'read your mail switch')
  return { ...myMailSettingOf(bare), ready: false }
}

/** The switch saved, with the labels when they are given (null leaves them), through `my_mail_set`. */
export async function saveMyMailSetting(on: boolean, hiddenLabels: readonly string[] | null, client: unknown = supabase): Promise<MyMailSaved> {
  const db = client as SupabaseClient
  const params: MyMailSetParams = { p_on: on, p_hidden_labels: hiddenLabels ? cleanHiddenLabels(hiddenLabels) : null }
  const data: unknown = await withSupabaseRetry(() => db.rpc('my_mail_set', params), 'save your mail switch')
  return myMailSavedOf(data, { on, hiddenLabels })
}

/** The card's reads and writes, as one object a test can stand in for. */
export interface MyMailSettingIo {
  load(userId?: string | null): Promise<MyMailSetting>
  save(on: boolean, hiddenLabels: readonly string[] | null): Promise<MyMailSaved>
}

export function supabaseMyMailSettingIo(client: unknown = supabase): MyMailSettingIo {
  return {
    load: (userId) => loadMyMailSetting(userId, client),
    save: (on, hiddenLabels) => saveMyMailSetting(on, hiddenLabels, client),
  }
}

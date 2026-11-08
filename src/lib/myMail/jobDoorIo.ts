/**
 * Messages → My email, the door on the job (punch list #263 PR A): the one read the line makes when a job window or a
 * thread narrowed to a job opens. The job's people's addresses come off `contact_channels`; then one `gmail-mine`
 * `list` as the signed-in person, To tag, searched on them and the job's number (`jobDoorQuery`), metadata only, kept
 * nowhere. Null, and no line, when the person's switch is off (`loadMyMailSetting`), when there is nothing to search
 * for, or when the function refuses (off, offWorkspace, imitated, readOnly…): a refusal here is no line and no words,
 * since the line is a door and never a nag. A lost signal is thrown, and the line stays quiet too.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { MyMailJobRef, MyMailRefusal, MyMailRow, MyMailTagOk } from './contract'
import { jobDoorQuery } from './jobDoor'
import { loadMyMailSetting, supabaseMyMailIo, type MyMailIo } from './myMailIo'

/** What the line read: the search it sent, and the page's rows. */
export interface JobDoorRead {
  query: string
  rows: MyMailRow[]
}

/** The line's reads and its one write, as one object a test can stand in for. */
export interface JobDoorIo {
  /** The email addresses of these contacts, lower-case, each once. */
  addresses(contactIds: readonly string[]): Promise<string[]>
  /** One page of the person's own mail with these addresses and this job number, or null for no line. */
  read(addresses: readonly string[], jobNum: string | null): Promise<JobDoorRead | null>
  /** The tab's own tag, onto this job. */
  tag(threadId: string, job: MyMailJobRef): Promise<MyMailTagOk | MyMailRefusal>
}

/** The contacts' email addresses off `contact_channels`, lower-case, each once. */
export async function emailAddressesOf(contactIds: readonly string[], client: unknown = supabase): Promise<string[]> {
  const ids = [...new Set(contactIds.filter((id) => id.trim() !== ''))]
  if (ids.length === 0) return []
  const db = client as SupabaseClient
  const rows = (await withSupabaseRetry(() => db.from('contact_channels').select('value').in('contact_id', ids).eq('kind', 'email'), "read the job's people's addresses")) as { value: string | null }[] | null
  const out = new Set<string>()
  for (const r of rows ?? []) {
    const a = (r.value ?? '').trim().toLowerCase()
    if (a) out.add(a)
  }
  return [...out]
}

/**
 * The line's read: the switch, the search, the page. Null when there is no line to draw: the switch off, nothing to
 * search for, or the function's refusal of any kind.
 */
export async function readJobDoor(
  addresses: readonly string[],
  jobNum: string | null,
  deps: { setting: () => Promise<{ on: boolean }>; io: Pick<MyMailIo, 'list'> },
): Promise<JobDoorRead | null> {
  const query = jobDoorQuery(addresses, jobNum)
  if (!query) return null
  const setting = await deps.setting()
  if (!setting.on) return null
  const answer = await deps.io.list({ view: 'toTag', q: query })
  if (!answer.ok) return null
  return { query, rows: answer.rows }
}

export function supabaseJobDoorIo(client: unknown = supabase): JobDoorIo {
  const io = supabaseMyMailIo(client)
  return {
    addresses: (contactIds) => emailAddressesOf(contactIds, client),
    read: (addresses, jobNum) => readJobDoor(addresses, jobNum, { setting: () => loadMyMailSetting(null, client), io }),
    tag: (threadId, job) => io.tag({ threadId, job }),
  }
}

// One Checklist task named by a dev seat verb (v2.7589): its id, or words that find exactly one. get_task, the place
// pair and the photo pair all name a task the same way, so the rule lives here once. Pure: the read comes in through
// the Reader.

import type { Reader } from './devMcpComposites.ts'
import { taskTitlePlain } from './gcKernels/lib/tasks/taskPlace.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FIND_LIMIT = 20
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

/** A PostgREST ilike term that holds every word of the text, in order. */
export const taskLikeTerm = (text: string): string => `*${text.trim().replace(/[*,()]/g, ' ').replace(/\s+/g, '*')}*`

export type TaskRef = { id: string } | { refused: string }

/** A task's id as given, else the one task whose words hold the text. Refused in words for none and for several. */
export async function resolveTaskRef(reader: Reader, ref: string, verb: string): Promise<TaskRef> {
  const want = ref.trim()
  if (!want) return { refused: `${verb} needs task — a task id (find_task gives one), or words that find one task.` }
  if (UUID_RE.test(want)) return { id: want.toLowerCase() }
  const found = await reader.rows('checklist_items', { select: 'id,title,start_date', filters: [{ column: 'title', op: 'ilike', value: taskLikeTerm(want) }], order: [{ column: 'created_at', ascending: false }], limit: FIND_LIMIT })
  if (found.length === 0) return { refused: `No task matches "${want}".` }
  if (found.length > 1) {
    return { refused: `"${want}" matches ${found.length === FIND_LIMIT ? 'twenty or more' : found.length} tasks — pass the id of one (find_task lists them): ${found.slice(0, 6).map((r) => `${taskTitlePlain(str(r.title)).slice(0, 50)}, ${str(r.start_date)} (${str(r.id)})`).join('; ')}` }
  }
  return { id: str(found[0]!.id) }
}

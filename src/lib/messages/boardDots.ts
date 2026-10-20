/**
 * The Pipeline's waiting dot (v2.5632, the owner's yes after punch list #123): the speech bubble on a job's row carries a
 * dot when the job's customer waits in Follow up's Needs a reply with their newest line on this job. R4 · 4 (v2.5407)
 * drew the rule as `boardDot(rows, messages, names, jobId, now)` in `flows/stageSends.ts` and nothing called it; this
 * file calls it for the whole board at once, over the same two kernels Follow up builds its queue with, so the dot and
 * the queue can never disagree. The board reads the open conversations' lines in once (`boardDotsIo.ts`) and maps job
 * id → the hover's parts. The read holds only lines in: an open conversation has no reply of ours after its newest
 * line, which is what `contacts.state = waiting` means, so `boardDot`'s own check for a later line of ours finds none
 * and the state stands in for it.
 */
import { firstName } from '../contacts/kernel'
import { boardDot, type BoardDotHover, type BoardDotMessage } from '../flows/stageSends'
import { needsReply, type QueueContact, type QueueMessage } from '../followUp/queue'

/** A line as the dot reads it: Follow up's, with the job it is tied to and an email's subject for the hover. */
export type BoardDotLine = QueueMessage & Pick<BoardDotMessage, 'jobId' | 'subject'>

/**
 * The dots by job: each Needs a reply row whose newest line is tied to a job puts the job on the map, the row waiting
 * longest first, so of two people waiting on one job the longest-waiting one is the hover's (as `boardDot` orders them).
 * A row whose newest line is tied to no job marks nothing: the dot says "on this job", not "somewhere".
 */
export function boardDotsByJob(
  contacts: readonly QueueContact[],
  lines: readonly BoardDotLine[],
  todayYmd: string,
  now: Date,
): ReadonlyMap<string, BoardDotHover> {
  const rows = needsReply(contacts, lines, [], todayYmd)
  const names: Partial<Record<string, string>> = Object.fromEntries(contacts.map((c) => [c.id, firstName(c)]))
  const byId = new Map(lines.map((l) => [l.id, l]))
  const out = new Map<string, BoardDotHover>()
  for (const row of rows) {
    const jobId = row.landOnId ? (byId.get(row.landOnId)?.jobId ?? null) : null
    if (!jobId || out.has(jobId)) continue
    const dot = boardDot(rows, lines, names, jobId, now)
    if (dot) out.set(jobId, dot)
  }
  return out
}

/** The hover in one line, its parts side by side: "Dana · text · 9:05 AM · Can you come Friday? · Nobody has answered." */
export function boardDotTitle(dot: BoardDotHover): string {
  return [dot.who, dot.channel, dot.when, dot.line, dot.status].filter((part) => part.trim() !== '').join(' · ')
}

// dev-mcp's reply fit (v2.6935): the door cuts any reply at REPLY_MAX_CHARS (devMcpDoor.ts → replyText), mid-JSON, so a
// composite that answers a large record loses its last blocks without saying which. A composite that can grow past the
// cut hands its reply here with the steps that shorten it, mildest first; each step runs only while the reply is still
// over the budget, and each one that ran is named in the reply's `shortened` block with what was kept and the call that
// reads the rest. A reply under the budget comes back untouched. Pure: no env, no network.
// Tests: src/lib/devMcp/devMcpBigCase.test.ts.
import { REPLY_MAX_CHARS } from './devMcpDoor.ts'

/** What a fitted reply aims under: the door's cut, less room for the words that say what was shortened. */
export const REPLY_FIT_CHARS = 72_000

/** How long the door makes this reply: the JSON replyText writes. */
export const replyChars = (payload: unknown): number => JSON.stringify(payload, null, 1).length

/** One block a reply shortened: its name in the reply, what is still there, and the call that reads the rest. */
export type ShortenedBlock = { block: string; kept: string; read_whole: string }
export type Shortened = { why: string; blocks: ShortenedBlock[] }
/** One way to shorten a reply; null when it has nothing to shorten. `budget` is for a step that must measure. */
export type FitStep<T> = (reply: T, budget: number) => { reply: T; note: ShortenedBlock } | null

const thousands = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/**
 * The reply, shortened step by step until it is under `budget`. A second step on the same block replaces the first
 * one's note. When every step has run and the reply is still over, it goes on as it is and the door cuts it: the
 * steps are the composite's promise, this only runs them.
 */
export function fitReply<T extends { shortened: Shortened | null }>(reply: T, steps: readonly FitStep<T>[], budget = REPLY_FIT_CHARS): T {
  const whole = replyChars(reply)
  if (whole <= budget) return reply
  const asked = reply.shortened?.why ?? ''
  const why = `${asked ? `${asked} ` : ''}As asked this reply is ${thousands(whole)} characters, and the door cuts a reply at ${thousands(REPLY_MAX_CHARS)}.`
  const blocks = [...(reply.shortened?.blocks ?? [])]
  let cur: T = { ...reply, shortened: { why, blocks: [...blocks] } }
  for (const step of steps) {
    if (replyChars(cur) <= budget) break
    const next = step(cur, budget)
    if (!next) continue
    const at = blocks.findIndex((b) => b.block === next.note.block)
    if (at >= 0) blocks[at] = next.note
    else blocks.push(next.note)
    cur = { ...next.reply, shortened: { why, blocks: [...blocks] } }
  }
  return cur.shortened && cur.shortened.blocks.length === 0 ? { ...cur, shortened: reply.shortened } : cur
}

/**
 * At most `max` headings of a document, as an outline: every heading of the shallowest levels that fit whole, then the
 * first ones of the next level, in the document's own order. A document whose headings are all one level keeps its
 * first `max`.
 */
export function outlineHeadings<H extends { level: number }>(headings: readonly H[], max: number): H[] {
  if (headings.length <= max) return [...headings]
  if (max <= 0) return []
  const levels = [...new Set(headings.map((h) => h.level))].sort((a, b) => a - b)
  const whole = new Set<number>()
  let kept = 0
  let partial: { level: number; room: number } | null = null
  for (const level of levels) {
    const n = headings.filter((h) => h.level === level).length
    if (kept + n <= max) {
      whole.add(level)
      kept += n
      continue
    }
    partial = { level, room: max - kept }
    break
  }
  const out: H[] = []
  let room = partial?.room ?? 0
  for (const h of headings) {
    if (whole.has(h.level)) out.push(h)
    else if (partial && h.level === partial.level && room > 0) {
      out.push(h)
      room -= 1
    }
  }
  return out
}

/** The first `max` characters of a text with an ellipsis, and how many it left out (0 when the text is whole). */
export function cutText(text: string, max: number): { text: string; more: number } {
  if (text.length <= max) return { text, more: 0 }
  let end = Math.max(0, max)
  const last = text.charCodeAt(end - 1)
  // Never half of a surrogate pair.
  if (last >= 0xd800 && last <= 0xdbff) end -= 1
  return { text: `${text.slice(0, end).trimEnd()}…`, more: text.length - end }
}

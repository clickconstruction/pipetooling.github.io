// get_document_history (v2.6622, punch list #278 PR 4): what moved on a document — its revisions, and the difference
// between two versions — through dev_doc_history (migration 20261107090000) as the dev. The two texts come to this
// server and only their difference goes on to the agent: common lines at both ends are dropped, the middle is diffed
// line by line (a longest-common-subsequence over up to 600 lines a side, else the middle reported as one block), and
// the hunks are capped. Dev-only: another role is refused in words, as the RPC refuses it.
import type { Reader } from './devMcpComposites.ts'
import { resolvePerson } from './devMcpPersonFile.ts'

export type DocHistoryAsk = { person: string; doc_id?: unknown; kind?: unknown; from?: unknown; to?: unknown }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Lines a side the exact diff takes on; a bigger middle is reported as one block. */
export const DIFF_LCS_LINES = 600
/** Lines of removed and added text a reply carries at most. */
export const DIFF_LINES_CAP = 400
/**
 * Characters of removed and added text a reply carries at most (v2.6642). The door cuts any reply at 80,000 characters,
 * mid-text, so the JSON no longer parses; a narrative whose lines are whole paragraphs put 400 lines at 180,000. A
 * line longer than what is left is cut to it with an ellipsis, and the hunks stop there.
 */
export const DIFF_CHARS_CAP = 40_000

export function docHistoryInput(ask: DocHistoryAsk): { ok: true; docId: string | null; kind: 'summary' | 'narrative' | null; from: string | null; to: string | null } | { ok: false; refused: string } {
  const docId = typeof ask.doc_id === 'string' ? ask.doc_id.trim().toLowerCase() : ''
  const kind = typeof ask.kind === 'string' ? ask.kind.trim() : ''
  if ((docId !== '') === (kind !== '')) return { ok: false, refused: 'get_document_history needs doc_id (a named document) or kind (summary | narrative), one of the two.' }
  if (docId && !UUID_RE.test(docId)) return { ok: false, refused: 'get_document_history: doc_id must be a documents.id (a named document on the file).' }
  if (kind && kind !== 'summary' && kind !== 'narrative') return { ok: false, refused: 'get_document_history: kind must be summary or narrative.' }
  const from = typeof ask.from === 'string' ? ask.from.trim().toLowerCase() : ''
  const to = typeof ask.to === 'string' ? ask.to.trim().toLowerCase() : ''
  if (from && !UUID_RE.test(from)) return { ok: false, refused: 'get_document_history: from must be a revision id from the list.' }
  if (to && !UUID_RE.test(to)) return { ok: false, refused: 'get_document_history: to must be a revision id from the list, or left out for the text as it stands.' }
  if (to && !from) return { ok: false, refused: 'get_document_history: to needs from — the older revision first.' }
  return { ok: true, docId: docId || null, kind: (kind as 'summary' | 'narrative') || null, from: from || null, to: to || null }
}

export type DiffHunk = { from_line: number; removed: string[]; added: string[] }
export type LineDiff = { same: boolean; removed_lines: number; added_lines: number; hunks: DiffHunk[]; cut: boolean; exact: boolean }

/** The difference between two texts as hunks of removed and added lines, exact when the changed middle is small. */
export function lineDiff(before: string, after: string): LineDiff {
  if (before === after) return { same: true, removed_lines: 0, added_lines: 0, hunks: [], cut: false, exact: true }
  const a = before === '' ? [] : before.split('\n')
  const b = after === '' ? [] : after.split('\n')
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const ma = a.slice(head, a.length - tail)
  const mb = b.slice(head, b.length - tail)
  const hunks: DiffHunk[] = []
  let exact = true
  if (ma.length <= DIFF_LCS_LINES && mb.length <= DIFF_LCS_LINES) {
    // Longest common subsequence over the middle; then walk it into hunks.
    const n = ma.length
    const m = mb.length
    const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = ma[i] === mb[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    let i = 0
    let j = 0
    let open: DiffHunk | null = null
    const close = () => {
      if (open && (open.removed.length || open.added.length)) hunks.push(open)
      open = null
    }
    while (i < n || j < m) {
      if (i < n && j < m && ma[i] === mb[j]) {
        close()
        i++
        j++
      } else {
        if (!open) open = { from_line: head + i + 1, removed: [], added: [] }
        if (j < m && (i >= n || dp[i]![j + 1]! >= dp[i + 1]![j]!)) open.added.push(mb[j++]!)
        else open.removed.push(ma[i++]!)
      }
    }
    close()
  } else {
    exact = false
    hunks.push({ from_line: head + 1, removed: ma, added: mb })
  }
  let lines = DIFF_LINES_CAP
  let chars = DIFF_CHARS_CAP
  let cut = false
  // Take lines while both the line and the character budgets last; a line longer than the characters left is cut to fit.
  const take = (src: string[]): string[] => {
    const out: string[] = []
    for (const l of src) {
      if (lines <= 0 || chars <= 0) {
        cut = true
        break
      }
      if (l.length > chars) {
        out.push(`${l.slice(0, Math.max(0, chars - 1))}…`)
        chars = 0
        lines -= 1
        cut = true
        break
      }
      out.push(l)
      chars -= l.length + 1
      lines -= 1
    }
    return out
  }
  const capped = hunks.map((h) => ({ from_line: h.from_line, removed: take(h.removed), added: take(h.added) }))
  return { same: false, removed_lines: ma.length, added_lines: mb.length, hunks: capped.filter((h) => h.removed.length || h.added.length), cut, exact }
}

type RpcReply = {
  now: Record<string, unknown>
  revisions: Array<Record<string, unknown>>
  from: { id: string; replaced_at: string; content: string } | null
  to: { id: string | null; replaced_at: string | null; content: string } | null
}

export async function getDocumentHistory(reader: Reader, ask: DocHistoryAsk, who: { role: string }) {
  if (who.role !== 'dev') return { refused: 'get_document_history reads the HR file, which is dev-only; it does not read as another person.' }
  const input = docHistoryInput(ask)
  if (!input.ok) return { refused: input.refused }
  const resolved = await resolvePerson(reader, ask.person)
  if ('refused' in resolved) return resolved
  const person = resolved.person
  const reply = (await reader.rpc('dev_doc_history', { p_person_id: person.id, p_doc_id: input.docId, p_kind: input.kind, p_from: input.from, p_to: input.to })) as RpcReply | null
  if (!reply) return { refused: 'dev_doc_history answered nothing.' }
  const diff = reply.from && reply.to ? lineDiff(reply.from.content, reply.to.content) : null
  return {
    person: { id: person.id, name: person.name },
    now: reply.now,
    revisions: reply.revisions,
    revision_count: reply.revisions.length,
    diff: diff
      ? { from: { id: reply.from!.id, replaced_at: reply.from!.replaced_at, chars: reply.from!.content.length }, to: { id: reply.to!.id, replaced_at: reply.to!.replaced_at, chars: reply.to!.content.length }, ...diff }
      : null,
    read_next: diff
      ? 'The hunks name the first line of each change in the older text; read the section around it with get_person_document.'
      : 'Pass from (a revision id, the older one) and to (a newer revision id, or left out for the text as it stands) for the difference between two versions.',
  }
}

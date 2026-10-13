/**
 * Messages, cut 3's screens: quick replies as the tables keep them (migration `20261012190000_quick_replies.sql`) read
 * into the kernel's shapes (`kernel.ts`). A line's presses count per person, newest first for *last used*; its
 * versions read oldest first, as the history window lists them. Pure.
 */
import type { QuickReply, QuickReplyChange, QuickReplyFor, QuickReplyScope, QuickReplyTags, QuickReplyVersion } from './kernel'

export interface QuickReplyRow {
  id: string
  text: string
  for_kind: string
  step_key: string | null
  scope: string
  added_by: string | null
  added_at: string
  removed_at: string | null
}

export interface QuickReplyUseRow {
  quick_reply_id: string
  user_id: string | null
  contact_id: string | null
  at: string
}

export interface QuickReplyVersionRow {
  id: number
  quick_reply_id: string
  kind: string
  from_text: string | null
  to_text: string | null
  from_for_kind: string | null
  from_step_key: string | null
  to_for_kind: string | null
  to_step_key: string | null
  by_user_id: string | null
  at: string
}

const FOR_KINDS: ReadonlySet<string> = new Set<QuickReplyFor>(['trade', 'customer', 'arch', 'any'])
const CHANGES: ReadonlySet<string> = new Set<QuickReplyChange>(['added', 'words', 'tags', 'removed', 'restored'])

const forKind = (v: string | null): QuickReplyFor | null => (v && FOR_KINDS.has(v) ? (v as QuickReplyFor) : null)
const ms = (iso: string): number => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** The lines with their presses counted. A row whose kind the kernel does not know is left out, not guessed. */
export function quickRepliesFromRows(lines: readonly QuickReplyRow[], uses: readonly QuickReplyUseRow[]): QuickReply[] {
  const byLine = new Map<string, QuickReplyUseRow[]>()
  for (const u of uses) byLine.set(u.quick_reply_id, [...(byLine.get(u.quick_reply_id) ?? []), u])
  return lines.flatMap((r) => {
    const kind = forKind(r.for_kind)
    if (!kind) return []
    const counted: Record<string, number> = {}
    let last: QuickReplyUseRow | null = null
    for (const u of byLine.get(r.id) ?? []) {
      if (u.user_id) counted[u.user_id] = (counted[u.user_id] ?? 0) + 1
      if (!last || ms(u.at) > ms(last.at)) last = u
    }
    const line: QuickReply = {
      id: r.id,
      text: r.text,
      for: kind,
      stepId: kind === 'any' ? null : r.step_key || null,
      scope: (r.scope === 'mine' ? 'mine' : 'team') satisfies QuickReplyScope,
      addedBy: r.added_by ?? '',
      addedAt: ms(r.added_at),
      removed: r.removed_at !== null,
      uses: counted,
      lastUsed: last ? { at: ms(last.at), by: last.user_id ?? '', contactId: last.contact_id } : null,
    }
    return [line]
  })
}

const tags = (kind: string | null, step: string | null): QuickReplyTags | undefined => {
  const f = forKind(kind)
  return f ? { for: f, stepId: f === 'any' ? null : step || null } : undefined
}

/** Each line's versions, oldest first; the identity orders one save's words before its tags. */
export function versionsFromRows(rows: readonly QuickReplyVersionRow[]): Record<string, QuickReplyVersion[]> {
  const out: Record<string, QuickReplyVersion[]> = {}
  const sorted = [...rows].sort((a, b) => ms(a.at) - ms(b.at) || a.id - b.id)
  for (const r of sorted) {
    if (!CHANGES.has(r.kind)) continue
    const v: QuickReplyVersion = { by: r.by_user_id ?? '', at: ms(r.at), kind: r.kind as QuickReplyChange }
    if (r.from_text !== null) v.fromText = r.from_text
    if (r.to_text !== null) v.toText = r.to_text
    const from = tags(r.from_for_kind, r.from_step_key)
    const to = tags(r.to_for_kind, r.to_step_key)
    if (from) v.fromTags = from
    if (to) v.toTags = to
    ;(out[r.quick_reply_id] ??= []).push(v)
  }
  return out
}

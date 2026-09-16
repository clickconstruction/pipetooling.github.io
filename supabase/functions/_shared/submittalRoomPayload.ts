/**
 * The review room's payload (Submittals stage 4a): what the customer's architect sees,
 * built from the submittal rows alone. The customer's words — a row *matches the plans*
 * or *differs* — never the estimator's chips, never a price, a quote, a supply house or
 * the builder's account. Dependency-free so the app imports the same shapes and tests
 * the row builder under vitest (`src/lib/submittals/submittalRoomPayload.test.ts`).
 */

export type RoomRole = 'architect' | 'owners_rep' | 'designer' | 'builder' | 'other'
export const ROOM_ROLES: ReadonlyArray<RoomRole> = ['architect', 'owners_rep', 'designer', 'builder', 'other']
export const ROOM_ROLE_LABELS: Record<RoomRole, string> = {
  architect: 'architect',
  owners_rep: "owner's rep",
  designer: 'designer',
  builder: 'builder / GC',
  other: 'other',
}
export function asRoomRole(v: unknown): RoomRole {
  return typeof v === 'string' && (ROOM_ROLES as ReadonlyArray<string>).includes(v) ? (v as RoomRole) : 'other'
}

/** The stored item row, as the functions read it (a subset of bid_submittal_items). */
export type RoomItemSource = {
  id: string
  tag: string
  sequence_order: number
  specified_manufacturer: string | null
  specified_model: string | null
  specified_description: string | null
  submitted_manufacturer: string | null
  submitted_model: string | null
  submitted_label: string | null
  status: string
  reason_kind: string | null
  reason_note: string | null
  lead_time_days: number | null
  sheet_pages: number[] | null
  review_decision: string | null
  review_note: string | null
  reviewed_by_name: string | null
  reviewed_by_person_id: string | null
  reviewed_at: string | null
}

/** The customer's four words. */
export type RoomRowKind = 'matches' | 'differs' | 'not_quoted' | 'added'

export type RoomRow = {
  id: string
  tag: string
  kind: RoomRowKind
  /** "TOTO CT708UVG · wall-hung, 1.28 gpf" — what the plans say. */
  plans: string
  /** "TOTO CT728CUVG#01" — what we propose. */
  proposed: string
  /** One sentence: the reason in plain words, the note, the lead time. */
  why: string
  /** True when a performance value changed (a design change) — the card says so. */
  performanceChange: boolean
  /** How many sheet pages this row carries in the package (0 = to follow). */
  sheetPages: number
  decision: { kind: 'approved' | 'revise' | 'rejected'; note: string | null; byName: string | null; byPersonId: string | null; at: string | null } | null
}

const REASON_WORDS: Record<string, string> = {
  lead_time: 'the specified product has a long lead time',
  discontinued: 'the specified product is discontinued',
  in_stock: 'this one is in stock',
  equal: "the plans' own or-equal language admits it",
  cost: 'it costs less',
  other: '',
}

function leadTimeWords(days: number | null): string {
  if (days == null || days < 0) return ''
  if (days === 0) return 'in stock'
  if (days % 7 === 0) return `about ${days / 7} week${days === 7 ? '' : 's'}`
  if (days > 21) return `about ${Math.round(days / 7)} weeks`
  return `about ${days} day${days === 1 ? '' : 's'}`
}

function join(parts: ReadonlyArray<string | null | undefined>, sep = ' · '): string {
  return parts.map((p) => (p ?? '').trim()).filter(Boolean).join(sep)
}

export function roomKindOf(status: string): RoomRowKind {
  switch (status) {
    case 'as_specified':
      return 'matches'
    case 'missing':
      return 'not_quoted'
    case 'accessory':
      return 'added'
    default:
      return 'differs'
  }
}

/** The why sentence for a differing row: the status's own words first, then the reason, the note, the lead time. */
export function whySentence(item: Pick<RoomItemSource, 'status' | 'reason_kind' | 'reason_note' | 'lead_time_days'>): string {
  const bits: string[] = []
  if (item.status === 'superseded') bits.push('the manufacturer replaced the specified model')
  else if (item.status === 'equal') bits.push("an equal under the plans' own language")
  else if (item.status === 'design_change') bits.push('a performance value differs from the plans')
  const reason = item.reason_kind ? REASON_WORDS[item.reason_kind] ?? '' : ''
  if (reason && !bits.includes(reason)) bits.push(reason)
  const note = (item.reason_note ?? '').trim()
  if (note) bits.push(note)
  const lead = leadTimeWords(item.lead_time_days)
  if (lead) bits.push(lead)
  if (bits.length === 0) return ''
  const first = bits[0] ?? ''
  const sentence = [first.charAt(0).toUpperCase() + first.slice(1), ...bits.slice(1)].join(' · ')
  return sentence.endsWith('.') ? sentence : `${sentence}.`
}

export function roomRowFrom(item: RoomItemSource): RoomRow {
  const kind = roomKindOf(item.status)
  const plans = join([join([item.specified_manufacturer, item.specified_model], ' '), item.specified_description])
  const proposed = (item.submitted_label ?? '').trim() || join([item.submitted_manufacturer, item.submitted_model], ' ')
  const kindOf = (v: string | null): 'approved' | 'revise' | 'rejected' | null => (v === 'approved' || v === 'revise' || v === 'rejected' ? v : null)
  const decided = kindOf(item.review_decision)
  const decision = decided ? { kind: decided, note: item.review_note, byName: item.reviewed_by_name, byPersonId: item.reviewed_by_person_id, at: item.reviewed_at } : null
  return {
    id: item.id,
    tag: item.tag.trim(),
    kind,
    plans,
    proposed,
    why: kind === 'differs' ? whySentence(item) : kind === 'added' ? 'Required by the fixture; the plans leave it to the contractor.' : kind === 'not_quoted' ? 'No product yet — to follow.' : '',
    performanceChange: item.status === 'design_change',
    sheetPages: (item.sheet_pages ?? []).length,
    decision,
  }
}

export type RoomRevision = {
  id: string
  rev: number
  sharedAt: string | null
  current: boolean
  hasPackage: boolean
  rows: RoomRow[]
  /** The differing rows first, then not-quoted and added; the matching rows are the fold. */
  counts: { total: number; matches: number; differs: number; notQuoted: number; added: number; decided: number; open: number }
}

export function roomCounts(rows: ReadonlyArray<RoomRow>): RoomRevision['counts'] {
  const c = { total: rows.length, matches: 0, differs: 0, notQuoted: 0, added: 0, decided: 0, open: 0 }
  for (const r of rows) {
    if (r.kind === 'matches') c.matches += 1
    else if (r.kind === 'differs') c.differs += 1
    else if (r.kind === 'not_quoted') c.notQuoted += 1
    else c.added += 1
    if (r.decision) c.decided += 1
    else if (r.kind === 'differs') c.open += 1
  }
  return c
}

/** Differing rows first (in tag order), then added, then not quoted; the matching rows keep their order for the fold. */
export function roomRowsFrom(items: ReadonlyArray<RoomItemSource>): RoomRow[] {
  const sorted = [...items].sort((a, b) => a.sequence_order - b.sequence_order)
  const rows = sorted.map(roomRowFrom)
  const order: Record<RoomRowKind, number> = { differs: 0, added: 1, not_quoted: 2, matches: 3 }
  return rows.map((r, i) => ({ r, i })).sort((a, b) => order[a.r.kind] - order[b.r.kind] || a.i - b.i).map((x) => x.r)
}

/** "3 rows need a call" · "Everything matches the plans" · "2 to go". */
export function roomHeadline(c: RoomRevision['counts']): string {
  if (c.total === 0) return 'Nothing to review yet'
  if (c.differs === 0) return c.notQuoted > 0 ? 'Everything quoted matches the plans' : 'Everything matches the plans'
  if (c.open === 0) return `All ${c.differs} decided — thank you`
  return `${c.open} row${c.open === 1 ? '' : 's'} need${c.open === 1 ? 's' : ''} a call`
}

/** The sentence under the headline. */
export function roomSubline(c: RoomRevision['counts']): string {
  const parts: string[] = []
  if (c.matches > 0) parts.push(`${c.matches} row${c.matches === 1 ? '' : 's'} match the plans and ${c.matches === 1 ? 'is' : 'are'} marked approved`)
  if (c.differs > 0) parts.push(`${c.differs} differ${c.differs === 1 ? 's' : ''} — each says why`)
  if (c.notQuoted > 0) parts.push(`${c.notQuoted} ${c.notQuoted === 1 ? 'has' : 'have'} no product yet`)
  if (c.added > 0) parts.push(`${c.added} ${c.added === 1 ? 'is' : 'are'} accessor${c.added === 1 ? 'y' : 'ies'} the plans leave to us`)
  return parts.length ? `${parts.join('. ')}.` : ''
}

export type RoomPerson = { id: string; name: string; role: RoomRole; mayDecide: boolean; /** Asks in the last hour (stage 5a) — the page greys Ask at the cap. */ messagesThisHour?: number }

/** One entry of the room's thread (stage 5a): an ask, the office's answer, or a system line. Never a staff name. */
export type RoomMessage = {
  id: string
  at: string
  authorKind: 'office' | 'reviewer' | 'watcher' | 'system' | 'robot'
  /** The person's name; the company for office entries; null for system entries. */
  authorName: string | null
  body: string
  kind: 'message' | 'reply' | 'decision' | 'shared'
  revNumber: number | null
  tags: string[]
}

export type SubmittalRoomPayload = {
  status: 'open' | 'closed'
  closedAt: string | null
  bid: { label: string; projectName: string; address: string | null }
  company: { name: string; tagline: string; phone: string }
  person: RoomPerson | null
  revisions: RoomRevision[]
  /** Oldest first. Absent on a closed room. */
  messages?: RoomMessage[]
}

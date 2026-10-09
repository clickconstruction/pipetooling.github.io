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
  /** 2026-10-02 · the office buys it and the GC never sees it: the row never reaches the room. */
  order_only?: boolean | null
  /** v2.5023 (decision 11): on a design change, whose call it is, and the sign-off the office recorded. */
  call_by?: string | null
  signoff_name?: string | null
  signoff_on?: string | null
  signoff_via?: string | null
}

/**
 * A part of a row (2026-10-01, `bid_submittal_item_parts`), as the functions read it. Only the
 * parts the GC sees reach the room; an order-only part (trim) never does.
 */
export type RoomPartSource = {
  id: string
  item_id: string
  sequence_order: number
  label: string
  quantity: number | string
  on_submittal: boolean
  review_decision: string | null
  review_note: string | null
  reviewed_by_name: string | null
  reviewed_by_email?: string | null
  reviewed_by_person_id: string | null
  reviewed_at: string | null
  decision_source?: string | null
  decision_entered_by?: string | null
  decision_entered_by_name?: string | null
  /** The part's line on the procurement log (2026-10-01). */
  procure_key?: string | null
}

/** One part on the GC's card: read model first, with its own call. */
export type RoomPart = {
  id: string
  label: string
  /** The maker and model ("TOTO CT728CUVG#01"); `words` is the catalog name after it. */
  head: string
  words: string
  /** How many go on one fixture. */
  quantity: number
  decision: RoomRow['decision']
  /** The call came forward from the revision before (an approved part on a resubmitted row). */
  carried?: boolean
  /** The part's line on the procurement log card. */
  procureKey?: string | null
}

/**
 * A part's label read model first: the maker and the model number, then the catalog words. The
 * head runs to the first word with a digit in it, within the first three words; a label with no
 * model number up front is all head ("ELKAY APRON").
 */
export function splitPartLabel(label: string | null | undefined): { head: string; words: string } {
  const tokens = (label ?? '').trim().split(/\s+/).filter(Boolean)
  const at = tokens.slice(0, 3).findIndex((t) => /\d/.test(t))
  if (at < 0) return { head: tokens.join(' '), words: '' }
  return { head: tokens.slice(0, at + 1).join(' '), words: tokens.slice(at + 1).join(' ') }
}

type DecisionKind3 = 'approved' | 'revise' | 'rejected'
const asKind = (v: string | null | undefined): DecisionKind3 | null => (v === 'approved' || v === 'revise' || v === 'rejected' ? v : null)

/**
 * A row's call from its parts' calls (the parts the GC sees). A part sent back sends the row
 * back at once — Reject over Revise — even while other parts wait; a row is Approved when every
 * part is; otherwise it is open. The note names the parts that carry one; the name and time are
 * the latest call's. Every column null while the row is open.
 */
export function rollUpPartDecisions(parts: ReadonlyArray<Pick<RoomPartSource, 'label' | 'sequence_order' | 'on_submittal' | 'review_decision' | 'review_note' | 'reviewed_by_name' | 'reviewed_by_email' | 'reviewed_by_person_id' | 'reviewed_at' | 'decision_source' | 'decision_entered_by' | 'decision_entered_by_name'>>): {
  review_decision: DecisionKind3 | null
  review_note: string | null
  reviewed_by_name: string | null
  reviewed_by_email: string | null
  reviewed_by_person_id: string | null
  reviewed_at: string | null
  decision_source: 'room' | 'entered' | 'robot'
  decision_entered_by: string | null
  decision_entered_by_name: string | null
} {
  const open = { review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, reviewed_at: null, decision_source: 'room' as const, decision_entered_by: null, decision_entered_by_name: null }
  const on = [...parts].filter((p) => p.on_submittal).sort((a, b) => a.sequence_order - b.sequence_order)
  if (on.length === 0) return open
  const kinds = on.map((p) => asKind(p.review_decision))
  const decision: DecisionKind3 | null = kinds.includes('rejected') ? 'rejected' : kinds.includes('revise') ? 'revise' : kinds.every((k) => k === 'approved') ? 'approved' : null
  if (!decision) return open
  const decided = on.filter((p) => asKind(p.review_decision))
  const latest = [...decided].sort((a, b) => String(b.reviewed_at ?? '').localeCompare(String(a.reviewed_at ?? '')))[0]!
  const notes = on.filter((p) => (p.review_note ?? '').trim()).map((p) => `${splitPartLabel(p.label).head}: ${(p.review_note ?? '').trim()}`)
  const src = latest.decision_source === 'entered' || latest.decision_source === 'robot' ? latest.decision_source : 'room'
  return {
    review_decision: decision,
    review_note: notes.length > 0 ? notes.join(' · ') : null,
    reviewed_by_name: latest.reviewed_by_name ?? null,
    reviewed_by_email: latest.reviewed_by_email ?? null,
    reviewed_by_person_id: latest.reviewed_by_person_id ?? null,
    reviewed_at: latest.reviewed_at ?? null,
    decision_source: src,
    decision_entered_by: src === 'room' ? null : latest.decision_entered_by ?? null,
    decision_entered_by_name: src === 'room' ? null : latest.decision_entered_by_name ?? null,
  }
}

/** The customer's four words. */
export type RoomRowKind = 'matches' | 'differs' | 'not_quoted' | 'added' | 'proposed'

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
  /** v2.5023: on a design change, whose call it is and the sign-off, in one line; absent when nothing is recorded. */
  designCall?: string
  /** How many sheet pages this row carries in the package (0 = to follow). */
  sheetPages: number
  decision: { kind: 'approved' | 'revise' | 'rejected'; note: string | null; byName: string | null; byPersonId: string | null; at: string | null } | null
  /** The pick's lead time in days (0 = in stock), for the procurement card (v2.4087). */
  leadTimeDays?: number | null
  /** The parts the GC sees, each with its own call (2026-10-01); absent on a row with no parts. */
  parts?: RoomPart[]
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
    case 'proposed':
      return 'proposed'
    default:
      return 'differs'
  }
}

/** Whose call a design change is (decision 11, the owner's call of 2026-10-09). */
export type DesignCallBy = 'architect' | 'engineer' | 'gc' | 'owner'
export const DESIGN_CALL_BY: ReadonlyArray<DesignCallBy> = ['architect', 'engineer', 'gc', 'owner']
export const DESIGN_CALL_BY_LABELS: Record<DesignCallBy, string> = { architect: 'Architect', engineer: 'Engineer', gc: 'GC', owner: 'Owner' }
const DESIGN_CALL_WORDS: Record<DesignCallBy, string> = { architect: "The architect's call", engineer: "The engineer's call", gc: "The GC's call", owner: "The owner's call" }
export function asDesignCallBy(v: unknown): DesignCallBy | null {
  return typeof v === 'string' && (DESIGN_CALL_BY as ReadonlyArray<string>).includes(v) ? (v as DesignCallBy) : null
}

/** How a design change's sign-off came. */
export type SignoffVia = 'email' | 'letter' | 'stamped_drawing' | 'meeting' | 'phone'
export const SIGNOFF_VIA: ReadonlyArray<SignoffVia> = ['email', 'letter', 'stamped_drawing', 'meeting', 'phone']
export const SIGNOFF_VIA_LABELS: Record<SignoffVia, string> = { email: 'Email', letter: 'Letter', stamped_drawing: 'Stamped drawing', meeting: 'Meeting', phone: 'Phone' }
const SIGNOFF_VIA_WORDS: Record<SignoffVia, string> = { email: 'by email', letter: 'by letter', stamped_drawing: 'on a stamped drawing', meeting: 'in a meeting', phone: 'by phone' }
export function asSignoffVia(v: unknown): SignoffVia | null {
  return typeof v === 'string' && (SIGNOFF_VIA as ReadonlyArray<string>).includes(v) ? (v as SignoffVia) : null
}

/** 'Oct 9, 2026' from a stored day; '' for anything else. */
function signoffDay(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ''
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/**
 * A design-change card's line (decision 11): whose call it is, and the sign-off the office
 * recorded — "The engineer's call · signed off by Pat Lee on Oct 9, 2026, by email." Null on any
 * other row, or when nothing is recorded.
 */
export function designCallLine(item: Pick<RoomItemSource, 'status' | 'call_by' | 'signoff_name' | 'signoff_on' | 'signoff_via'>): string | null {
  if (item.status !== 'design_change') return null
  const call = asDesignCallBy(item.call_by)
  const name = (item.signoff_name ?? '').trim()
  const day = signoffDay(item.signoff_on)
  const via = asSignoffVia(item.signoff_via)
  const signedBits = [name ? `by ${name}` : '', day ? `on ${day}` : ''].filter(Boolean).join(' ')
  const signed = name || day || via ? ['signed off', signedBits].filter(Boolean).join(' ') + (via ? `${signedBits ? ',' : ''} ${SIGNOFF_VIA_WORDS[via]}` : '') : ''
  const parts = [call ? DESIGN_CALL_WORDS[call] : '', signed].filter(Boolean)
  if (parts.length === 0) return null
  const first = parts[0] ?? ''
  return `${[first.charAt(0).toUpperCase() + first.slice(1), ...parts.slice(1)].join(' · ')}.`
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

/** The GC's parts of a row, model first, each with its own call. */
export function roomPartsFrom(parts: ReadonlyArray<RoomPartSource>): RoomPart[] {
  return [...parts]
    .filter((p) => p.on_submittal)
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .map((p) => {
      const d = asKind(p.review_decision)
      const { head, words } = splitPartLabel(p.label)
      return {
        id: p.id,
        label: p.label.trim(),
        head,
        words,
        quantity: Number(p.quantity) || 0,
        decision: d ? { kind: d, note: p.review_note, byName: p.reviewed_by_name, byPersonId: p.reviewed_by_person_id, at: p.reviewed_at } : null,
        ...(p.decision_source === 'carried' ? { carried: true } : {}),
        ...(p.procure_key ? { procureKey: p.procure_key } : {}),
      }
    })
}

export function roomRowFrom(item: RoomItemSource, parts: ReadonlyArray<RoomPartSource> = []): RoomRow {
  const kind = roomKindOf(item.status)
  const plans = join([join([item.specified_manufacturer, item.specified_model], ' '), item.specified_description])
  const proposed = (item.submitted_label ?? '').trim() || join([item.submitted_manufacturer, item.submitted_model], ' ')
  const decided = asKind(item.review_decision)
  const decision = decided ? { kind: decided, note: item.review_note, byName: item.reviewed_by_name, byPersonId: item.reviewed_by_person_id, at: item.reviewed_at } : null
  const gcParts = roomPartsFrom(parts)
  const designCall = designCallLine(item)
  return {
    id: item.id,
    tag: item.tag.trim(),
    kind,
    plans,
    proposed,
    why: kind === 'differs' ? whySentence(item) : kind === 'added' ? 'Required by the fixture; the plans leave it to the contractor.' : kind === 'not_quoted' ? 'No product yet — to follow.' : kind === 'proposed' ? 'This is the product we intend to install.' : '',
    performanceChange: item.status === 'design_change',
    ...(designCall ? { designCall } : {}),
    sheetPages: (item.sheet_pages ?? []).length,
    decision,
    leadTimeDays: item.lead_time_days ?? null,
    ...(gcParts.length > 0 ? { parts: gcParts } : {}),
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
  counts: { total: number; matches: number; differs: number; notQuoted: number; added: number; proposed?: number; decided: number; open: number }
}

export function roomCounts(rows: ReadonlyArray<RoomRow>): RoomRevision['counts'] {
  const c = { total: rows.length, matches: 0, differs: 0, notQuoted: 0, added: 0, proposed: 0, decided: 0, open: 0 }
  for (const r of rows) {
    if (r.kind === 'matches') c.matches += 1
    else if (r.kind === 'differs') c.differs += 1
    else if (r.kind === 'not_quoted') c.notQuoted += 1
    else if (r.kind === 'proposed') c.proposed += 1
    else c.added += 1
    if (r.decision) c.decided += 1
    else if (r.kind === 'differs' || r.kind === 'proposed') c.open += 1
  }
  return c
}

/** The rows that leave the office (2026-10-02): every row but the order-only ones, which the GC never sees or calls. */
export function gcRoomItems<T extends { order_only?: boolean | null }>(items: ReadonlyArray<T>): T[] {
  return items.filter((it) => it.order_only !== true)
}

/**
 * The tags whose procurement lines stay in the office: the order-only rows of the newest shared
 * revision. The log's lines carry their row's tag, a part's line too, so the tag is the filter.
 */
export function officeOnlyTags(items: ReadonlyArray<{ tag: string; submittal_id: string; order_only?: boolean | null }>, newestSubmittalId: string | null | undefined): Set<string> {
  return new Set(items.filter((it) => it.order_only === true && it.submittal_id === newestSubmittalId).map((it) => it.tag))
}

/** Differing rows first (in tag order), then added, then not quoted; the matching rows keep their order for the fold. Order-only rows are left out. */
export function roomRowsFrom(items: ReadonlyArray<RoomItemSource>, partsByItem: ReadonlyMap<string, ReadonlyArray<RoomPartSource>> = new Map()): RoomRow[] {
  // An order-only row is the office's alone (2026-10-02): no room, no preview and no count reads it.
  const sorted = gcRoomItems(items).sort((a, b) => a.sequence_order - b.sequence_order)
  const rows = sorted.map((it) => roomRowFrom(it, partsByItem.get(it.id) ?? []))
  const order: Record<RoomRowKind, number> = { differs: 0, proposed: 1, added: 2, not_quoted: 3, matches: 4 }
  return rows.map((r, i) => ({ r, i })).sort((a, b) => order[a.r.kind] - order[b.r.kind] || a.i - b.i).map((x) => x.r)
}

/**
 * "3 products need your answer" · "Everything matches the plans" · "All 3 decided — thank you".
 * The GC reads this (2026-10-03): it asks in their words, and "call" was ours.
 */
export function roomHeadline(c: RoomRevision['counts']): string {
  if (c.total === 0) return 'Nothing to review yet'
  const asks = c.differs + (c.proposed ?? 0)
  if (asks === 0) return c.notQuoted > 0 ? 'Everything quoted matches the plans' : 'Everything matches the plans'
  if (c.open === 0) return `All ${asks} decided — thank you`
  return `${c.open} product${c.open === 1 ? '' : 's'} need${c.open === 1 ? 's' : ''} your answer`
}

/** The sentence under the headline. */
export function roomSubline(c: RoomRevision['counts']): string {
  const parts: string[] = []
  if (c.matches > 0) parts.push(`${c.matches} product${c.matches === 1 ? ' matches' : 's match'} the plans and ${c.matches === 1 ? 'is' : 'are'} marked approved`)
  if (c.differs > 0) parts.push(`${c.differs} differ${c.differs === 1 ? 's' : ''} — each says why`)
  // 2026-10-03 · a row built from the takeoff: say what it is. "The plans' schedule was not on the bid" read as an admission, on every card, and was untrue on a bid whose schedule simply lacked the tag.
  if ((c.proposed ?? 0) > 0) parts.push(`${c.proposed} ${c.proposed === 1 ? 'is a product' : 'are products'} we intend to install`)
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

/**
 * The procurement log's pieces for the GC's room card (v2.4087): the office's records
 * without the PO or the house, the takeoff's count rows and stage splits (the page works
 * out each tag's stage), the job's stage dates, and when the office last sent an update.
 */
export type RoomProcurement = {
  records: Array<{ tag: string | null; /** 2026-10-01 · a part's line */ partKey?: string | null; label: string; leadTimeDays: number | null; stage: string | null; orderedOn: string | null; expectedOn: string | null; deliveredOn: string | null; note: string; sortOrder: number }>
  countRows: Array<{ id: string; fixture: string | null }>
  splits: Array<{ countRowId: string; lineId: string | null; partId: string | null; roughIn: number; topOut: number; trimSet: number; source: string }>
  stageDates: Record<string, string>
  lastUpdateAt: string | null
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
  /** The procurement card's pieces (v2.4087). Absent on a closed room or when the office has no log yet. */
  procurement?: RoomProcurement
}

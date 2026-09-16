/**
 * The review room's write actions, the pure part (Submittals stage 4a-ii): what a
 * request must carry to identify a person or decide on rows, and the rules that say
 * whether a decision may land — the room open, the person allowed to decide, the
 * revision the newest shared one. Dependency-free so the app tests it as a twin
 * (`src/lib/submittals/submittalReviewActions.test.ts`) and the function only wires
 * the database around it.
 */
import { asRoomRole, type RoomRole } from './submittalRoomPayload.ts'

export type DecisionKind = 'approved' | 'revise' | 'rejected'
export const DECISION_KINDS: ReadonlyArray<DecisionKind> = ['approved', 'revise', 'rejected']

export const NAME_MAX = 120
export const EMAIL_MAX = 254
export const NOTE_MAX = 2000
export const DECISIONS_MAX = 500
/** Identifications from one address per room per hour. */
export const IDENTIFY_PER_HOUR = 20

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  if (!e || e.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null
  return e
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const n = raw.replace(/\s+/g, ' ').trim()
  if (!n || n.length > NAME_MAX) return null
  return n
}

export type IdentifyBody = { token: string; name: string; email: string; role: RoomRole; viaToken: string | null; honeypot: boolean }

/** `{ action: 'identify', token, name, email, role, viaToken? }` — the honeypot field `website` must be empty. */
export function parseIdentifyBody(body: unknown): { ok: true; value: IdentifyBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'A name and an email are needed.' }
  const b = body as Record<string, unknown>
  const token = typeof b.token === 'string' ? b.token.trim() : ''
  if (!token) return { ok: false, error: 'This link is incomplete.' }
  const name = cleanName(b.name)
  if (!name) return { ok: false, error: 'Tell us your name.' }
  const email = normalizeEmail(b.email)
  if (!email) return { ok: false, error: 'That email does not look right.' }
  const honeypot = typeof b.website === 'string' && b.website.trim() !== ''
  const viaToken = typeof b.viaToken === 'string' && b.viaToken.trim() ? b.viaToken.trim() : null
  return { ok: true, value: { token, name, email, role: asRoomRole(b.role), viaToken, honeypot } }
}

export type DecideBody = { token: string; submittalId: string; decisions: Array<{ itemId: string; decision: DecisionKind; note: string | null }> }

/** `{ action: 'decide', token (personal), submittalId, decisions: [{ itemId, decision, note? }] }` */
export function parseDecideBody(body: unknown): { ok: true; value: DecideBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Nothing to record.' }
  const b = body as Record<string, unknown>
  const token = typeof b.token === 'string' ? b.token.trim() : ''
  if (!token) return { ok: false, error: 'Tell us who you are first.' }
  const submittalId = typeof b.submittalId === 'string' ? b.submittalId.trim() : ''
  if (!submittalId) return { ok: false, error: 'Which revision?' }
  if (!Array.isArray(b.decisions) || b.decisions.length === 0) return { ok: false, error: 'Nothing to record.' }
  if (b.decisions.length > DECISIONS_MAX) return { ok: false, error: 'Too many rows at once.' }
  const decisions: DecideBody['decisions'] = []
  for (const raw of b.decisions) {
    if (!raw || typeof raw !== 'object') continue
    const d = raw as Record<string, unknown>
    const itemId = typeof d.itemId === 'string' ? d.itemId.trim() : ''
    const decision = typeof d.decision === 'string' && (DECISION_KINDS as ReadonlyArray<string>).includes(d.decision) ? (d.decision as DecisionKind) : null
    if (!itemId || !decision) continue
    const note = typeof d.note === 'string' ? d.note.trim().slice(0, NOTE_MAX) : ''
    decisions.push({ itemId, decision, note: note || null })
  }
  if (decisions.length === 0) return { ok: false, error: 'Nothing to record.' }
  return { ok: true, value: { token, submittalId, decisions } }
}

export type DecideContext = {
  roomStatus: string
  personClosed: boolean
  mayDecide: boolean
  /** The revision the decisions are for, and whether it belongs to this room's bid and was shared. */
  submittalBelongs: boolean
  submittalShared: boolean
  /** The newest shared revision on the bid. */
  currentSubmittalId: string | null
  submittalId: string
}

export type DecideVerdict = { ok: true } | { ok: false; status: 403 | 404 | 409 | 410; code: 'closed' | 'watching' | 'not_found' | 'stale_revision'; error: string }

/** The rules, in the order the person would hear them. */
export function decideVerdict(c: DecideContext): DecideVerdict {
  if (c.roomStatus === 'closed' || c.personClosed) return { ok: false, status: 410, code: 'closed', error: 'This review is closed.' }
  if (!c.submittalBelongs || !c.submittalShared) return { ok: false, status: 404, code: 'not_found', error: 'That revision is not on this link.' }
  if (!c.mayDecide) return { ok: false, status: 403, code: 'watching', error: 'Your link is for watching — the decisions are someone else\'s to make. Ask us if that is wrong.' }
  if (c.currentSubmittalId && c.currentSubmittalId !== c.submittalId) return { ok: false, status: 409, code: 'stale_revision', error: 'A newer revision has been shared since you opened this page. Reload to see it.' }
  return { ok: true }
}

/** How a self-identified person relates to the room: a pre-named row by email, the same person again, or new. */
export type IdentifyResolution = { kind: 'existing'; personId: string } | { kind: 'new'; how: 'identified' | 'forwarded' }
export function resolveIdentify(args: { existingByEmail: { id: string } | null; viaPerson: { id: string; email: string } | null; email: string }): IdentifyResolution {
  if (args.existingByEmail) return { kind: 'existing', personId: args.existingByEmail.id }
  if (args.viaPerson && args.viaPerson.email.toLowerCase() === args.email) return { kind: 'existing', personId: args.viaPerson.id }
  return { kind: 'new', how: args.viaPerson ? 'forwarded' : 'identified' }
}

/** "19 approved · 2 revise · 1 rejected" */
export function decisionCounts(decisions: ReadonlyArray<{ decision: DecisionKind }>): { approved: number; revise: number; rejected: number } {
  const c = { approved: 0, revise: 0, rejected: 0 }
  for (const d of decisions) c[d.decision] += 1
  return c
}

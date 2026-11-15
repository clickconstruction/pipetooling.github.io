/**
 * Reminding the leader of the papers that wait on an approval (v2.7371, punch list #362, step 2; Taunya's ask of 2026-11-15
 * that *Waiting on the leader* be something a person can act on).
 *
 * The office's waiting rows had one press each, *Open*, and nothing to do but wait. The head over them now carries
 * one press for the lot. It sends again what the send for approval sent: the leader's phone buzzes, or the same
 * words go by email (`notify-lien-approval`). A notice is one message each, as its send was; the affidavits are one
 * message that names the count, as theirs was. Nothing on a paper changes.
 *
 * Pure: which papers the press acts on and which it leaves with a reason, and every word a person reads before
 * and after. The sending is the desk's, through `tellLeaderOfLienApproval` and `tellLeaderOfLienAffidavits`.
 */

export type LienReminderPaper = {
  kind: 'notice' | 'affidavit' | 'retainage'
  /** The job as the row names it. */
  label: string
  /** The paper's desk item; null when the desk has none to point at. */
  itemId: string | null
  /** The paper's last day, for the message. */
  dueYmd: string | null
}

export type LienReminderSend = { itemId: string; dueYmd: string | null; label: string }

export type LienReminderPlan = {
  /** One message each. */
  notices: LienReminderSend[]
  /** One message for the lot. */
  affidavits: LienReminderSend[]
  /** What the press leaves where it is, each with its reason. */
  held: Array<{ label: string; reason: string }>
  /** Papers the press acts on. */
  ready: number
}

export const LIEN_REMINDER_HOLDS = {
  noItem: 'has no paper on the desk to point at',
  retainage: 'is a retainage notice, which has no message yet',
} as const

export function lienReminderPlan(papers: ReadonlyArray<LienReminderPaper>): LienReminderPlan {
  const notices: LienReminderSend[] = []
  const affidavits: LienReminderSend[] = []
  const held: LienReminderPlan['held'] = []
  for (const p of papers) {
    if (p.kind === 'retainage') held.push({ label: p.label, reason: LIEN_REMINDER_HOLDS.retainage })
    else if (!p.itemId) held.push({ label: p.label, reason: LIEN_REMINDER_HOLDS.noItem })
    else (p.kind === 'notice' ? notices : affidavits).push({ itemId: p.itemId, dueYmd: p.dueYmd, label: p.label })
  }
  return { notices, affidavits, held, ready: notices.length + affidavits.length }
}

/** The leader by first name as a sentence starts with it, or *The leader*. */
function who(leader: string | null | undefined): { name: string; start: string } {
  const first = (leader ?? '').trim().split(/\s+/)[0] ?? ''
  if (!first) return { name: 'the leader', start: 'The leader' }
  const name = `${first[0]!.toUpperCase()}${first.slice(1)}`
  return { name, start: name }
}

const papers = (n: number) => `${n} ${n === 1 ? 'paper' : 'papers'}`

export type LienReminderWords = {
  /** The press on the head: *Remind Malachi of 3 papers*. */
  button: string
  /** Nothing to remind him of: the press is dead. */
  dead: boolean
  /** The confirm window's title. */
  title: string
  /** The confirm window's sentences. */
  message: string
  /** The confirm window's press: the act, never OK. */
  confirmLabel: string
}

/** The press and its confirm window. `reminded` is when this session last sent the same reminder: the press then reads that, and is dead. */
export function lienReminderWords(plan: LienReminderPlan, leader: string | null | undefined, reminded?: string | null): LienReminderWords {
  const w = who(leader)
  const n = plan.ready
  const said = reminded?.trim()
  const button = said ? `Reminded at ${said}` : n > 0 ? `Remind ${w.name} of ${papers(n)}` : `Remind ${w.name}`
  const list = [...plan.notices, ...plan.affidavits].map((p) => p.label).join(', ')
  const messages = [
    plan.notices.length ? `${w.start} gets one message for ${plan.notices.length === 1 ? 'the notice' : `each of the ${plan.notices.length} notices`}.` : '',
    plan.affidavits.length ? `${w.start} gets one message for the ${plan.affidavits.length === 1 ? 'affidavit' : `${plan.affidavits.length} affidavits`}.` : '',
  ].filter(Boolean)
  const heldLine = plan.held.length ? `${plan.held.length} ${plan.held.length === 1 ? 'stays' : 'stay'} out: ${plan.held.map((h) => `${h.label} ${h.reason}`).join(', ')}.` : ''
  return {
    button,
    dead: n === 0 || Boolean(said),
    title: `Remind ${w.name} of ${papers(n)}?`,
    message: [list ? `${list}.` : '', ...messages, `It goes to ${w.name}’s phone, or by email. Nothing on the papers changes.`, heldLine].filter(Boolean).join(' '),
    confirmLabel: `Remind ${w.name}`,
  }
}

/** After the press: what reached him and what did not, each failure with its reason. The press keeps going past one that fails. */
export function lienReminderOutcome(result: { done: number; failed: ReadonlyArray<{ label: string; reason: string }> }, leader: string | null | undefined): { line: string; tone: 'success' | 'warning' | 'error' } {
  const w = who(leader)
  const took = result.done > 0 ? `${w.start} was reminded of ${papers(result.done)}.` : `${w.start} was not reminded.`
  if (result.failed.length === 0) return { line: took, tone: 'success' }
  const n = result.failed.length
  return { line: `${took} ${n} ${n === 1 ? 'reminder' : 'reminders'} did not send: ${result.failed.map((f) => `${f.label} (${f.reason})`).join(', ')}.`, tone: result.done > 0 ? 'warning' : 'error' }
}

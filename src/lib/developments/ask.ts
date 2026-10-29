/**
 * Ask a question from the Development page (punch list #208 PR 4): the words and the row. A question
 * is an `estimator_requests` or `dispatch_requests` row, the lane's own shape, with one reference:
 * the site (`development_id`), or one job or bid on it. Pure; the write is `askWrites.ts`.
 */
export type AskLane = 'estimators' | 'dispatch'

export type AskAbout = { kind: 'site' } | { kind: 'job'; id: string; label: string } | { kind: 'bid'; id: string; label: string }

export type AskDraft = { lane: AskLane; about: AskAbout; title: string }

export const ASK_LANES: ReadonlyArray<{ key: AskLane; label: string; verb: string; who: string }> = [
  { key: 'estimators', label: 'The estimators', verb: 'Ask the estimators', who: 'a bid, its plans, its price' },
  { key: 'dispatch', label: 'Dispatch', verb: 'Ask Dispatch', who: 'a crew, a day on site' },
]

export const ASK_TITLE_MAX = 500

/** The inbox's reference line: the site with the house, or the piece's number and name. */
export function askReferenceSummary(about: AskAbout, siteName: string): string {
  return about.kind === 'site' ? `🏠 ${siteName}` : about.label
}

/** A draft can go when it asks something, not too long. */
export function askIsSendable(draft: Pick<AskDraft, 'title'>): boolean {
  const t = draft.title.trim()
  return t.length > 0 && t.length <= ASK_TITLE_MAX
}

export type AskRow = { from_user_id: string; title: string; links: string[]; development_id: string | null; job_ledger_id: string | null; bid_id: string | null; reference_summary: string }

/** The row the lane's table takes: the asker, the question, one reference and the inbox's words for it. */
export function askRow(draft: AskDraft, developmentId: string, siteName: string, fromUserId: string): AskRow {
  return {
    from_user_id: fromUserId,
    title: draft.title.trim(),
    links: [],
    development_id: draft.about.kind === 'site' ? developmentId : null,
    job_ledger_id: draft.about.kind === 'job' ? draft.about.id : null,
    bid_id: draft.about.kind === 'bid' ? draft.about.id : null,
    reference_summary: askReferenceSummary(draft.about, siteName),
  }
}

/** The Plans card's ask, pre-written: which set the pieces on an older set or none build from. */
export function askTitleForPlans(n: number): string {
  return `${n} ${n === 1 ? 'piece is' : 'pieces are'} on an older plan set or none: which set do we build from?`
}

/** The toast after a send. */
export function askSentWords(draft: AskDraft, siteName: string): string {
  const to = draft.lane === 'dispatch' ? 'Dispatch' : 'the estimators'
  const about = draft.about.kind === 'site' ? siteName : draft.about.label
  return `Asked ${to} about ${about}. The answer comes back here, under Questions.`
}

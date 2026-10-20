/**
 * The stage's lines first (v2.5629, punch list #124 PR 2): a job's box opens on the quick replies for the job's stage,
 * so the right words are one press away from the Pipeline's door. The stages map to the Residential customer flow's
 * steps the way the board's moves do (`flows/stageSends.ts`): Working to Working, Ready to Bill to Done, Billed
 * Awaiting Payment to Paid (the reminder) and then Billed, Paid to Paid. Where the team keeps no line on a stage's
 * step, the app's own words for that moment stand in as a chip (`tellCustomer`'s `DEFAULT_LINES`), so the chip is
 * never empty; the Paid step has no app words, so its chip waits for the team's line. Pure.
 */
import type { QuickReply } from '../quickReplies/kernel'
import { DEFAULT_LINES, MOVE_MOMENTS, type MoveMoment } from '../tellCustomer/tellCustomer'

/** The Residential customer flow's steps a Pipeline stage speaks to, first first. */
export const STAGE_STEP_IDS: Readonly<Record<string, readonly string[]>> = {
  working: ['working'],
  ready_to_bill: ['done'],
  billed: ['paid', 'billed'],
  paid: ['paid'],
}

/** The steps for a job's status; none for Waiting or a status the board does not know. */
export function stageStepIds(status: string | null | undefined): readonly string[] {
  return (status && STAGE_STEP_IDS[status]) || []
}

/** An app line's id starts with this; it is never written, pressed into the count, or edited. */
export const APP_LINE_PREFIX = 'app:'

export function isAppLine(q: Pick<QuickReply, 'id'>): boolean {
  return q.id.startsWith(APP_LINE_PREFIX)
}

/** The app's own line for a stage's step, or null for a step with no app words. */
export function appLineFor(stepId: string): QuickReply | null {
  if (!(MOVE_MOMENTS as readonly string[]).includes(stepId)) return null
  const words = DEFAULT_LINES[stepId as MoveMoment]
  return { id: `${APP_LINE_PREFIX}${stepId}`, text: words.text, textEs: words.textEs, for: 'customer', stepId, scope: 'team', addedBy: 'app', addedAt: 0, removed: false, uses: {}, lastUsed: null }
}

/** The app's lines a job's box adds for its stage: one per step the team keeps no line on. */
export function appLinesForStage(stepIds: readonly string[], lines: readonly QuickReply[]): QuickReply[] {
  const out: QuickReply[] = []
  for (const id of stepIds) {
    if (lines.some((q) => q.for === 'customer' && q.stepId === id && !q.removed)) continue
    const own = appLineFor(id)
    if (own) out.push(own)
  }
  return out
}

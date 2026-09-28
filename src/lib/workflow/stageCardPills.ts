/**
 * The figures on a folded Workflow stage card's pills: how long the step ran
 * (or has been open), how many line items it carries and what they add up to,
 * and how many words each of its notes holds.
 */

import { sumAmounts } from '../workflowMoneyTotals'
import { daysBetween, daysOpen } from './workflowFormat'

/** Words in a note: runs of non-blank characters. 0 for blank or no text. */
export function wordCount(text: string | null | undefined): number {
  return (text ?? '').trim().split(/\s+/).filter(Boolean).length
}

/** `[1 day] `, `[3 days] `, `[0 days] ` — with its trailing space; '' for no count. */
export function daysPillPrefix(days: number | null): string {
  return days != null ? `[${days === 1 ? '1 day' : `${days} days`}] ` : ''
}

type StepForPills = {
  status: string
  started_at: string | null
  ended_at: string | null
  notes?: string | null
  private_notes?: string | null
  scheduled_start_date?: string | null
  scheduled_end_date?: string | null
}

export type StageCardPills = {
  /** Days open so far for a step in progress, else days from start to end. */
  days: number | null
  daysPrefix: string
  itemCount: number
  itemsTotal: number
  notesWords: number
  privateWords: number
  /** Either expected date is set — the Exp pill shows. */
  hasExpected: boolean
}

export function stageCardPills(
  step: StepForPills,
  items: ReadonlyArray<{ amount: number | null }>,
  now: Date = new Date(),
): StageCardPills {
  const days =
    step.status === 'in_progress'
      ? daysOpen(step.started_at, step.ended_at, now)
      : daysBetween(step.started_at, step.ended_at)
  return {
    days,
    daysPrefix: daysPillPrefix(days),
    itemCount: items.length,
    itemsTotal: sumAmounts(items),
    notesWords: wordCount(step.notes),
    privateWords: wordCount(step.private_notes),
    hasExpected: !!step.scheduled_start_date || !!step.scheduled_end_date,
  }
}

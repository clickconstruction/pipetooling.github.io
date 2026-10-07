import type { LienRuleCite } from './lienRuleCites'
import { describeNoticeMonths } from './lienNoticeDraft'
import { workMonthShort } from './forecastWorkMonths'
import type { LienTimelineStep } from './lienTimeline'

/**
 * A stop's paper (v2.4793, the owner's ask): press a stop's title on the lien timeline and one
 * window opens on what that stop sends — the paper on the left, the stop's facts and its act on
 * the right, ‹ › walking the stops of the same job. This kernel says which paper a stop sends,
 * which rule it points at, and the window's words. The hosts build the pages, since the pages
 * come from the same builders that print them (`LienStopPaperWindow` takes a `paperFor`).
 */

/** Which paper of ours a stop sends; `none` for the stops that are a fact, the owner's hold or counsel's filing. */
export type LienStopPaperKind = 'notice' | 'retainage' | 'affidavit' | 'serve' | 'release' | 'demand' | 'none'

export function lienStopPaperKind(step: Pick<LienTimelineStep, 'kind'>): LienStopPaperKind {
  switch (step.kind) {
    case 'notice':
    case 'retainage':
    case 'affidavit':
    case 'serve':
    case 'release':
    case 'demand':
      return step.kind
    default:
      return 'none'
  }
}

/** The rule the window links, where the rules guide has a row for it. */
export function lienStopRuleCite(step: Pick<LienTimelineStep, 'kind'>): LienRuleCite | null {
  switch (step.kind) {
    case 'last_work':
      return '§ 53.003'
    case 'notice':
      return '§ 53.056'
    case 'affidavit':
    case 'serve':
      return '§ 53.052'
    case 'release':
      return '§ 53.152'
    case 'demand':
      return '§ 38.001'
    default:
      return null
  }
}

/** What the window says for a stop that sends nothing of ours. */
export interface LienStopNoPaperWords {
  /** What happens at this stop. */
  what: string
  /** Whose move it is. */
  who: string
  /** What comes after, or what changes it. */
  after: string
}

export interface LienStopWindowWords {
  /** The small uppercase line — the stop's label. */
  eyebrow: string
  /** `The July and August 2026 notice`, `The lien affidavit`, `Counsel's filing, not our paper`. */
  title: string
  /** One line under the title — the stop's day and standing. */
  line: string
  /** Null when the stop sends a paper; the words that stand in for the page otherwise. */
  noPaper: LienStopNoPaperWords | null
}

export interface LienStopWindowWordsInput {
  step: LienTimelineStep
  /** The months the stop's notice carries, when the host knows the draft; the title names them all. */
  noticeMonths?: ReadonlyArray<string> | null
}

function standing(step: LienTimelineStep): string {
  const parts = [step.opensWords || '', step.dateWords && step.dateWords !== '—' ? step.dateWords : '', step.words || ''].filter(Boolean)
  return parts.join(' · ')
}

export function lienStopWindowWords({ step, noticeMonths }: LienStopWindowWordsInput): LienStopWindowWords {
  const eyebrow = step.label
  switch (step.kind) {
    case 'last_work':
      return {
        eyebrow,
        title: 'The last day of work',
        line: standing(step),
        noPaper: {
          what: 'Nothing goes out at this stop. The last day of work sets every date after it: the months that need a notice, the notice days and the affidavit day all count from it.',
          who: 'The clock hours set it. The office can set it by hand in the job’s Lien window.',
          after: 'Change it and every stop after it moves.',
        },
      }
    case 'notice': {
      const months = noticeMonths && noticeMonths.length && step.monthKey && noticeMonths.includes(step.monthKey) ? noticeMonths.slice().sort() : null
      const title = months ? `The ${describeNoticeMonths(months)} notice` : step.monthKey ? `The ${workMonthShort(step.monthKey)} notice` : 'The § 53.056 notice'
      const line =
        months && months.length > 1
          ? `${describeNoticeMonths(months)} go on one notice. Its day is ${workMonthShort(months[0]!)}’s: ${standing(step)}.`
          : standing(step)
      return { eyebrow, title, line, noPaper: null }
    }
    case 'retainage':
      return { eyebrow, title: 'The § 53.057 retainage notice', line: standing(step), noPaper: null }
    case 'affidavit':
      return { eyebrow, title: 'The lien affidavit', line: standing(step), noPaper: null }
    case 'serve':
      return { eyebrow, title: 'The affidavit, served', line: `A copy of the filed affidavit to the owner and the GC within five days of filing. ${standing(step)}`.trim(), noPaper: null }
    case 'hold':
      return {
        eyebrow,
        title: 'The owner’s 10 % hold',
        line: standing(step),
        noPaper: {
          what: 'Nothing goes out. The owner holds 10 % of the contract price for 30 days after the original contract completes (§ 53.101). A claim that reaches the owner in time is paid from it.',
          who: 'The owner.',
          after: 'When the hold ends, what nobody claimed goes to the GC.',
        },
      }
    case 'suit':
      return {
        eyebrow,
        title: 'Counsel’s filing, not our paper',
        line: standing(step),
        noPaper: {
          what: 'A suit to foreclose the lien must be filed within the year (§ 53.158). The office’s part ends with the affidavit, served.',
          who: 'Counsel. The desk says counsel now when the year is two months from running, and the Legal desk carries the matter from there.',
          after: 'Payment in full and a release of record stop the clock. The release is our paper, the stop after this one on a paid job.',
        },
      }
    case 'release':
      return { eyebrow, title: 'The release of record', line: standing(step), noPaper: null }
    case 'demand':
      return { eyebrow, title: 'The demand letter', line: standing(step), noPaper: null }
  }
}

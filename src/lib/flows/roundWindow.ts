/**
 * A round's window (Messages cut 4, the prototype's v1.168, `roundModal`): what a round pill on a person's flow opens.
 * A change order reads with its facts and Ask again; a pay application with what it covers and its certificate; any
 * other round with its day and Ask again or Remind. Keyed off the step's facts, which never change, not its id. Pure:
 * the facts come from the person's reading, and the money from the money team's rows when the reader may see it,
 * since `flow_rows` carries days and marks only.
 */
import { money, shortDate, weekdayDate } from '../gc/words'
import type { FlowStep, RoundReading } from './state'

/** A change order's own facts, from `gc_change_orders`. The money only when the reader may see it. */
export interface ChangeOrderDetail {
  /** "a sink in exam 3". */
  what: string
  /** What it adds to the contract sum; null when the reader may not see money. */
  adds: number | null
  /** "4 more working days"; null for no change to the finish. */
  days: string | null
  /** The contract sum with the signed changes, before this one; null when the reader may not see money. */
  sumBefore: number | null
  sentOn: string | null
  /** The customer's last open of the paper (helper 8's views); null when they have not opened it. */
  openedOn: string | null
}

/** A pay application's own facts, from `gc_owner_pay_apps`. The money only when the reader may see it. */
export interface PayAppDetail {
  /** "work through Sep 30". */
  covers: string | null
  amount: number | null
  certifiedBy: string | null
  certifiedOn: string | null
  /** With the architect for the certificate since this day, when not yet certified. */
  withArchitect: { name: string; since: string } | null
  paidOn: string | null
  waivers: number | null
  tradesPaidOn: string | null
}

export type RoundAction = { kind: 'ask-again' | 'remind' | 'open' | 'their-page' | 'the-trades'; label: string }

export interface RoundWindow {
  title: string
  /** "Change orders · Dr. Priya Raman". */
  sub: string
  state: { words: string; tone: 'ok' | 'wait' | '' }
  /** One sentence under the state: whether they opened it, or the round's own words. */
  line: string | null
  facts: { label: string; value: string }[]
  actions: RoundAction[]
}

const lastDay = (r: RoundReading): string | null => r.facts.map((f) => f.at).filter((d): d is string => !!d).sort().slice(-1)[0] ?? null

function stateOf(r: RoundReading): RoundWindow['state'] {
  if (r.state === 'done') {
    const day = lastDay(r)
    return { words: day ? `done ${shortDate(day)}` : 'done', tone: 'ok' }
  }
  if (r.state === 'now') return { words: r.day ? r.day.words : r.opened ? `open since ${shortDate(r.opened)}` : 'open', tone: 'wait' }
  return { words: 'not yet', tone: '' }
}

/** A round's window: the person (`who`), their step, the round, and the detail the step's kind has. */
export function roundWindow(
  step: Pick<FlowStep, 'name' | 'who' | 'facts'>,
  round: RoundReading,
  who: { name: string; firstName: string },
  detail: { changeOrder?: ChangeOrderDetail; payApp?: PayAppDetail; theirPage?: boolean } = {},
): RoundWindow {
  const base = { title: round.name, sub: `${step.name} · ${who.name}`, state: stateOf(round) }
  const open = round.state === 'now'

  if (step.facts.includes('co_answered')) {
    const co = detail.changeOrder
    const facts = co
      ? [
          { label: 'What', value: co.what },
          ...(co.adds != null ? [{ label: 'Adds', value: `+${money(co.adds)}` }] : []),
          { label: 'Days', value: co.days ?? 'none' },
          ...(co.sumBefore != null && co.adds != null ? [{ label: 'Sum after', value: `${money(co.sumBefore + (open ? co.adds : 0))}${open ? ' once signed' : ''}` }] : []),
          { label: 'Sent', value: co.sentOn ? weekdayDate(co.sentOn) : '—' },
        ]
      : []
    const line = open ? (co?.openedOn ? `${who.firstName} opened it ${weekdayDate(co.openedOn)} and has not signed.` : `${who.firstName} has not opened it.`) : null
    const actions: RoundAction[] = [...(open ? [{ kind: 'ask-again' as const, label: 'Ask again' }] : []), ...(detail.theirPage ? [{ kind: 'their-page' as const, label: 'See their page' }] : [])]
    return { ...base, line, facts, actions }
  }

  if (step.facts.includes('payapp_paid')) {
    const a = detail.payApp
    const certified = a?.certifiedOn ? `${a.certifiedBy ? `${a.certifiedBy}, ` : ''}${shortDate(a.certifiedOn)}` : a?.withArchitect ? `with ${a.withArchitect.name} since ${shortDate(a.withArchitect.since)}` : 'not yet'
    const paid = a?.paidOn
      ? [shortDate(a.paidOn), a.waivers != null ? `${a.waivers} ${a.waivers === 1 ? 'waiver' : 'waivers'}` : null, a.tradesPaidOn ? `trades paid ${shortDate(a.tradesPaidOn)}` : null].filter(Boolean).join(', ')
      : 'not yet'
    const facts = a
      ? [...(a.covers ? [{ label: 'Covers', value: a.covers }] : []), ...(a.amount != null ? [{ label: 'Amount', value: money(a.amount) }] : []), { label: 'Certified', value: certified }, { label: 'Paid', value: paid }]
      : []
    return { ...base, line: null, facts, actions: [{ kind: 'open', label: 'Open the application' }, { kind: 'the-trades', label: 'The trades on it' }] }
  }

  const due = round.day ? (round.day.late ? `was due ${weekdayDate(round.day.due)}` : `due ${weekdayDate(round.day.due)}`) : null
  const actions: RoundAction[] = [{ kind: 'open', label: 'Open' }, ...(open ? [{ kind: step.who === 'them' ? ('ask-again' as const) : ('remind' as const), label: step.who === 'them' ? 'Ask again' : 'Remind' }] : [])]
  return { ...base, line: due ? `${round.name}, ${due}.` : null, facts: [], actions }
}

/**
 * Messages, cut 8 (the portals): the customer's *Your move*, the orange card at the top of Home, lifted from the
 * Messages prototype (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178: `portalMove`,
 * `portalMoveHtml`; shape B, v1.162). It is the first thing we need from them in the flow's order: a decision on now,
 * an open change order, or a paper of ours waiting on their signature. When the week owes us nothing it is one line,
 * *Nothing from you today. We are on Start date.* The page praises and never nags, so a bill to pay is on Money, not
 * here.
 *
 * Changed from the prototype: a decision is a move only when it is theirs (the same rule as `portalStep`); the change
 * order reads its number, what it adds and its working days from the order itself (main's `PortalGcChangeOrder`), so a
 * credit reads as a credit and a change that adds days says so, where the prototype always said "adds no days"; the
 * contract has no Decline here, since main's portal signs a contract and declines only change orders; a customer off
 * the flow reads the thank-you line instead.
 * Pure.
 */

import type { PortalStepIn } from './portalPage'
import { openChanges, type CustomerChange } from '../portal/moneyLines'
import { changeAmount, changeDays, paperWords, pWeekday, say, typed, type PortalLang, type PortalPaperId } from '../portal/pageWords'

export interface CustomerMoveIn {
  /** Off the flow: declined, or a job lost. */
  off: boolean
  /** Every step of their flow in order: the Once lane, then this job's Per job lane. */
  steps: PortalStepIn[]
  /** The job's change orders; the lowest open one is the move. */
  changes: CustomerChange[]
}

/** What a press does. The page maps each to the existing write: the bid's answer, the sign page, a change's decline. */
export type CustomerPress = 'accept' | 'decline' | 'sign' | 'signChange' | 'declineChange'

export interface CustomerButton {
  label: string
  primary: boolean
  press: CustomerPress
}

export type CustomerMove =
  | { kind: 'decide'; title: string; sub: string; buttons: CustomerButton[] }
  | { kind: 'change'; changeId: string; title: string; detail: string[]; buttons: CustomerButton[] }
  | { kind: 'paper'; paper: PortalPaperId; title: string; due: string | null; late: boolean; sub: string; buttons: CustomerButton[] }
  | { kind: 'none'; line: string }
  | { kind: 'off'; line: string }

/** The first thing we need from them, or the one line that says we need nothing today. */
export function customerMove(lang: PortalLang, input: CustomerMoveIn): CustomerMove {
  if (input.off) return { kind: 'off', line: say(lang, 'offThanks') }
  const change = openChanges(input.changes)[0]
  for (const step of input.steps) {
    const now = step.where === 'now'
    if (!now && !step.loop) continue
    if (now && step.decision && step.who === 'them') {
      return {
        kind: 'decide',
        title: say(lang, 'tellUsYesNo'),
        sub: step.name[lang],
        buttons: [
          { label: say(lang, 'acceptBid'), primary: true, press: 'accept' },
          { label: say(lang, 'notThisTime'), primary: false, press: 'decline' },
        ],
      }
    }
    if (step.loop && step.who === 'them' && step.roundNow && change && (step.papers ?? []).some((p) => p.id === 'co')) {
      return {
        kind: 'change',
        changeId: change.id,
        title: say(lang, 'changeWaits', { n: change.number }),
        detail: [typed(lang, change.description), changeAmount(lang, change.price), changeDays(lang, change.days)].filter(Boolean),
        buttons: [
          { label: say(lang, 'readAndSign'), primary: true, press: 'signChange' },
          { label: say(lang, 'decline'), primary: false, press: 'declineChange' },
        ],
      }
    }
    if (now && step.who === 'them' && !step.loop && !step.waitingOn) {
      const paper = (step.papers ?? []).find((p) => p.ours && p.mark === 'wait')
      if (paper) {
        const pw = paperWords(lang, paper.id)
        const label = pw.button ?? say(lang, 'readAndSign')
        return {
          kind: 'paper',
          paper: paper.id,
          title: label,
          due: step.day ? say(lang, step.day.late ? 'lateSince' : 'dueOn', { day: pWeekday(lang, step.day.on) }) : null,
          late: !!step.day?.late,
          sub: pw.why ?? '',
          buttons: [{ label, primary: true, press: 'sign' }],
        }
      }
    }
  }
  const on = input.steps.find((s) => s.where === 'now')
  return { kind: 'none', line: on ? `${say(lang, 'nothingToday')} ${say(lang, 'weAreOn', { step: on.name[lang] })}` : say(lang, 'nothingToday') }
}

/** The move as one plain line for the office's readiness list: its title and what follows, in English. */
export function customerMoveWords(move: CustomerMove): string {
  if (move.kind === 'decide') return `${move.title}: ${move.sub}.`
  if (move.kind === 'change') return `${move.title}.`
  if (move.kind === 'paper') return move.due ? `${move.title}, ${move.due}.` : `${move.title}.`
  return move.line
}

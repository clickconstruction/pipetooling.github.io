/**
 * What the bank payments window holds (punch list #187, PR 4): the card behind the ? on the window's
 * header. To match and All, the returned checks, the match pane, the sweep bar and the ⋯ menu, one
 * sentence each, and the door to the window's guide. Held by `deskLegends.test.ts`. Pure.
 */
import type { DeskLegend } from '../help/deskLegend'

export const BANK_PAYMENTS_LEGEND: DeskLegend = {
  key: 'bank-payments',
  label: 'What this window holds',
  rows: [
    { key: 'to-match', label: 'To match', accent: '#2563eb', note: 'Every deposit from the bank not yet on a bill, newest first.' },
    { key: 'all', label: 'All', note: 'Every deposit, the applied ones too, each with its chip.' },
    { key: 'came-back', label: 'Came back', accent: '#dc2626', note: 'Checks the bank returned, worked as cases on top of To match.' },
    { key: 'who-paid', label: 'Who paid you', accent: '#059669', note: 'The payer the deposit’s name and memo point at, with their open bills. Green means the amount matches.' },
    { key: 'sweep', label: 'The sweep bar', accent: '#059669', note: 'Deposits that each match exactly one open bill, applied in one pass after you review them.' },
    { key: 'more', label: '⋯', note: 'Mark returned deposits, and the full screen button beside Close.' },
  ],
  guide: { slug: 'match-bank-deposits-to-bills', title: 'match bank deposits to the bills they pay' },
}

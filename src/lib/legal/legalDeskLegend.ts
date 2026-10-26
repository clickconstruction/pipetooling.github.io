/**
 * What the Legal desk holds (punch list #187, PR 4): the card behind the ? on the desk's header.
 * The rail, the four tiles that are questions, the fix-and-note list, the tabs and the three paths,
 * one sentence each, and the door to the desk's guide. Held by `deskLegends.test.ts`. Pure.
 */
import type { DeskLegend } from '../help/deskLegend'

export const LEGAL_DESK_LEGEND: DeskLegend = {
  key: 'legal-desk',
  label: 'What this desk holds',
  rows: [
    { key: 'rail', label: 'The rail', note: 'Every Collections account, largest first by what Click keeps after the firm’s share and the filing cost.' },
    { key: 'sue', label: 'Can we sue?', accent: '#2563eb', note: 'Yes when the customer got the bill, a crew was placed on the property and nothing is disputed.' },
    { key: 'money', label: 'How much? What’s left?', accent: '#059669', note: 'What they owe, then what we keep after the firm’s cut, with a verdict.' },
    { key: 'wrong', label: 'What could go wrong?', accent: '#d97706', note: 'What hurts the case, in plain words.' },
    { key: 'before', label: 'Before this goes to an attorney', accent: '#dc2626', note: 'Red items an attorney asks for first. Yellow ones are worth knowing.' },
    { key: 'tabs', label: 'The tabs', note: 'Narrative, Account, Paper, Evidence, With the firm and Timeline. Each holds one part of the packet.' },
    { key: 'paths', label: 'Three paths', note: 'An account is run in house, marked attorney-ready for the firm, or written down.' },
  ],
  guide: { slug: 'review-a-collections-account-before-it-goes-to-your-attorney', title: 'review a collections account before it goes to your attorney' },
}

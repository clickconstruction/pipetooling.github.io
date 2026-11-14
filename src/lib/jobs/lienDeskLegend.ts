/**
 * What the Lien desk holds (punch list #187, PR 3): the card behind the ? on the desk's title line.
 * Eight parts in the order a first-timer meets them, one sentence each, and the door to the desk's
 * guide. Held by `deskLegendFailures` in `deskLegends.test.ts`. Pure.
 */
import type { DeskLegend } from '../help/deskLegend'

export const LIEN_DESK_LEGEND: DeskLegend = {
  key: 'lien-desk',
  label: 'What this desk holds',
  rows: [
    { key: 'do-now', label: 'To do', accent: '#2563eb', note: 'Every lien paper that needs someone to act, late or due soonest first.' },
    { key: 'only-you', label: 'Only you can…', accent: '#d97706', note: 'The two steps only the leader takes, approve and sign. The office sees them under Waiting on.' },
    { key: 'rail', label: 'The rail', note: 'The four steps of a notice with how many rows stand on each. A press on a step shows only those rows.' },
    { key: 'deadlines', label: 'By date', accent: '#7c3aed', note: 'When each deadline falls, on one calendar with the 15ths as columns.' },
    { key: 'all-filings', label: 'By paper', note: 'Every paper by its state, under Monthly notices, Lien affidavits and Retainage notices.' },
    { key: 'by-job', label: 'By job', note: 'Every job with its whole path, the nearest date first.' },
    { key: 'run', label: 'Record the mailing', accent: '#059669', note: 'The printed notices as one packet. It records what is ready and holds the rest with the reason.' },
    { key: 'rules', label: '§ Rules', note: 'The Texas rules the desk follows, with the guide behind each one.' },
  ],
  guide: { slug: 'send-lien-notices-from-the-lien-desk', title: 'send lien notices from the Lien desk' },
}

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3439',
  date: '2026-09-14',
  title: 'Needs You: a card when field capacity runs light three weeks in a row',
  kind: 'feature',
  highlights: [
    'When the crew’s clocked field hours have come in under 60% of the roster’s available hours for three complete weeks running, the Dashboard’s Needs You list says so — with each week’s percentage and the hours behind them.',
    'Open Capacity takes you to Jobs → Job Summary → Capacity, where every week is drawn. The current week never counts until it is over.',
    'Shows for the office roles that see Job Summary.',
  ],
}

export default note

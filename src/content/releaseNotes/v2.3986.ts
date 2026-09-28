import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3986',
  date: '2026-09-28',
  title: 'Payroll catch-up: the earlier-weeks scan has tests',
  kind: 'fix',
  highlights: [
    'The scan behind “Earlier unreported” in Draft Payroll, and behind “Hours with no report yet” on Balances, is its own tested piece: which weeks it lists, how the count drops as reports are made, and looking further back.',
    'Nothing on screen changes.',
  ],
}

export default note

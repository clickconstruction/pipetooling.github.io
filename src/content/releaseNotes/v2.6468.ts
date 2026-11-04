import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6468',
  date: '2026-11-03',
  title: 'The dev seat counts a job’s card charges by the Job window’s rule',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'An agent reading a job through the dev seat now counts its card charges as the Job window does. An Internal Transfer is left out. A charge that is also on a supply-house invoice is counted once, under the invoice.',
    'So the profit the agent reads is the window’s profit. Beside it, the agent sees every card line attached and what the rule left out.',
    'The dev seat now asks for one job’s hours alone. It used to read every job’s hours and keep one, a read that could lose rows past 1,000.',
  ],
}

export default note

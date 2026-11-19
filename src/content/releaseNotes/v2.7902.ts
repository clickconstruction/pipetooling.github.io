import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7902',
  date: '2026-11-19',
  title: 'Permits on a phone: the lit step is in view, and a lit chip is bold from the start',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator'],
  highlights: [
    'On a phone the strip of steps on Permits now slides to the one you are on. A link that opened Builders used to show Skim to Closed with nothing lit.',
    'The chips on Investigating and Closed now draw the lit one in bold as soon as the list opens. Before, it turned bold only after a press.',
    'Those chips now draw at the smaller size they were written for, so more of them fit on one row of a phone.',
  ],
}

export default note

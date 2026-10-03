import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4454',
  date: '2026-10-02',
  title: 'Needs You: a lead time counts from today, evenings included',
  kind: 'fix',
  highlights: [
    'After 7 pm Central, the Dashboard’s lead-time card counted from tomorrow. A part read as landing one day later and running one day more late than it would.',
    'The card now counts from today on the company’s calendar, at any hour.',
  ],
}

export default note

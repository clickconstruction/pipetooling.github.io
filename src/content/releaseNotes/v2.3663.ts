import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3663',
  date: '2026-09-21',
  title: 'Approving hours: quick adds are marked, show what was said, and are totalled for the week',
  kind: 'feature',
  highlights: [
    'When you approve hours, time an office person added after an off-hours call or email now carries a “quick add” chip — on a person’s pay-week view and in the pending list on People → Hours.',
    'Those rows show the sentence the person typed (Call — Acme, the Oak St invoice) instead of the job. Every quick add sits on the Office job, so the job alone told you nothing.',
    'A person’s pay-week view adds one line under the week’s hours — for example “1 h 05 m across 8 entries this week” — so you can see at a glance how much of the week was self-reported.',
  ],
}

export default note

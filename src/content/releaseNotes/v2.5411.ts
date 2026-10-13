import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5411',
  date: '2026-10-12',
  title: 'Messages: a quick reply for customers knows their two flows, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Groundwork for residential customers in Messages. Nothing changes on screen yet.',
    'A customer now has two flows, the residential one and the GC one. A quick reply for customers can sit on a step of either.',
    'The quick replies editor can name the flow beside each step. A customer’s strip can leave the other flow’s lines in Find a reply.',
    'A line’s history can say when its Spanish changed, and when its place on the phone changed.',
  ],
}

export default note

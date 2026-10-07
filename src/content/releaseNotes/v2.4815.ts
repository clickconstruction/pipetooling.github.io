import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4815',
  date: '2026-10-07',
  title: 'Customer timeline: more ways in',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Click a GC’s name under a job on the Pipeline to open the GC’s timeline, with every job they are the GC on.',
    'Type a customer’s name in the Pipeline search and a chip opens their timeline. A customer’s own page has a Timeline button too.',
    'Copy link in the timeline copies a link that opens it on the Pipeline. Show the days on a crew card opens each day and who worked it.',
    'A day with many new jobs or many bills shows one card with the first five, and Show all for the rest.',
  ],
}

export default note

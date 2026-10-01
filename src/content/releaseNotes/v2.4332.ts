import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4332',
  date: '2026-10-01',
  title: 'Submittals: a draft catches up with its takeoff',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'A draft now says when the takeoff reads differently for some rows. Refresh from the takeoff shows each row before and after, then gives it the takeoff’s parts.',
    'A part the takeoff still has keeps its house, lead time, stage, pages and call. Rows read from the house’s file are left alone.',
    'A row typed by hand for another fixture, like a carrier, can become a part of that fixture with Make it a part. Its house, lead time, pages and order dates come along.',
    'Submittals fit a tablet and a phone better: the rows table no longer runs past its box, the parts editor reads GC sees it on every part, and the procurement log keeps each item on screen.',
  ],
}

export default note

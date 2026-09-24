import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3809',
  date: '2026-09-24',
  title: 'Pipeline: the Ready-to-ask tile and the Capable list agree',
  kind: 'fix',
  highlights: [
    'The Ready to ask for tile and the “Bill the finished work” money card read the same stage plans as the Capable list, so a job split into stages with nothing passed yet no longer shows a figure the list cannot back up — Taunya’s “$400 capable” over an empty breakdown.',
    'Jobs without Order stages keep the same figure as before; if the plan reads ever fail, the old figure stands rather than nothing.',
  ],
}

export default note

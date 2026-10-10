import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5182',
  date: '2026-10-10',
  title: 'GC mode: tell the trades their new dates',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Tell the trades sends each company whose days moved one email with its new dates and why.',
    'Changes to the schedule says who was told and what each company answered.',
    'After a what-if is kept, a line over the chart names the companies not told yet.',
    'A told move that was undone says so, with a Call link to the company.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5429',
  date: '2026-10-12',
  title: 'Sub sheets: the first day on site and the day the work was done, kept behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A sub sheet now keeps the first day the sub reported real progress from their portal.',
    'It also keeps the day the sheet first moved past Working. A move back to Working clears it.',
    'Sheets we already have get both days from the job’s activity feed.',
    'Nothing shows them yet. The sub’s steps in Messages read them next.',
  ],
}

export default note

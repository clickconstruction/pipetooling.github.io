import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6150',
  date: '2026-10-30',
  title: 'A trade’s moved dates drawn on its own schedule row (punch list #217, a prototype)',
  kind: 'feature',
  highlights: [
    'A prototype of the trade partner’s portal draws a move on the company’s own row in the schedule: the new bar beside a faint ghost of its old days, with was Nov 8 – Nov 14 under it, so the company reads the move against the work it waits on.',
    'The reason is a chip under the row, moved 3 days later · weather · Two days of rain held the drywall, and the two answers, These dates work and I need another day, sit on that row. The email we sent keeps its words.',
    'Nothing changes for the trades: the row draws only when the page address carries shape=1. In Settings, under What customers see, the trade partner’s portal step has a Side by side press that opens today’s look above the row on the sample.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3163',
  date: '2026-09-08',
  title: 'Save as Assembly names the assembly after the count and the project',
  kind: 'feature',
  highlights: [
    'On Bids → Takeoffs, "Save as Assembly" under a count now opens with the name filled in as the count name, a dash, and the project name — for example "I-6 - MPH LIVSTE" — so the book entry says where it came from.',
    'It is only a starting point: edit the name before saving as before. If the count or the bid has no name, the half that exists is used on its own.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'estimator'],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5158',
  date: '2026-10-10',
  title: 'GC projects: general conditions at what they really cost',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Our number names the Pipeline job a GC job’s general conditions are spent on: the superintendent’s time, the trailer, temporary power.',
    'Money’s margin counts them at that job’s real spend once it passes their budget, and at what they cost once the job closes, in a new Our own work column.',
    'Earned so far counts them as what we billed for them less what they cost. Closeout says the same.',
    'Labor costs show only to people who can see pay. Anyone else sees general conditions at their budget, with a line saying why.',
  ],
}

export default note

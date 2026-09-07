import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3012',
  date: '2026-09-07',
  title: 'Job Summary and the cost breakdown say Team, not Team Labor',
  kind: 'fix',
  highlights: [
    'Job Summary\'s "Team Labor Cost" column is now "Team Cost", its per-job breakdown line reads "Team", and the printable cost breakdown\'s section heading is "Team" — matching the Team tab and the Edit Job panel. Numbers are unchanged.',
    'Billing\'s red-flag filter tooltip now says "missing a Sub Labor book or Team hours".',
  ],
}

export default note

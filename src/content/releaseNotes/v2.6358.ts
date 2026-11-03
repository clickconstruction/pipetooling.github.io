import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6358',
  date: '2026-11-02',
  title: 'The header search finds a job by the name of its development',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Open the magnifier in the header, type a development’s name, and every job in that development is listed with the jobs that match by number, name or address.',
    'Part of the name in any case is enough, the same as the other fields. An archived development still finds its jobs.',
    'The Pipeline search learned the same earlier today; this closes the gap on the header’s box.',
  ],
}

export default note

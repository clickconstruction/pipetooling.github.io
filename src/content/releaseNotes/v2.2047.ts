import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2047',
  date: '2026-08-21',
  title: 'GC Review ignores board search and filters',
  kind: 'fix',
  highlights: [
    "GC Review now always shows every GC's full picture — whatever is typed in the Stages search box (or set in the GC/development/Account Man filters) no longer narrows what you certify or send.",
    'The same rule now covers all the money modals from one place: the chase queue, aging chart, payment forecast, and who-owes-what all read the unfiltered board.',
    'Each GC header puts the name on its own line with the stats (jobs · outstanding · oldest) underneath.',
  ],
}

export default note

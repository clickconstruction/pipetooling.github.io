import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4050',
  date: '2026-09-28',
  title: 'GC Review: print where the checks went, or download it as a CSV',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Find a check now prints the sheet a GC’s bookkeeper asks for: every payment of the last twelve months, where each sits now (one line per job and invoice), what moved after it was recorded, what came in and is not yet on a bill, and where each job stands — billed, paid by, last applied, retainage held, still open. The open total matches the statement.',
    '"show all" widens the sheet to every payment on record; the search always reads everything.',
    'CSV downloads the same rows, one per applied line, for a bookkeeper who reconciles in a spreadsheet.',
  ],
}

export default note

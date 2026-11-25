import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8594',
  date: '2026-11-25',
  title: 'The law firm’s lien grid reads the recorded § 53.056 notices',
  kind: 'fix',
  highlights: [
    'The firm’s grid read a job’s affidavits and releases, and not its recorded notices. The app’s own book reads all three.',
    'A notice kept by hand could read as no notice on the firm’s grid, though one is on file.',
    'The grid now says the month a recorded notice covers and the day it went.',
    'Of each send the firm gets who it went to, how and the day. No mail number, name or address travels.',
  ],
}

export default note

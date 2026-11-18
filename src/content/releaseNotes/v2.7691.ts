import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7691',
  date: '2026-11-17',
  title: 'Lien papers: a sent paper shows what went out, with every file and receipt one press away',
  kind: 'feature',
  highlights: [
    'A sent notice on the Lien desk now has a block named What went out. It lists each mailed file by name, then each envelope with its mail number and its receipt.',
    'A chip counts the proof, like Mail proof: 2 of 3 on file, and a Next line names the one thing still missing.',
    'Every mailed file has its own link. Until now a second file had none, and the first sat under the name Saved copy.',
    'The same block shows in the job’s Lien window under each filing, and beside the paper in a stop’s window. A receipt can be added there after the mailing is recorded.',
  ],
}

export default note

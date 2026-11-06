import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6564',
  date: '2026-11-06',
  title: 'The app makes the Fleet folder itself, beside the Jobs folder, for the machines’ check photos',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Documents → Where files go has a Fleet folder card. Make the Fleet folder has the app’s own account make a folder named PipeTooling Fleet beside the Jobs folder in its Shared Drive and set it, in one press.',
    'A machine’s check photos then land under it, a folder per machine named by its unit, or by the rental agreement. Until it is set, each photo waits with the reason on its row and files on the next pass.',
    'A folder link can be pasted instead; Check says whether the app can write there before it is used.',
  ],
}

export default note

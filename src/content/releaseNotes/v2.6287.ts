import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6287',
  date: '2026-11-01',
  title: 'Where files go: the tree under the customer, and Tidy the folders',
  kind: 'feature',
  highlights: [
    'The What is inside card now draws the whole tree: the jobs root, the customer’s folder, the job’s folder and the five inside.',
    'Tidy the folders for N live jobs walks every live job through the folder sweep in one press, counting what it made, moved, renamed and held as it goes.',
    'An amber line counts the jobs whose folder is not in the tree, from the hold each job carries, with the reason and a door to the job. No run is needed to read it.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note

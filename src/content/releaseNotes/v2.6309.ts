import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6309',
  date: '2026-11-01',
  title: 'Company papers live in a Drive folder the app lists, and the office uploads into it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Documents → Where files go has a new card, The company folder. Paste a Drive folder link, press Check, then Use this folder for company papers. The W-9, the insurance and the licenses live there.',
    'Documents → Company now opens with Company papers: the folder’s files live from Drive, newest change first with the day and size, each a click to open, plus Open the folder.',
    'The office roles also get Upload a file. Pick a file from this computer and it lands in the company folder, up to 10 MB. An estimator reads the list and opens the folder.',
    'While no folder is set the tab says so and links to Where files go. The old name and link list stays under the folder for now.',
  ],
}

export default note

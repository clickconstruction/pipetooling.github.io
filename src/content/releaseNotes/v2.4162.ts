import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4162',
  date: '2026-09-29',
  title: 'New Bid: Plans sit under the name — the folder to open, the name to copy, and Find fills the link in',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The Plans block is the second thing on the bid form, right under the project name. Four cards walk it: open the division bid folder in Drive, make a folder with the name the app gives you (Copy name), put the PDFs in it, tap Find the folder.',
    'Find looks the folder up by that name and fills the plans link in. You never copy a link. Plans that live somewhere else in Drive still go in with Paste a link instead.',
    'The line under it says the same thing in plain words: put the plans in the folder and the robots will shadow this bid. A pasted link the robots cannot open names the robots’ Drive address to share it with; a folder made inside the bid folders never needs that.',
  ],
}

export default note

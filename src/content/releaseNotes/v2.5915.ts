import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5915',
  date: '2026-10-26',
  title: 'The search box finds a guide by its question, and the punch list by its number',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Type a task in your own words, like bill a customer or send a lien notice, and the guides that answer it list under the pages, three at a time. A leading how do I is dropped.',
    'A guide about one page carries Go there beside its row, so the task lands on the place and not only on the page about it. 116 guides carry it today.',
    'For the owner and the developers, # and a word finds a to-do on the punch list by its name or its number and lands on its row.',
    'The Lien desk is a door too: type lien and the desk opens from the box, no gavel to know.',
  ],
}

export default note

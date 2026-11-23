import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8316',
  date: '2026-11-22',
  title: 'HR files: an agent is told which id a person’s file takes',
  kind: 'fix',
  highlights: [
    'Two of the agent’s tools for a person’s HR file pointed it at the wrong id. They sent it to the search of logins, and a file is kept under the person’s row on the roster.',
    'An agent that followed them was refused with “person not found” and had to work out why.',
    'Both tools now name the roster row, in the same words the case and standing tools already use. Nothing changes on People → HR, and nothing changes in what a plan may do.',
  ],
}

export default note

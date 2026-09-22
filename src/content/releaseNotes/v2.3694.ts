import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3694',
  date: '2026-09-22',
  title: 'Lien desk: change the notice’s wording on the paper itself',
  kind: 'feature',
  highlights: [
    'The Wording row is gone. The four values you may change now sit in a lightly shaded box on the notice: click one and it becomes a box you type in, in its place, at its real width. Enter keeps it, Esc puts it back.',
    'A changed value says so beneath it with Back to the job’s wording, and the page label counts them — “1 value changed by Taunya”. The leader still sees the same before approving.',
    'The optional “party contracted with, if different” line is a ghost you can type into; it prints only once it has a value. Plain values say on hover where they are filled from. Once a notice has gone for approval the boxes turn grey and dotted until it is pulled back.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7407',
  date: '2026-11-15',
  title: 'Tag a teammate in a job note, with a count above Jobs',
  kind: 'feature',
  highlights: [
    'Type @ in the note box on a Pipeline row and pick a teammate. The office and that job’s crew can be tagged, and the note waits on them until they answer.',
    'A red number above Jobs counts the notes that tagged you. The Tagged job notes section at the top of the Pipeline lists them, the oldest first, each with a box to answer on the job.',
    'An answer or No reply needed clears a tag. Opening the job does not. The person who asked sees the answer under You asked.',
    'With no Pipeline, the Dashboard’s Needs you card has a Tagged job notes line that opens the same list.',
  ],
}

export default note

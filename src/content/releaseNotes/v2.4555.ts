import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4555',
  date: '2026-10-05',
  title: 'Submittals: the resubmit button says it starts a draft',
  kind: 'fix',
  highlights: [
    'The green button on step 7 now reads "Start a Rev 2 draft…". It used to name the rows and leave you guessing what a press would do.',
    'The line beside it says which rows go on the draft, that nothing is sent, and that the GC sees the new revision only after you press Share.',
    'The question that opens before the draft is made says the same, and so does the Next line at the top of the tab.',
  ],
}

export default note

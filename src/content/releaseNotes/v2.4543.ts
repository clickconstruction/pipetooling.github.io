import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4543',
  date: '2026-10-05',
  title: 'Submittals: the top of the tab says each thing once',
  kind: 'feature',
  highlights: [
    'One line under the bid name now says which revision you are on. The counts it used to repeat live on the steps that own them.',
    'One "? Help" button beside the bid name opens the walkthrough, the words on the page and the written guide. It replaces three separate doors.',
    'A folded step is one line. An open step shows its plain sentence and its own "?", and drops a summary its contents already say.',
    'The rows table gains a "Need a reason" count, so nothing the old header line counted is lost.',
  ],
}

export default note

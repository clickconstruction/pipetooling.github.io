import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3530',
  date: '2026-09-16',
  title: 'Pipeline: three of its dialogs move into their own files',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The Billed Awaiting Payment by Job Name, Capable of Being Billed and Est. bill date dialogs now live in their own components, so the Pipeline board is smaller and easier to change safely.',
    'The Total by Name grouping is a tested function of its own.',
  ],
}

export default note

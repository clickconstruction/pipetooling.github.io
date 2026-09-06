import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2955',
  date: '2026-09-06',
  title: 'Add document → Send now works for fillable forms',
  kind: 'fix',
  highlights: [
    'Picking a form (W-9, I-9, Direct Deposit…) under + Add document and pressing Send now no longer stops with "Add contract text… before sending" — the send email opens straight away, as it already did for Save for later → Send.',
    'Found while test-signing the new Direct Deposit Authorization with the Claude Test Sub.',
  ],
}

export default note

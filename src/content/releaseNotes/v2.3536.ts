import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3536',
  date: '2026-09-16',
  title: 'Pipeline: the two send-back dialogs move into their own files',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The "Send back" dialogs for a bill line and for a whole job now live in their own components with tests; the attestation, the reason box and what happens on Confirm are unchanged.',
  ],
}

export default note

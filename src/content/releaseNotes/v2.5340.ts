import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5340',
  date: '2026-10-12',
  title: 'Messages: start a change order from a customer’s message',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Open a customer’s message and press Start a change order to draft one on its job.',
    'The message then shows which change order it became.',
    'The money team prices the draft with Price it, then sends it to sign.',
    'Each change order from a message has a line that opens the message again.',
  ],
}

export default note

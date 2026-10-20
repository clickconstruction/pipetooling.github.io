import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5496',
  date: '2026-10-13',
  title: 'Messages: a person’s answer to our email comes back to the inbox they wrote to',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'An email from a thread asks for the answer at the inbox the person last wrote to, or the one for their kind.',
    'The send window shows that inbox on a Replies to line, and the reply box’s from line says it too.',
    'A text’s from line names the number it goes from.',
    'Until the inbox addresses are set in Settings, nothing changes.',
  ],
}

export default note

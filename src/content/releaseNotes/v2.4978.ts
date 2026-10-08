import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4978',
  date: '2026-10-08',
  title: 'Lien desk: take back a printed run',
  kind: 'feature',
  roles: ['master_technician', 'assistant', 'controller', 'dev'],
  highlights: [
    'When nothing in a printed run was mailed, open the run and press Take back… beside step 1. Every printed notice goes back to Ready to send, and the approvals stand.',
    'The run asks first. It says the copies already printed stay in each job’s Documents, and that tracking numbers typed and not recorded are dropped.',
    'Then print the packet again. It prints the way the app draws it today.',
    'Each notice’s footer says when it was taken back and by whom. Back to ready on one notice now leaves the same line.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5289',
  date: '2026-10-12',
  title: 'Messages: Follow up shows who is waiting on us and what we owe them',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Follow up on GC projects now opens on the people waiting on us: Needs you, Needs a reply and We owe them.',
    'Each row says who has it. Take it, hand it to a teammate or put it back, and the thread records the change.',
    'Ask the architect puts a plans question on the job and emails it to the architect.',
    'The Follow up button and the Dashboard count the people waiting on us, each once. The quotes we wait on keep their own count.',
  ],
}

export default note

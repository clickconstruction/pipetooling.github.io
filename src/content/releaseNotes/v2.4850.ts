import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4850',
  date: '2026-10-07',
  title: 'Lien desk: the approval button says what it is',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a notice waiting for the leader, the footer button that records his approval at your desk now reads Leader here, Approve and is blue, like every other main step on the desk.',
    'It was brown and read He is here — record it, which did not say it was the approval step.',
    'What it does is unchanged: write down who said it, when and how, and the notice goes to Ready to send on the leader’s word.',
  ],
}

export default note

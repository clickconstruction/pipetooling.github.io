import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5367',
  date: '2026-10-12',
  title: 'Lien desk: He signed the paper, the door for a pen signature (pen train, PR 2)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A held envelope in the run now has a third door beside Leader here, sign: He signed the paper. The same door sits on a ready, unsigned notice’s footer for the office.',
    'The pane names the leader, fills in the day the packet printed, asks how you know, takes a photo of the signed page when you have one, and ticks the notices he signed. Record writes one pen record per notice and the envelope goes back into the run.',
    'The run’s held line now says the pen door exists. The help guide has a section, He signed it with a pen.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4697',
  date: '2026-10-06',
  title: 'Pipeline: the Billed date says which clock starts there',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a Billed or Collections row, the Billed line under the money bar has a hover. It used to say every clock below starts from the bill date.',
    'Only the pay estimate counts from the bill date. The lien row counts from the month the work was done. The hover now says so.',
  ],
}

export default note

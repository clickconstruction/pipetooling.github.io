import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4683',
  date: '2026-10-06',
  title: 'Job Parts Tally: the team’s sorted charges sit on the day they were bought',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Team view, a charge that is already sorted now shows on the day it was bought, with the time it was bought.',
    'The suggestions that come from past charges, like a store’s last job, now count those charges on the day they were bought too.',
  ],
}

export default note

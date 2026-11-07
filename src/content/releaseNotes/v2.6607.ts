import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6607',
  date: '2026-11-07',
  title: 'The Monday email: last week’s Your week card, to each person with a signal',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'helpers', 'superintendent'],
  highlights: [
    'Every Monday at 6 AM Central, each person the office picked a week signal for gets last week’s Your week card at their own address: the signal and where it stood, how far it moved, and the customer’s words of the week. Nobody else gets it.',
    'A dev turns the Monday email on or off on Settings → What the team sees, in the new card at the top. It ships off.',
    'Preview mine on that card shows your own email as the run would send it, and Email me a test sends it to you alone. The Your week row in the team’s week lists who hears it.',
  ],
}

export default note

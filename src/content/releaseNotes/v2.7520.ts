import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7520',
  date: '2026-11-16',
  title: 'Lien desk: Redraw from the bills, and the leader signs the paper he reads',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A notice whose bills changed after it was sent for approval now says so on the desk. A band over the paper gives what the paper claims, what the bills now come to and the gap.',
    'Redraw from the bills on that band replaces the stored paper with today’s claim, retainage and date. It asks first. The typed wording stays. A signature on the notice comes off and the leader signs it again, then the run prints it.',
    'Sign and approve now signs the paper on the screen. When the stored paper is older than what the pane shows, the app saves today’s paper first, so the signature is on the pages the leader read.',
    'The date on the form is the day the notice is signed, not the day its draft was first made. A notice not yet signed shows today.',
  ],
}

export default note

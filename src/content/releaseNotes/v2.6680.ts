import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6680',
  date: '2026-11-08',
  title: 'Legal desk: How much? and What’s left for us? read the typed claim lines',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'How much? now reads the whole claim: the open bills, the retainage no bill asks for yet, and the lines typed on the Account tab. The line under it counts the typed lines and says what they add.',
    'What’s left for us?, the firm’s cut and the collections-and-trial card work from that claim, so a materials or damages line changes what the case is worth the moment it is saved.',
    'The claim bar draws the typed lines as one block after the retainage, and its sentence says how much the office typed onto the claim.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4939',
  date: '2026-10-08',
  title: 'GC mode: asking a trade partner to quote sends the email, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Tick Email the invitations now in the Ask window, then Ask N companies, and each company gets its invitation by email with a link to its portal. The box starts empty for now.',
    'Each ask then reads Invitation emailed. An email that could not go out is listed with the reason, and the ask is saved anyway.',
    'Only a dev’s press sends the email while GC mode is built. Anyone else’s asks are saved for a dev to send.',
  ],
}

export default note

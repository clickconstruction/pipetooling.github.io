import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4127',
  date: '2026-09-29',
  title: 'The bill email comes from Click Plumbing and Electrical',
  kind: 'feature',
  highlights: [
    'A bill sent by Send Email invoice, and every copy of it, now shows "Click Plumbing and Electrical" as the sender in the payer\'s inbox — the company they hired, not the name of the software. The address underneath is the same one as before, so nothing about delivery changes.',
    'The estimate and the contract-for-signature emails already showed the company name; they now share the one rule behind it, and what they send is unchanged.',
    'Staff emails — digests, sign-in links, invitations, the notices that go to the team — keep coming from ClickTooling, so one inbox still tells an app notice from a customer thread.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6518',
  date: '2026-11-04',
  title: 'Attach a login to someone already on the roster, and nothing about them moves',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A person with no login gets one from their desk: Access & account → Login → Attach a login… → their email → Attach and send the sign-in email. The login lands on the same person, so their hours, Charged as, pay and paperwork stay where they are.',
    'The ⋯ menu on their People → Users row has Attach a login, which opens the desk there.',
    'Until a login is attached the desk hides the rows that need one: Training mode, Sign-in, the CountTooling seat, Change… on the address and Archive.',
    'Inviting an address that belongs to a person with no login is refused and points to Attach a login, so nobody is made twice. Who counts as what marks a person with no login beside their role.',
  ],
}

export default note

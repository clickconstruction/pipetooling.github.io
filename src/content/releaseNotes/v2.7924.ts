import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7924',
  date: '2026-11-19',
  title: 'Documents: a waiting staff or sub agreement opens on its own line in People',
  kind: 'fix',
  highlights: [
    'On Documents, under Agreements, pressing a staff, sub or partner agreement that is still waiting used to open an error. It now opens People, on Contracts, with that person’s papers open and the paper’s line marked.',
    'Send or Resend is on the marked line. Nothing is sent until you press it.',
    'A signed agreement still opens its signed record, from Documents and from the signing page.',
    'When a customer signs our contract in their portal on a job we build as the GC, the consent words they agreed to are now kept with it. No customer had signed one yet, so nothing was lost.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4596',
  date: '2026-10-05',
  title: 'Contracts: the customer portal and the copy you email name both signers',
  kind: 'fix',
  highlights: [
    'On the customer portal, Your agreements names both people once both have signed.',
    'While one of two has signed, the portal says who signed and who it is waiting on. It no longer says Waiting for your signature to someone who already signed.',
    'Email a copy… says the agreement was signed by both people.',
    'The law firm’s page names both signers too.',
  ],
}

export default note

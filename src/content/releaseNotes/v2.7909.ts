import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7909',
  date: '2026-11-19',
  title: 'Liens: an assistant can take a wrong mail receipt off a filed lien',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now take a wrong mail receipt off a filed lien’s copy, as Take off on the receipt does.',
    'It first reads what each file on record is, and says when both envelopes hold the same file or a receipt is the size of the lien itself.',
    'Only the receipt comes off. The day mailed and the mail numbers stay as they are.',
    'The file goes to Drive’s trash, where Drive keeps it 30 days.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6936',
  date: '2026-11-11',
  title: 'Lien affidavit: a second company address, when the company is not where its mail goes',
  kind: 'feature',
  highlights: [
    'Settings, Jobs, bills and liens: the company block has a new box under the address, Physical address, if different.',
    'A lien affidavit on the short form gives the address above it as the mailing address. With the new box filled, the affidavit gives both.',
    'Leave the box empty when the two are the same place. Nothing else prints it, and no paper changes until it is filled.',
  ],
}

export default note

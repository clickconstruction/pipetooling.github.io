import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6580',
  date: '2026-11-06',
  title: 'The fleet board shows a rental’s agreement photo and the office types the number off it',
  kind: 'feature',
  roles: ['dev', 'assistant', 'controller', 'master_technician'],
  highlights: [
    'A rental whose agreement number is blank reads agreement not in yet on its card in amber, and agreement photo in · number not typed yet once the tech has photographed the paper on the pre-use check.',
    'The card shows that newest photo in an amber box with who took it and when. Open the photo opens it full size, from the bucket or from the machine’s Drive folder once it is filed.',
    'Type it off the photo opens the rental editor with the picture beside its fields, so the office reads the agreement number and the due-back day straight off the paper. Saved, the chip reads the number and the due-back day everywhere.',
  ],
}

export default note

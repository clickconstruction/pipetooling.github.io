import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6238',
  date: '2026-10-31',
  title: 'A sworn statement names its affiant in full (punch list #220)',
  kind: 'fix',
  highlights: [
    'Picking one of our team in Swear a statement… now fills a Their full name box from the roster. Type the name as it reads on their ID: the roster may hold a first name only, and the notary checks it.',
    'When the RMP swears it, the role line asks for the license number until you edit it.',
    'Under the signature, a witness’s role now reads as a caption: the foreman for Brightline Electric prints as Foreman for Brightline Electric.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6576',
  date: '2026-11-06',
  title: 'A rental booked before its agreement number: the pre-use check asks for a photo of the paper first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'helpers', 'assistant', 'controller'],
  highlights: [
    'The office can plan a rental with the agreement number blank. The block, the board and the check read agreement not in yet instead of an agreement with nothing after it.',
    'The tech’s pre-use check on such a rental opens with The rental agreement as its first stop: a photo of the paper the yard handed over, and one for the back page. The sign press reads Photo of the agreement first until a photo is in.',
    'The photo files into the machine’s Drive folder with the other shots, named by the day and the person. Later checks say the agreement photo is in, or filed, and ask nothing more.',
    'The leaving check of a rental offers a Return slip photo tile, the matching evidence at the other end.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2802',
  date: '2026-09-05',
  title: 'Forms with an office half, and the I-9',
  kind: 'feature',
  highlights: [
    'A form can now have two halves: what the signer fills on the signing page, and an office section the office completes afterwards from the record. The I-9 works this way: the employee signs Section 1, the office completes Section 2.',
    'Form I-9 is in the Contract library and the All Teammates packet. Send it like any document; the employee fills Section 1 on their phone, and "Complete the office section" on the record finishes it after you have examined their documents.',
    'Forms with drop-down fields (the I-9\'s State) now fill correctly, and anything a form refuses is written onto the page instead of failing the signing.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2797',
  date: '2026-09-04',
  title: 'Sign a form by filling in the real page',
  kind: 'feature',
  highlights: [
    'When a document sent for signature is a form (a W-9, for example), the signing page now shows the actual form with boxes to type into, right where the answers belong.',
    'On a phone, a lens under the page magnifies the box you are on, with plain-language help in English or Español, and Next walks you through in order.',
    'Sensitive answers such as a Social Security number are masked after you type them and exist only inside the signed PDF, never anywhere else in the app.',
  ],
}

export default note

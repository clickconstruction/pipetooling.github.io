import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7071',
  date: '2026-11-12',
  title: 'Lien cover letters: the bullets are indented and the letter fits one page',
  kind: 'feature',
  highlights: [
    'The bullet points in a lien cover letter are now indented. A bullet that runs to a second line lines up under its own words.',
    'A cover letter and an attorney’s letter now fit one page with the signature. First the lines sit closer at the same type size. A long letter steps the type down, never under 10 point.',
    'The packet you print in house puts the cover letter on one sheet too.',
    'A letter mailed through Docsmit carries the address block for the envelope window. The longest letter still runs to a second page there.',
  ],
}

export default note

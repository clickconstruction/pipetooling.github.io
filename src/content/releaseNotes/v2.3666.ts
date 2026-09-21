import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3666',
  date: '2026-09-21',
  title: 'Job → Edit: the appraisal roll’s owner reads as a suggestion, laid out like the envelope',
  kind: 'feature',
  highlights: [
    'The green “Found on the appraisal roll” box looked finished while the row above it still said “not linked”. It is now a neutral card, and the Property record row says “Not linked yet · 1 suggestion” until you save it.',
    'The owner and mailing address read the way the envelope will — owner, c/o, street, city on their own lines. The roll’s “%” now says c/o and the state stays in capitals. Legal, county and what it reads as sit beside the address.',
    'One row of actions at normal size: Save this owner, Not right? Paste the CAD page, and a line saying what saving does. The district, tax year and CAD link moved to the caption, and “mail elsewhere” is now a plain phrase.',
    'It fits every screen: two columns in the desktop sheet; on a phone the facts drop under the address and Save runs the full width.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3447',
  date: '2026-09-15',
  title: 'Owner of record: the Fix-ups list finds it, you confirm it',
  kind: 'feature',
  highlights: [
    'Jobs → Pipeline → Fix-ups gains “Owner of record to confirm · N” — every GC job with approved hours whose property record has no confirmed owner (the lien notice cannot be mailed without one).',
    'The list looks each property up on the appraisal roll as it opens and shows the owner, mailing address and where it came from; “Use” saves it on the property and links every job there, “Use all found” does the whole pile in one click.',
    'Rows say what the roll reads as — a public owner (bond claim, not a lien), a landlord, a likely homestead — and a property the roll cannot place offers the paste-the-CAD-page box in place.',
  ],
}

export default note

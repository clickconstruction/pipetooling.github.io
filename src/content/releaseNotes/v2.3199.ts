import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3199',
  date: '2026-09-09',
  title:
    'Clock changes no longer fail for people whose roster name differs from their login name',
  kind: 'fix',
  highlights: [
    'Approving, editing or moving a clock session used to fail with a database error for anyone the roster knows by a different name than their login (a nickname vs a full name). The crew-day record is now matched by person, not by spelling, so the change goes through.',
  ],
}

export default note

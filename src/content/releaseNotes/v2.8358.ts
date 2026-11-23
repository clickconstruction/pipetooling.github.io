import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8358',
  date: '2026-11-23',
  title: 'Working hours: the dev seat sets a person\'s week',
  kind: 'feature',
  highlights: [
    'A coding agent on the dev seat can now set a person\'s working hours with the pay plan it already uses. It names each day\'s start and end.',
    'The plan goes through the same door as the Working hours row on a person\'s sheet, so the same rules hold.',
    'Before anything is written the plan says what the hours are now, what they become, whether pay moves and when the clock follows.',
  ],
}

export default note

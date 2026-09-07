import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3064',
  date: '2026-09-07',
  title: 'Sub sheets move to “Waiting on inspection” on their own',
  kind: 'feature',
  highlights: [
    'When a sub reports 100% from their portal, or the signed work order’s last day has passed, the sheet’s rail shows Waiting on inspection by itself, marked “auto” — nobody has to click.',
    'Moving a sheet back to Waiting on work by hand after that keeps your call. Waiting on customer is still set by hand once the inspection passes.',
  ],
}

export default note

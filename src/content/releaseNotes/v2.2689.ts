import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2689',
  date: '2026-09-03',
  title: 'Prospects: the "never called" chip clears the moment you log the call',
  kind: 'fix',
  highlights: [
    'Didn\'t Answer / Answered now clear the "never called" chip and update the Prospect List right away — the chip used to stay up until the page reloaded, even with the call sitting in the comments.',
    'Typed the call result and pressed Enter? That saves a note, not a call. The comment box now says so, and clicking Didn\'t Answer or Answered right after tags that note as the call instead of adding a second "Contacted" line.',
    'Errors while logging a call now show a toast instead of failing silently.',
  ],
}

export default note

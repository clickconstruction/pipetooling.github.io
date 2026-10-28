import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6035',
  date: '2026-10-28',
  title: 'The text back after a missed call goes on the hang-up, not only on the call’s end',
  kind: 'fix',
  highlights: [
    'A caller who reaches the greeting and hangs up now gets the text back. Quo reports such a call only as missed, never as ended, and the app waited for the end. It now texts on whichever report comes first, and still only once per call.',
    'The voicemail line goes when Quo reports the voicemail before the text; a caller who leaves one otherwise hears the in-hours line, which the Missed calls card and the guide now say.',
  ],
}

export default note

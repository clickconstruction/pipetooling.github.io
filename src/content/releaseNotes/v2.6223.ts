import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6223',
  date: '2026-10-31',
  title: 'Quickfill’s round stays on your device when the app is slow',
  kind: 'feature',
  highlights: [
    'The Roller and the phone’s round keep the deck you last read on your device. On a slow morning the round draws at once under a line that reads “Counts from 7:52 AM · counting again…”, with each station’s count and Next line as they were at that read, instead of the chips over a blank page. Once the live read lands the line goes.',
    'While the count on screen is the kept one, Done and Worked it wait as grey presses that say “reading again…” when you hover, so a mark never records yesterday’s count. Skip, Not sure what to do, the dots, Groups and the station itself stay live.',
    'When the round’s read fails, the kept deck stays and the line reads “could not read again · Retry”. With nothing kept, the Roller names what went wrong and offers Retry when the signal was the trouble.',
    'The Roller now counts only the station on screen. Every other station shows its count at last look, from its mark history, so a desk open on the Roller makes far fewer reads. The Page and Focus views still count every station.',
  ],
}

export default note

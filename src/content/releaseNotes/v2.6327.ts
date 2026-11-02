import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6327',
  date: '2026-11-02',
  title: 'Messages keeps who was waiting when the app is slow',
  kind: 'feature',
  highlights: [
    'Messages keeps the lists you last read on your device. On a slow morning, or with no signal, they draw at once under a line that reads “Who was waiting at 7:52 AM · reading again…”, with the counts on the bar from that read, faded. Once the live read lands the line goes.',
    'While the lists on screen are the kept ones, Take it and every press that writes on a row wait, and say “reading again…” when you hover. Sort all and Answer all wait too. A row still opens its thread, Reply still opens it and Call still dials.',
    'When the read fails, the kept lists stay and the line reads “could not read again · Retry”. With no signal, the page reads again by itself when the signal is back. With nothing kept, the page says what went wrong instead of “Loading who is waiting on us…”.',
    'Waiting on them and Went out read … until their own read lands, on the bar and on their headings, so a slow morning never counts them as empty.',
  ],
}

export default note

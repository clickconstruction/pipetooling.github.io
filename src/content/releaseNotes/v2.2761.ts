import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2761',
  date: '2026-09-04',
  title: 'GC Review: mark a statement sent by text, call, or in person — with a note',
  kind: 'feature',
  highlights: [
    'Sent it in the statement round now asks how it went out (email, text, call, in person, other) and takes an optional note before it stamps the mark.',
    'Share → Mark sent… on any GC header records a send that happened outside the round — any GC, any amount — and counts everywhere a send counts.',
    'Every mark keeps who, when, how, and the note. The sent chip shows the channel and a pencil when there is a note; hover to read it.',
    'Click a GC\'s last-sent pill to see its full send history — every mark on record, newest first.',
  ],
}

export default note

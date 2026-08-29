import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2473',
  date: '2026-08-28',
  title: 'Followup opens on the Call queue',
  kind: 'feature',
  highlights: [
    'Clicking the Followup tab in Bids now lands on the Call queue — the one-list lens with the To do / Done cards — instead of the older By builder lens.',
    'The four original lenses (By builder, By status, Why we lost, Waiting to hear) are unchanged, one click away behind the "Old:" divider.',
    'If you flip to one of the old lenses, re-clicking Followup keeps you where you are instead of yanking you back.',
    'Links that point somewhere specific — a bid\'s share link, the "record loss reasons" chips — still land exactly where they always did.',
  ],
}

export default note

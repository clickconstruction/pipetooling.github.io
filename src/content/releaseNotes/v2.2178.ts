import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2178',
  date: '2026-08-23',
  title: 'Followup → By status lists one row per GC',
  kind: 'feature',
  highlights: [
    'A bid sent to several GCs now shows one row per GC in the By status lists, each in the bucket that GC\'s answer puts it — won with one builder under Won, lost with another under Lost.',
    'The GC column names the GC the row is for, with a quiet second line for where else the bid went and how it ended; ↗ opens that builder on By builder.',
    'In the Lost list, a multi-GC row shows and edits that GC\'s reason (the auto "GC lost the project" beside a win included); single-GC bids look and work exactly as before.',
  ],
}

export default note

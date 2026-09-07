import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3046',
  date: '2026-09-07',
  title: 'Safety net under the office address',
  kind: 'fix',
  highlights: [
    'The office address that anchors “Distance to Office” on bids now has 4 tests pinning what a saved address must contain, how saving from an address succeeds or fails, and the fallback to the Map default view; no behaviour change.',
  ],
}

export default note

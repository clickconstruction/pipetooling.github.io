import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2188',
  date: '2026-08-23',
  title: 'Modals announce themselves properly (accessibility)',
  kind: 'infra',
  highlights: [
    'About 120 dialogs across the app now carry the standard dialog role, so screen readers announce them as modal windows and the new page-freeze behind modals detects every one of them explicitly. Nothing changes visually.',
  ],
}

export default note

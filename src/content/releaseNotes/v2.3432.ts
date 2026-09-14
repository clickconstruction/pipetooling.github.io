import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3432',
  date: '2026-09-14',
  title: 'Pipeline: the percent under the bar says when and how it was set',
  kind: 'feature',
  highlights: [
    'On Jobs → Pipeline, the words under the Progress & payment bar now date every percent, not only the ones typed in the % done box: “40% set Aug 7” for a number the job already carried when percent history began, “12% reported Sep 11” when a field report set it, “90% typed Sep 3” when the office typed it.',
    'A percent that a report set after the crew’s last clock-in now counts as fresh and is drawn on the bar; before, any percent without a typed date was treated as stale as soon as a crew clocked in.',
  ],
}

export default note

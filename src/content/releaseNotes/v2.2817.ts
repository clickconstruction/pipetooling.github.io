import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2817',
  date: '2026-09-05',
  title: 'Job Summary — Compare to a prior period, and a target margin',
  kind: 'feature',
  highlights: [
    'Two new controls on Jobs → Job Summary. Compare to runs the same view on the prior period (or the same dates last year) and puts a ▲ / ▼ delta line under every tile: jobs, revenue, gross, overhead, true profit, per field hour.',
    'Target sets a true-margin bar (30 / 35 / 40%). Jobs under it turn red in the True % column with a ▾, and a chip counts them so you can sort straight to them.',
    'Both are remembered per device and keep Show, Worked in, and Overhead exactly as set, so the comparison is like for like. "All" has no earlier window, so Compare to rests there.',
  ],
}

export default note

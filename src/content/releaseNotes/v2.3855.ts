import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3855',
  date: '2026-09-26',
  title: 'Every component smoke test settles before it reads',
  kind: 'fix',
  highlights: [
    'A script walked all 263 component smoke tests and, wherever a test read or clicked the instant a data-loading component first painted, put one settling step in between — 376 places in 84 files. Tests of components that load nothing were left as they were.',
    'Two checks that had been reading the first paint by accident now read the settled screen. Nothing in the app changed; the checks that guard every pull request stop failing on a busy machine.',
  ],
}

export default note

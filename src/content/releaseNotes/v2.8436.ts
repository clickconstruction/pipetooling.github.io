import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8436',
  date: '2026-11-24',
  title: 'Agreements: a trade company’s waiting paper opens on People',
  kind: 'fix',
  highlights: [
    'On Documents → Agreements, the name of a trade company’s paper that waits on a signature now opens People → Contracts on that paper. It used to open the GC page, which shows no paper.',
    'The paper is marked under its company’s row, where Send for signature is.',
    'If no one on your People list works at the company, the tab says the paper is kept in GC mode.',
    'A signed paper still opens its signed record, and a GC project’s paper still opens the GC page.',
  ],
}

export default note

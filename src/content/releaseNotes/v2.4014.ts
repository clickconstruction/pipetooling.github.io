import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4014',
  date: '2026-09-28',
  title: 'Takeoffs: "In N assemblies" counts every assembly',
  kind: 'fix',
  highlights: [
    'On a Combined takeoff, the "In N assemblies" link under a part now counts every assembly that holds the part. The list of assembly contents had grown past 1,000 rows and the app was reading only the first 1,000, so assemblies could be missing from the count and from the Add assembly list when you filtered it by a part.',
    'Materials → Assembly Book and PO Builder read assembly parts and prices the same complete way, so a trade with many assemblies cannot show a filled assembly as empty or a cost that is too low.',
    'Nothing was lost or changed in the assemblies themselves. They were only being read short.',
  ],
}

export default note

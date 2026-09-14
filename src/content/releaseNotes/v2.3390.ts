import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3390',
  date: '2026-09-14',
  title: 'Contract sweep: find the signed contracts already in Google Drive',
  kind: 'feature',
  highlights: [
    'Most signed contracts already live in the jobs Drive. The sweep’s ⋯ menu gains Look in Drive for signed contracts… (devs first): it reads the jobs Shared Drive, matches contract-looking files to the jobs without a contract by folder and file name, and says how sure it is — Confident · Check · No match — with the reason on every row.',
    'File the N confident files them all with the Drive link as the signed copy (✍ On file · Google Doc); Check rows file one at a time. Nobody is emailed.',
    'Waits on one thing: connecting Drive (the intake service account shared into the Jobs folder). Until then the door says so plainly.',
  ],
}

export default note

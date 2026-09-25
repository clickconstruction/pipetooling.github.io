import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3822',
  date: '2026-09-25',
  title: 'Today’s Money Opportunities: two-line cards',
  kind: 'feature',
  highlights: [
    'Every card on the Pipeline’s money strip is now two lines: the count and the money on the first, with the door as a link at the right end of the same line — no button row — and the facts as chips on the second.',
    'The lien-notices card reads “18 lien notices due · $168,306”, then its piles as chips (13 to draft · 3 need an owner · 2 awaiting approval) and the earliest window as one colored chip (“closed Sep 15 · RMC- Dudley Mason”). Each chip opens the Lien desk on that pile.',
    'The burn card reads “4 jobs burning · $23,410 margin at risk”, then the worst three jobs as chips (“≈ J523 Mission Hills · 96% spent at 90% done”), each opening that job’s Costs tab; “+N more” opens the full list.',
    'Every sentence the cards used to spell out — closed 10 days ago, mail by Oct 15 or the lien right is gone, against an assumed budget, each opens on its Costs tab — is a hover now. Nothing is lost; the strip is a third shorter.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3799',
  date: '2026-09-24',
  title: 'Lien notices due sit on the Pipeline’s money strip',
  kind: 'feature',
  highlights: [
    'Jobs → Pipeline → Today’s Money Opportunities gains a Lien desk card whenever a notice is due — “⏱ 5 lien notices due · $28,987 — the earliest by Oct 3” — with the piles under it (to draft, waiting on the owner of record, awaiting approval, approved for the run). Red inside a week of the first window closing, amber inside two. Open the Lien desk → lands on Notices. Nothing due, no card.',
    'The count, the dollars and the date are the desk’s own, so the card never disagrees with the desk or the Dashboard’s lien card.',
    'The jump strip’s ☰ Section tools menu now lists ⏱ Lien desk · N as its first row instead of at the foot under Collections, where it was easy to miss.',
  ],
}

export default note

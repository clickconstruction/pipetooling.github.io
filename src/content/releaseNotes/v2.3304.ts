import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3304',
  date: '2026-09-11',
  title: 'Test reports on the customer portal',
  kind: 'feature',
  highlights: [
    'A GC or homeowner opening their statement now sees each sent test report on the job it belongs to — "Sewer Pre-Test Hydrostatic · PASS · Sep 10, 2026 · certified by Malachi Whites" — right between the job line and its bill, with a View report button that opens the exact PDF they were emailed.',
    'A Test reports card lower on the page keeps every sent report, paid jobs included, so the pre-test is still there when the post-test comes around.',
    'Only sent reports appear, never drafts; the link to the file expires in five minutes and is minted fresh on every click. No money, no notes, no tech name.',
    'Settings → What customers see shows the rows on the sample statements.',
  ],
}

export default note

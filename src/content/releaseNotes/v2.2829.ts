import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2829',
  date: '2026-09-05',
  title: 'Sub work order on the job window, and a nudge for unpriced drafts',
  kind: 'feature',
  highlights: [
    'The job window\'s Edit tab gains a Sub work order row under Contract: draft one for the sub the master plans to use, open a draft to price it, or view the signed record. The View bill panel shows the same line read-only.',
    'An assistant taking a job in can save the work order without a price; the dashboard\'s Needs You card then tells the master how many drafts are waiting and opens Jobs → Work Orders on the Drafts filter.',
    'A Sub Labor sheet\'s Work order box now opens the assembler with the sheet total as the price, so every work order is the same document. Project steps and the Person Desk link straight to the order on the board.',
  ],
}

export default note

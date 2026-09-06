import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2922',
  date: '2026-09-05',
  title: 'Sub Labor as a pay run; the sub portal explains how they get paid',
  kind: 'feature',
  highlights: [
    'Jobs → Sub Labor is a pay run now. Four tiles answer Friday (owed to subs, ready to pay now, queued for the pay-run day, not payable yet and why), and "Who\'s owed" lists one row per sub with a bar showing where the money sits and a Pay button when part of it is ready.',
    'The ledger groups sheets under their sub, payable first, with a Pay when column (Ready · Queued · Waiting on customer · After the walk-through · Not payable · Payroll), an inline "set payable after…" on waiting rows, filter chips with counts, and Edit · Print · Payment · Back-charge behind ⋯. A sheet shared with teammates is named for its sub ("Behar Kraja · with Malachi, Abraham").',
    'Did they look? Every visit to a sub\'s portal is on record — the sub as outside, a signed-in teammate as team, your previews kept off the counts. Who\'s owed shows "Opened their page Sep 4 · 6 times" or "Never opened" under each name; tap, click or long-press it for the trail. The story\'s Portal cell and the globe\'s gear show the same.',
    'The sub portal now answers "How do I get paid?" — a card at the very bottom opens a guide (English and Spanish) that walks Work · Pre-inspection · Post-inspection: Trigger draw · You\'re paid with the card\'s own sentences, the one button, offers, documents and deductions. Those four step names replace Walk-through and Customer pays on the job cards and the office rail, and a job with plans online shows a 📐 Plans pill on its card. Sheet story doors: "Show me on their portal ›" and the Binds-under line to the sub\'s Paperwork.',
  ],
}

export default note

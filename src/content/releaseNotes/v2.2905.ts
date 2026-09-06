import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2905',
  date: '2026-09-05',
  title: 'Bids papercuts — honest dates on the board, no flashing empty states, one name for an unnamed GC, labelled Labor inputs',
  kind: 'fix',
  highlights: [
    'Bid Board: the Bid lens\'s Last contact now shows the Chicago date (a 10 PM call no longer lands on tomorrow); Not yet won or lost prints the sent date it sorts by under every Due chip; an unsent bid with no due date shows a dashed "No due date (+N)" chip that turns red after 14 days; the board says "Loading bids…" instead of flashing "No bids yet" while it fetches; the robot tab reads "🤖 Robots".',
    'Cover Letter: Print and Copy & open in Google Docs stay greyed until Pricing has loaded, so a "$0.00" letter can\'t be printed or copied; a packet with no GC yet is addressed to "General contractor" on the letterhead, the Bid Room panel, the picker, and the GC\'s own room page (instead of "—", "— —" or "the GC").',
    'Followup Call queue: among builders nobody has called, the one whose bid has waited longest is on top (not the alphabet), and a note on a lost bid no longer counts as contact. Workflow tabs: your selected bid survives a refresh after clicking between Counts, Takeoffs, Labor, Pricing and Cover Letter; the By Stage / Combined pills and the switch confirm explain what each model means; the Workbench says "0 unassigned rows match the book" instead of "Fill 0 matching".',
    'Labor: all 25 number inputs have screen-reader names, and each cell shows its own unsaved (amber) / saving (blue) underline instead of one "Saving…" line at the bottom.',
  ],
}

export default note

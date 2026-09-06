import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2889',
  date: '2026-09-05',
  title: 'Bank-label rule matches can approve themselves — and a Needs You card counts the ones that still need a person',
  kind: 'feature',
  highlights: [
    'Banking → Accounting gains an org-wide switch, "Rule matches approve themselves" (dev or master technician flips it; it ships off). When on, every new rule match is approved the moment it is created — from the bank feed or Apply rules — whether or not anyone has the tab open. It replaces the old per-person "Approve by default" checkbox, which only worked while that person was looking.',
    'Internal Transfers suggested for a transaction that already has job splits still waits for a person, and a label someone set by hand is never overwritten. Nothing already pending is touched — Approve all clears the backlog as before.',
    'A new Needs You card on the Dashboard and Quickfill — "N bank-label suggestions have waited 3+ days for an OK" — counts only the stale exceptions and the money sitting as Unlabeled, and opens the Approvals list.',
  ],
}

export default note

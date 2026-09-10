import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3242',
  date: '2026-09-10',
  title: 'Match sessions: Reject replaces Skip',
  kind: 'feature',
  highlights: [
    "On Quickfill's Match sessions to jobs block and the People → Hours Match sessions modal, each floating session now has a red Reject button instead of Skip. Skip only hid the card until the next visit; nothing was written and the session came back.",
    'Reject asks once — "Reject Bryan · Sat 9/5 · 9h 30m? Rejected time never reaches payroll." — then rejects the session the same way the approvals queue does. The card drops out for good and the hours never reach payroll.',
    'Sessions still clocked in have no Reject; wait for the clock-out. Rejected by mistake? People → Hours → Rejected sessions has Restore.',
  ],
}

export default note

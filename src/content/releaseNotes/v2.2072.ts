import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2072',
  date: '2026-08-22',
  title: 'Personal statement rounds',
  kind: 'feature',
  highlights: [
    'Every GC over $10,000 outstanding joins a weekly statement round — assigned to a sender (their Account Man by default), released only once you certify that GC in GC Review.',
    "The sender works their round one GC at a time: Preview, Copy for email into their own inbox, add a personal line, send — then Sent it. Nothing ever emails on the system's behalf.",
    'Two new Pipeline cards drive the week: 🔏 rounds waiting on your sign-off, then 📬 your own certified, ready-to-send round. "Sent it" counts in the last-sent pills and week progress; mis-clicks undo from the rounds panel.',
  ],
}

export default note

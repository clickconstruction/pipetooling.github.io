import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6515',
  date: '2026-11-04',
  title: 'The Lien desk’s Do now has a Reminders strip between Notices and Affidavits',
  kind: 'feature',
  highlights: [
    'A fourth strip, Reminders, sits between Notices and Affidavits on Do now: 1 Reminder due, 2 Reminder sent, 3 Letter two, 4 Closed, each with its count. Step 1 says beside its count how many sent notices are still before day 7.',
    'Press a step to see only its rows, as the other strips do. A step whose notices have no row on the list, like the closed ones or a letter two drafting, lists them under the strip with a door to each notice.',
    'The courtesy and letter-two rows now read under a Reminders heading of their own, so Needs you now holds dated work and the leader’s list holds approvals. Their dots read 1/4 or 2/4 on the Reminders ladder, and on a phone the four tiles read Due, Sent, Letter two and Closed.',
    'Nothing new is sent or written. The strip reads the courtesy status and letter two’s clock the desk already holds. Punch list #262; the fuller version is #235, the lien month.',
  ],
}

export default note

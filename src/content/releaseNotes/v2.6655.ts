import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6655',
  date: '2026-11-07',
  title: 'The courtesy reminder waits for reminders week',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A sent notice’s courtesy reminder is now due in reminders week of the lien’s month, days 1 to 5, never before day 7 after the packet. Until then the footer says when it goes, like The reminder goes Dec 1 to 5, instead of asking for three weeks.',
    'The Reminders rail’s first step counts those notices beside its number as waiting for reminders week, apart from the ones still before day 7. The step’s brief and § Rules say the rule in words.',
    'The footer still sends a reminder earlier by hand. Past reminders week an unsent reminder stays due until the affidavit’s week, and the lien month bar counts it as slipped.',
    'The guides on the courtesy notice, the reminders ladder and the Lien desk say the same.',
  ],
}

export default note

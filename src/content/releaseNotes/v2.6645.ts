import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6645',
  date: '2026-11-07',
  title: 'The lien month: the office’s rhythm written down under § Rules',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Lien desk’s § Rules window now names the lien month under the schedule: reminders on days 1 to 5, notices on days 6 to 9, liens on days 10 to 13, the 14th and 15th for what slipped, nothing scheduled from the 16th. The owner set the days on 2026-11-07.',
    'A courtesy reminder goes once, in reminders week of the lien’s month. Notices week sends the notices due this 15th; a notice due a later month waits for its own month.',
    'Nothing on the desk changes yet. The bar across the top of Do now, the Dashboard card and the reminder’s clock follow in the next three releases.',
  ],
}

export default note

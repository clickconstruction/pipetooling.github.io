import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4271',
  date: '2026-09-30',
  title: 'Add clock session stops at the assistant’s hours window, in the calendar and in the database',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Add clock session now has one Day picker and two times. For an assistant the calendar greys out every day before her hours window and every day after today, and a line under the day names the earliest day she can use.',
    'From the Hours strip the day can be changed inside the window, so a missed Friday is added without first walking the strip back to it. From a day audit or the Team board the day is in the title and there is no day to pick.',
    'The database refuses a session typed or moved onto a day before the assistant’s window, whatever screen it came from. Approvals, rejections and notes on older sessions still go through.',
    'Settings → People & teams: the assistant hours window now says it is how far back assistants see and type hours.',
  ],
}

export default note

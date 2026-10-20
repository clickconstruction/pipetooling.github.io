import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5640',
  date: '2026-10-19',
  title: 'The app’s own description of the database knows quick reply shortcuts and the new job trail lines',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen. The two database changes of 2026-10-19 (a quick reply’s shortcut, and the trail lines for contract reminders, demand letters, lien notices and resent bills) are in the app’s generated description of the database and the dev seat’s catalog.',
    'Both were applied on the live database before the description was regenerated, and every edge function that carries the shortcut’s kernel was redeployed.',
  ],
}

export default note

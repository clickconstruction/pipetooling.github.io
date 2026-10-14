import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5536',
  date: '2026-10-14',
  title: 'Messages: a webhook made in Quo’s own settings is recognized',
  kind: 'fix',
  roles: ['dev', 'master_technician'],
  highlights: [
    'Quo signs a webhook made in its own settings an older way. The app refused every one of its deliveries as unsigned, and Quo kept sending them again.',
    'The app now checks both of Quo’s ways of signing. That older webhook sends events in Quo’s older format, which the app answers and sets aside. Texts and calls come in through the webhook made with Quo’s API.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7595',
  date: '2026-11-17',
  title: 'Prospects: the email templates’ rules moved into their own tested file',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The three email templates on a Follow Up card fill in, warn about missing details and open your mail as they did.',
    'This is the first cut of the Prospects page, the largest file in the app. The rules that fill a template now have their own tests.',
  ],
}

export default note

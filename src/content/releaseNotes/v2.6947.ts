import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6947',
  date: '2026-11-11',
  title: 'Your card and footer: every phone number reads the same way',
  kind: 'fix',
  highlights: [
    'The business card and the email footer now print every phone number as (512) 555-0142. Before, your mobile printed the way it was typed on your account, so it could sit beside the office line in a different shape.',
    'Nothing changes on your account. Only the card and the footer are drawn this way.',
  ],
}

export default note

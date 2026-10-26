import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5875',
  date: '2026-10-26',
  title: 'Messages: one more push before the hour is missed',
  kind: 'feature',
  highlights: [
    'When a customer, a lead or a sub has waited 50 minutes and nobody has answered, whoever has the conversation hears once more on their phone. When nobody is named, the whole office hears.',
    'The push says the hour is close, because the Messages page measures the week by answers within an hour.',
    'It is dropped the moment anyone answers, it never repeats, and it never comes after hours or for a reply the Lien desk routes.',
  ],
}

export default note

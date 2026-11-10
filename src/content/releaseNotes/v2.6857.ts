import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6857',
  date: '2026-11-10',
  title: 'Permits: every count says how far back it can see',
  kind: 'fix',
  highlights: [
    'A builder’s count on Prospects → Permits now says the day the records start, such as 4 permits since Aug 26. It said this year and the last 365 days on ten weeks of records.',
    'The Who pulled it card says a name is on 3 other permits we can see. It no longer says the name pulled them, since the city lists one contact and it is not always the builder.',
    'Builders opens with one line saying where the city’s records start, and its count column carries the same day.',
    'Once the records reach back a whole year, the same lines say in the last year again by themselves.',
  ],
}

export default note

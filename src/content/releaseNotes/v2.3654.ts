import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3654',
  date: '2026-09-20',
  title: 'Developers: the “can every server function start?” check no longer trips the platform’s rate limit',
  kind: 'fix',
  highlights: [
    'The first live run of the new health checks found that checking all 123 server functions at once hit the platform’s limit of about 60 checks a minute — and the report wrongly described the refused half as not answering.',
    'The check now works through the list 50 at a time and says how to continue, and a check the platform refused is reported as exactly that — never as a broken function.',
    'Everything else answered correctly on the live system: no database freezes in the last day, connections at 17%, no lock waits, and every database change accounted for.',
  ],
}

export default note

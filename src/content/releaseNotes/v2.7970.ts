import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7970',
  date: '2026-11-19',
  title: 'Robots: an assistant can archive a twin and stop the rounds',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now take a twin out of the fleet, as Archive on Settings → System → Digital twins does. Its live keys are revoked first, and its runs, shadows and bids stay.',
    'It can bring an archived twin back, as Restore does. The twin comes back with no key.',
    'It can stop the rounds on a twin’s key and start them again, as the Rounds card on Bids → Robots → Console does. The robot finishes the bid in hand, then claims no more.',
    'Each plan shows what would change before anything is written, and the stop plan says what each key has in hand.',
  ],
}

export default note

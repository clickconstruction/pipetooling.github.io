import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3248',
  date: '2026-09-10',
  title: 'Customer Waiting, part 3: the banner that follows the team',
  kind: 'feature',
  highlights: [
    'While a customer is waiting on a portal request, everyone in that inbox sees a red strip above the top nav on every page — "Jane Doe is waiting · 14 min", their words, a Call button and Open. The minutes tick.',
    'Once someone calls, the strip turns amber for everyone else — "Sam called Jane Doe 2:14 pm" — and stays until the request is lowered or closed, so nobody else calls her too.',
    'The Dashboard\'s Needs you card carries the same item at the very top. On the inbox page itself the strip collapses to one quiet line.',
    'Estimators see it for bid requests; Dispatch members for visits and GC date asks; devs for both.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2341',
  date: '2026-08-26',
  title: 'Portal statement opens are now counted',
  kind: 'feature',
  highlights: [
    'When a customer or GC opens their statement portal, the app now counts the visit — so we can see whether the statements we send actually get looked at.',
    'Only the fact of the visit is recorded (which company, when, link or short address) — nothing about what they did on the page.',
    'Estimate-page opens were already counted; this closes the gap for the portal.',
  ],
}

export default note

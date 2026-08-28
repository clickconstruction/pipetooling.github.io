import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2472',
  date: '2026-08-28',
  title: 'Change orders land in the bid room',
  kind: 'feature',
  highlights: [
    'A change order drafted from a bid can now be published straight into the GC\'s bid room — the same link they signed the proposal on. No new email, no new link to lose.',
    'The room shows the whole paper trail: the signed proposal on top, each change order beneath with its cost, reason, and schedule impact — and its own Review & sign.',
    'Signing a CO records the signature on the change order itself; declining takes an optional note. Neither ever touches the bid\'s won/lost.',
    'Room chips everywhere now count the thread — "✍ signed — Base bid $249,971 · CO awaiting" stays amber until every document is answered.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3327',
  date: '2026-09-11',
  title: 'Cash App reconcile: decide each send with one button',
  kind: 'feature',
  highlights: [
    'Every send still to review now has Record, Advance, Already recorded, Not pay and Skip beside it.',
    'Record picks the report the send most likely pays (the week that just ended) and writes the payment with the Cash App ID in the memo, so the next import matches it exactly. You can change the report or the amount before saving.',
    'Advance files the send as a pending offset; it is offered as a Less line the next time that person\'s report is generated.',
    'The names step can mark an account as a proxy: "when the note contains … it\'s for …".',
  ],
}

export default note

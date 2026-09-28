import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3964',
  date: '2026-09-27',
  title: 'Bid room: a change order signature now records the electronic-signature consent',
  kind: 'fix',
  highlights: [
    'A GC signing a change order in the bid room now sees the same electronic-signature line as on the proposal, with How electronic signing works beneath it and its own box: I agree to sign electronically.',
    'The change order cannot be approved until that box and the change order’s agree box are both ticked.',
    'The words the GC agreed to are now kept with the change order’s signature. Before this, a change order signed in the bid room kept the name, time and device but not the consent words.',
    'Signing the proposal itself is unchanged.',
  ],
}

export default note

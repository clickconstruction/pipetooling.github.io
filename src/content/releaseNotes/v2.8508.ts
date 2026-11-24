import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8508',
  date: '2026-11-24',
  title: 'Lien: the release waits for the money and takes the county’s stamp',
  kind: 'feature',
  highlights: [
    'The Release of record tab now says what the money says. While the job’s bills still owe, its buttons wait. Release it anyway takes a typed reason for a lien settled for less.',
    'The payment date starts on the day of the last payment. A lien takes one release, and a job with two filed liens asks which one.',
    'Once the clerk records the release, set Recorded on and Instrument number right on the tab. The lien then reads Released on the Lien desk’s Payoffs.',
  ],
}

export default note

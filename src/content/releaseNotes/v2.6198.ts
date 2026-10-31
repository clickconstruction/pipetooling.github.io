import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6198',
  date: '2026-10-30',
  title: 'Offline in the field: the clock row stays, a kept clock-out reads true, and a kept note has your name',
  kind: 'fix',
  highlights: [
    'With no signal, bringing the app back to the front or a sign-in renewed in another tab no longer drops the Dashboard’s clock row, Job Report, My Spend and the header’s buttons. The app keeps who you are and checks again when the signal is back.',
    'A clock-out kept on the phone no longer has a red line under it saying nothing was saved. When the clock cannot load with no signal, it says so in its own words and loads again when the signal is back.',
    'The clock shows what you pressed with no signal. A kept Clock In stays clocked in when you come back to the Dashboard before the signal does, and a kept Clock Out stays out if the clock loads before it is sent.',
    'A note written with no signal shows your name on the thread, not Unknown.',
  ],
}

export default note

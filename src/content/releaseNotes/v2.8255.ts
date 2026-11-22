import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8255',
  date: '2026-11-21',
  title: 'Messages: the day a customer said is filled in when you write down their word',
  kind: 'feature',
  highlights: [
    'When a customer’s own text or voicemail names a day, the day now shows beside Write down their word under that line. It reads “They said Fri Nov 27.”',
    'Pressing the button opens the sheet on They’ll pay by… with that day already in Pay by. A line under the job says the day was read from their text or voicemail.',
    'The day is an offer. Change it in the sheet when they meant another day. Nothing is written until you press Save promise.',
    'A call or an email shows no day, since those lines carry words that are not the customer’s alone. A day that has already passed shows none either.',
  ],
}

export default note

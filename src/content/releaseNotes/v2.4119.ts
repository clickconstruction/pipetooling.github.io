import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4119',
  date: '2026-09-29',
  title: 'Lien desk: back from the post office — the run remembers what you printed and asks for the tracking numbers',
  kind: 'feature',
  highlights: [
    'Printing the run now puts its notices in a pile of their own, "In the mail · tracking owed", so a printed notice can never go quietly missing between the printer and the record. The run window shows the three steps: print, mail, record the mailing.',
    'Back from the post office, type one certified number per envelope. The shape is checked as you type — a certified article number has 20 digits — and the envelopes with a number record now while the rest stay in the pile. Type the day they were mailed once.',
    'A notice recorded without its number is no longer stuck: its Sent row reads "tracking owed" and offers "add the number", the job\'s Lien window offers the same beside each filing, and the Dashboard\'s Needs You says how many mailed notices still have no number.',
    '"Envelope faces" prints one page per envelope — the return address, the certified line, a blank for the article number, and the recipient exactly as the notice names it — so nothing is copied by hand.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4468',
  date: '2026-10-03',
  title: 'Lien desk: a notice sent or noted in the evening keeps its day',
  kind: 'fix',
  highlights: [
    'On the Lien desk, a notice sent, sent for approval or approved after 7 pm Central showed the next day. So did the owner’s call, the GC’s okay, a correction to the claim and a closed window someone noted.',
    'Letter two counted its days from that next day, and a sent notice stayed in Sent a day too long. Both now count from the day on the company’s calendar.',
    'A notice recorded on the evening its window closed no longer reads as mailed after the window. The desk, the Lien window and the legal packet agree.',
    'A job with no clock hours made on the last evening of a month is dated from that month on the Pipeline’s lien chip and in the Lien window, as the Lien desk already does.',
  ],
}

export default note

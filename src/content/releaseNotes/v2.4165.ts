import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4165',
  date: '2026-09-29',
  title: 'Robots: the needs sheet leads with the plans folder, and the Bid Board says how many bids are waiting on plans',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Click an amber robot and the sheet opens on one large card, No plans yet: the division bid folder to open, the name to copy, put the PDFs in it, Find the folder. Find saves the link straight onto the bid, so the robot picks it up on the next batch without opening the form.',
    'The three things that do not block (the GC, the distance from office, the due date) fold into one line with one Edit bid, instead of a row and a button each. The doubled “Not blocking — Not blocking” is gone.',
    'The Bid Board carries the line the Robot Board had: “6 bids are waiting on plans. Put the PDF in each one’s folder and a robot prices each one tonight. About a minute each.” with Add the plans → to the Robot Board.',
    'Every mention of “the intake address” now says the robots’ Drive account.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5734',
  date: '2026-10-22',
  title: 'Dashboard: when the robots go quiet, and when one is stuck on the plans',
  kind: 'feature',
  highlights: [
    'When no robot has checked in for fifteen minutes, the owner’s Needs You card says since when, and what to do: wake the Mac and open Claude. The rounds start again on their own. Snooze it for a day, or dismiss it until the next round.',
    'When a robot cannot open a bid’s plans, the estimator’s Needs You card names the bid and opens its needs sheet, where sharing the folder or attaching the PDF sets the robot going again on the next round.',
    'Progress itself never lands on the Dashboard. The bid’s own icon and sheet carry that.',
  ],
}

export default note

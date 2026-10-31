import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6188',
  date: '2026-10-31',
  title: 'The robot’s fixtures, yours to take: a window on the Counts tab',
  kind: 'feature',
  highlights: [
    'Once the robot seals its number on a bid, the Counts tab shows Robot fixtures with a count. Press it to see every fixture the robot found on the plans, with the schedule row, the count per sheet, the plan text that backs it, the robot’s own check and its price.',
    'Tick the ones you want and press Add. They land on your count shaded, with a Robot pill, for the life of the bid. A fixture already on your count can take the robot’s number and keep your parts and prices. Undo is on the toast.',
    'A robot row has no delete. Its trash can reads Set aside: the row leaves your count and waits with your reason, one press from Put back. The fold line under the sheet lists what you set aside.',
    'Your price book prices a robot row by name. Where your book has no entry, the robot’s price lands as the row’s custom price. The Pricing tab’s marks and the robot icon’s door come next.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note

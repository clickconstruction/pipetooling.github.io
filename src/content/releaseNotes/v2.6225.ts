import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6225',
  date: '2026-10-31',
  title: 'The robot’s price beside yours, and two more doors to its fixtures',
  kind: 'feature',
  highlights: [
    'On the Pricing tab every row the robot landed shows the robot’s price in grey beside yours. A row your book could not price wears a robot’s price chip, and Use my book hands it to your book the day you add the entry. Rows that landed before you picked a price book get one button that prices them at the robot’s prices.',
    'The robot icon’s sheet on the Bid Board now has Fixtures ready with the count. Press it and the bid opens on the Counts tab with the robot’s list already up.',
    'In the robot fixtures window, Open sheet on any line of plan text opens the Plans panel on that sheet.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note

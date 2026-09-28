import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4055',
  date: '2026-09-28',
  title: 'Takeoffs: look a part up on Google from its line',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator'],
  highlights: [
    'Every part name on Bids → Takeoffs ends with a small magnifier. Click it and a new tab opens with a Google search for that name, exactly as written on the line.',
    'It is on each part inside an assembly and at the right end of a single part line’s name box, in both Sheet and One at a time. Fixtures and assembly names do not get one.',
    'An ordinary link, so ⌘-click, middle-click and open-in-new-tab all work. The takeoff stays where it was and nothing on the bid changes.',
  ],
}

export default note

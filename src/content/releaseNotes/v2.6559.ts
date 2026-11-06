import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6559',
  date: '2026-11-06',
  title: 'The pre-use check on the phone: walk the machine, read its gauges, take the photos and sign, then a short leaving check at the end of the day',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'helpers', 'assistant', 'controller'],
  highlights: [
    'The Job Mode card lists the machines on your job under the stage checklists, amber until someone walks one today, green once checked, red while held. The label on the machine opens the same check when you scan it.',
    'The walk asks one question at a time, Yes, No or Not here. A No takes a few words and a photo, and a No on a holding question holds the machine and tells Dispatch when you sign. The gauges are drawn the way they look on the machine, and a tap opens one full screen to drag.',
    'The hour meter shows the last reading and the change. Five photos, the meter, the four sides and anything wrong, file into the machine’s own Drive folder within minutes.',
    'Once the walk is signed, a second line asks the short leaving check at the end of the day: anything new wrong, the gauges, the hours and where the machine is tonight, which moves it on the fleet board. The office opens the newest check from the fleet card and can say run it anyway on a held one.',
  ],
}

export default note

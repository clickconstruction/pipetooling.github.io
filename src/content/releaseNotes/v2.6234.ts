import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6234',
  date: '2026-10-31',
  title: 'Lock a bid version so only you edit it',
  kind: 'feature',
  highlights: [
    'On the Versions strip, press the open lock beside your version. Then only you change its counts, takeoff, prices, CountTooling projects and plan sets. The lock is off on every version until you press it.',
    'Everyone else still reads, sends and copies the version. If they try to change it, the app names who locked it and asks them to ask you, or a master. A dev or a master can open any lock.',
    'Every lock and unlock leaves a line in the bid\'s log.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note

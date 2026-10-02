import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4394',
  date: '2026-10-02',
  title: 'Materials: prices that look wrong show up so you can fix them',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'The What your materials cost card lists any price that looks wrong, such as a $999,999 stand-in or a sudden jump.',
    'Each one says what it was before and which open bids use it. Press Fix price, or It’s right when the change is real.',
    'In a part’s Price History, a rise now reads orange and a drop blue. A price checked again reads Checked.',
  ],
}

export default note

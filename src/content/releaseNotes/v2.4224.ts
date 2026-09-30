import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4224',
  date: '2026-09-30',
  title: 'An alternate with no price says “price to follow”',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A cover letter used to print an unpriced alternate as “add $0”, as if the section came free. It now reads “price to follow”.',
    'Under In this cover letter, the alternate’s row says “not priced yet” in amber, so you see it before the letter goes out.',
  ],
}

export default note

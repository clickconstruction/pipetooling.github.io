import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4451',
  date: '2026-10-02',
  title: 'Bids on a phone: the title line stays inside the card',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'On a phone, the × now sits in the open bid\'s top corner. It no longer covers the bid\'s name or the step strip.',
    'On Pricing, a long bid name now wraps like it does on the other tabs, so Mark and For someone… stay on screen.',
    'Share with a teammate now fits a phone. Its two labels wrap inside the button.',
  ],
}

export default note

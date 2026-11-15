import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7346',
  date: '2026-11-15',
  title: 'Job, task and report photos: a photo whose first send was cut off now lands on the next try',
  kind: 'fix',
  highlights: [
    'A photo sent on a weak signal could reach the office while the phone never heard back. The phone then tried again and was turned away every time, so the photo waited until the next morning and never landed.',
    'The next try now finds the photo already there and finishes adding it. This covers job photos, task card photos and report photos, as bid photos already had it.',
  ],
}

export default note

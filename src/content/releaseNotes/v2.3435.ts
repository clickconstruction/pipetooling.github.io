import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3435',
  date: '2026-09-14',
  title: 'Sub sheets: job numbers are no longer cut at 10 characters',
  kind: 'fix',
  highlights: [
    'A sub sheet’s job number is saved exactly as typed or picked — it used to be cut at 10 characters. The sheet’s job is its link, so the number is only what you see on the sheet.',
  ],
}

export default note

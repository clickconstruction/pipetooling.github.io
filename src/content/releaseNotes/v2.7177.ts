import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7177',
  date: '2026-11-13',
  title: 'Materials on site: the boxes read again by themselves',
  kind: 'fix',
  highlights: [
    'A job’s boxes were read once when the page opened and never again. The desk left open showed the morning’s numbers all day.',
    'The desk, a site’s screen, a job’s page and the phone now read again when you come back to them, when the signal returns, and every few minutes while they stay open.',
    'On the phone, opening a box reads the job again first when the last read is more than a few seconds old. The number you press against is the one the office holds.',
    'Nothing flashes while it reads. What you pressed and is still waiting to send stays on the screen.',
  ],
}

export default note

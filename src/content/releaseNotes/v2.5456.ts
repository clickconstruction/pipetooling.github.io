import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5456',
  date: '2026-10-13',
  title: 'Messages: the rules for saving a job’s photos, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A photo saved to a job’s Drive folder is named by its day, who sent it and a caption, like 2026-10-02 Priya Raman · Ceiling tile op 3.jpg.',
    'A job saves its photos only once the office turns that on. It starts off on every job.',
    'A picture that comes on a text gets its own copy the moment it arrives, since the phone company’s link does not last.',
    'Nothing on screen changes yet.',
  ],
}

export default note

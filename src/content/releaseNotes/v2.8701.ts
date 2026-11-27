import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8701',
  date: '2026-11-27',
  title: 'Send a paper: turn on secrecy for the site you named',
  kind: 'feature',
  highlights: [
    'In Send a paper, a named site whose secrecy is off shows Secrecy on this site under the site’s line.',
    'Turn on secrecy for this site opens the same panel in the email window. It counts the jobs and the people before its last press, and it sends nothing.',
    'Only send this one sends the one paper and leaves secrecy off. The question goes away for that site.',
    'A site whose secrecy is already on says since when and names the paper. The block shows once the database behind it has been updated.',
  ],
}

export default note

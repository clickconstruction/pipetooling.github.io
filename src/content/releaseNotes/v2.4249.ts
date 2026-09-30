import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4249',
  date: '2026-09-30',
  title: 'Lien desk: “Someone’s calling” finds any job on the desk, and has a practice call',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The “☎ Someone’s calling” box on the Lien desk now searches every job on the desk by job number, street, owner or GC. Before, it only looked at letters already mailed, so most jobs could not be found.',
    'Results come in two groups. “Letter sent” opens the call sheet, as before. “No letter mailed yet” opens the job on the desk and says the caller is not holding a notice from us.',
    'A slip of the finger is forgiven: when nothing matches, the box shortens the word it cannot find until something matches and says which letters it used (“lenn” finds Lenox).',
    'Before you type, the box shows words to try, the letters that are out now, and a “Practice call” on a made-up letter. The practice sheet works like the real one and saves nothing.',
  ],
}

export default note

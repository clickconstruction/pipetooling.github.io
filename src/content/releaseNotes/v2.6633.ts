import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6633',
  date: '2026-11-07',
  title: 'The Legal desk’s Signed statements line says who can read them',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On the Evidence tab, a job’s Signed statements line told a master, an assistant or an estimator Nothing signed here yet, even when signed statements exist. Now it says only a dev or the controller can read them.',
    'A dev and the controller see the line as before: the counts, or Nothing signed here yet when the job truly has none.',
  ],
}

export default note

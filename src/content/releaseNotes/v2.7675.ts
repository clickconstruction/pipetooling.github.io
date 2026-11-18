import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7675',
  date: '2026-11-17',
  title: 'Papers before a job opens: a sub with no login signs on their own page before the address and scope show',
  kind: 'feature',
  highlights: [
    'A sub with no login now sees a card on their page for a job that requires papers. It names the job’s number and its papers, with Read and sign on the first one.',
    'Until every paper is signed, their page shows that job by its number alone. The address, the scope lines, the notes and the plans link stay back.',
    'Their money stays on the page: agreed, paid and open, and every payment.',
    'They cannot accept that job’s work order, pick its days or report on it before signing. After signing, Back to your page brings them back.',
  ],
}

export default note

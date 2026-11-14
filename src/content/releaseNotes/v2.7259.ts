import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7259',
  date: '2026-11-14',
  title: 'The law firm’s lien grid leaves off a job paid in kind, as the Lien desk does',
  kind: 'fix',
  highlights: [
    'A job on an open in kind arrangement is off the Lien desk. The lien grid on the law firm’s portal now leaves it off too, so the firm’s grid and the desk’s By job tab show the same jobs again.',
    'A matter with the firm is unchanged. Its jobs, bills, papers and lien timeline still show, whether or not a job is paid in kind.',
    'End the arrangement, or take the job off it, and the job is back on the firm’s grid the next time the portal opens.',
  ],
}

export default note

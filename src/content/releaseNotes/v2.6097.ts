import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6097',
  date: '2026-10-29',
  title: 'Signed hours statement: the window, the record and the Hours statements list (punch list #212, PR 2)',
  kind: 'feature',
  highlights: [
    'A job’s Documents tab and a person’s desk under Hours now carry Hours statements: every statement made with its record number and where it stands, and the press Hours statement…, which says how many people clocked on the job and opens the window.',
    'The window picks who clocked on the job, or the job when opened from the person, the span, and two switches: Show the rate, the amount and what was paid, and Add days the app did not record. The paper is the preview and draws again after every change.',
    'A line says what the app has in the span, and an amber line names a session still waiting for approval, which the paper says under its day instead of counting. Save a draft keeps the statement with its record number, HS-<job>-<n>; Print stamps it on the paper and files nothing.',
    'An assistant makes the hours-only paper, the pay switch fixed off. Send for signature… and Sign here now are on the window but wait for the signing, the next step.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note

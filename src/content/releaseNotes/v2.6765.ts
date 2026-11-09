import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6765',
  date: '2026-11-08',
  title: 'Typed confirms: the office deletes a supply house, the owner a report or a submitted write-up, the controller a pay report',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Any office role can delete a supply house now. The window asks for the house’s name first.',
    'The owner can delete a report on Jobs → Reports and a submitted write-up on People → Write-ups. Each asks for the word DELETE.',
    'The controller can delete a pay report on People → Payroll. The window asks for the period’s last day, like 11/8.',
    'A wrong word changes nothing. A deleted report or pay report still waits in Recently deleted for a dev to put back.',
  ],
}

export default note

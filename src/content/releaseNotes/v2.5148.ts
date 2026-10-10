import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5148',
  date: '2026-10-09',
  title: 'GC projects: the app can remind the office and the architect, once the owner turns it on',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Two days before bill day, the project manager gets an email that this month’s pay application is ready, with each trade still owing a waiver.',
    'When a pay application waits 3 days for its certificate, the architect gets a reminder from Click Construction. At 5 days, the project manager hears.',
    'The owner turns these on in Settings, under Jobs & billing, with Preview and Email me a test. Only pay applications sent from that day get them.',
    'A sent bill says when the app reminded the architect.',
  ],
}

export default note

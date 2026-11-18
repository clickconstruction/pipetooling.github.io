import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7806',
  date: '2026-11-18',
  title: 'Lien desk: Put a GC on notice moved off the header and onto the job',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a computer, Put a GC on notice… is no longer in the header of the Lien desk.',
    'Open a job under Monthly notices. Beside the GC’s name there is now a small amber press, Put on notice…. It opens the run for that job’s GC.',
    'In a wide window, Monthly notices is now one line at the top, so the list starts higher.',
    'The Pipeline’s tools menu and Customer review still open the run, as before. A phone still has Put a GC on notice… under More.',
  ],
}

export default note

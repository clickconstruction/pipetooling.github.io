import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5062',
  date: '2026-10-09',
  title: 'Help: “track a general contractor on a job” starts with what to do first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The guide now opens with three steps: set the GC in the job’s GC/Builder row, certify each GC’s bills in GC Review by Wednesday, then send the statement from the GC’s row.',
    'Setting a GC, who gets the bills and where the GC shows up come first. The detail of GC Review now sits under Reference, after a link to the weekly round guide.',
    'Two facts are brought up to date: GC Review groups the GCs by account man, and a GC’s statement needs that week’s check, whether you send it or it is scheduled.',
    'Nothing in the app changes, and no sentence was cut.',
  ],
}

export default note

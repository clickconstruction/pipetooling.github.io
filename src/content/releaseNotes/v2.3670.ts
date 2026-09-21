import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3670',
  date: '2026-09-21',
  title: 'Lien desk: click a gate to bring up its section, and every gate has one',
  kind: 'feature',
  highlights: [
    'The four gate boxes above the notice are now buttons: click one and its section scrolls into view and is ringed for a moment, so you can go straight to the owner, the GC, the property kind or the hours. The bottom bar’s “Go to gate 1” does the same.',
    'A gate that is already clear now has a section too, instead of vanishing: the owner’s name and mailing address as the envelope will read (with a link to the county appraisal site and Change), the original contractor and the address the certified copy goes to, and every work month with approved hours, the ticked ones marked “on this notice”.',
    'Property kind is set right on the desk: on a job with a linked property, gate 3’s section is the Residential | Commercial switch, saved on the property record as you pick — no trip through Edit Job. A job with no linked property keeps the “Set property kind” door.',
  ],
}

export default note

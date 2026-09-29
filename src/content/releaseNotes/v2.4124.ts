import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4124',
  date: '2026-09-29',
  title: 'Submittals: the page says it in plain words',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The Next line on the strip is short sentences that say what to do: “The package is built. Tap Share to get a link for the GC.” instead of “Share mints the bid’s review room link and copies it for the GC’s email chain.”',
    'The Build Rev 1 card, the three source cards, the stage lines and every button tooltip follow the same rules as the walkthrough.',
    'A trade word is explained once, where it first shows: Rev 1 is the first version, a tag is the plan’s name for a fixture like WC-1, a cut sheet is the maker’s page for a product.',
  ],
}

export default note

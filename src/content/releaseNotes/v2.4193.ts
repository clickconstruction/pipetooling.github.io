import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4193',
  date: '2026-09-29',
  title: 'Pipeline Billed rows: the bill’s dates block is drawn the way the money legend is',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'The numbered track and badges under Left on Job are gone. In their place the block reads like the legend above it: a bar, then rows with a dot, the words and how far from today on the right, then one bold line under a hairline.',
    'The bar is the money bar’s twin for time — from the day we billed to the last deadline, sized by days, grey where time is used, a blue outline on the stretch today falls in, green for the room between the money and the lien, a red hatch when the lien would die first, amber up to a notice.',
    'The bold line is the verdict: Room after they pay · 72 d, Send the notice · 16 d, File the lien first · 5 d short, Ask for a date · 12 d past, or Lien gone. It opens the Lien window, or They said… when it asks for a date.',
    'The clicks are unchanged — Expected opens They said…, every deadline row opens the Lien window — and they underline only on hover. The pay history under Expected is words alone, no sparkline.',
  ],
}

export default note

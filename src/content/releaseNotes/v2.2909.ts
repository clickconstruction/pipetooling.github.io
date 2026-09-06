import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2909',
  date: '2026-09-05',
  title: 'New Job says when it is thinking, Import explains instead of vanishing, and the bid price is offered rather than assumed',
  kind: 'fix',
  highlights: [
    'New Job: the C# box reads "finding…" while the next number loads (a number you type meanwhile is never overwritten), and the Import button no longer disappears once you have typed anything — it greys out and says why when you hover or tap it.',
    'Opening a job from a won bid now asks "Start the job at $X?" — Yes puts the bid figure on the job as its first line item (and records it on the bid as the agreed value when the bid has none); Start at $0 writes nothing anywhere.',
    'Delete-job confirm: team labor reads "≈ 22.8 hrs" instead of "22.773756 hrs", and every "Settings → Data & migration" pointer now says Data & recovery — the tab\'s real name.',
    'A person\'s day view (Schedule → Day, Quickfill, Person Desk): the "+" job picker gets the same "Create new job" button the week grid has; the new job lands straight in the add-block step.',
  ],
}

export default note

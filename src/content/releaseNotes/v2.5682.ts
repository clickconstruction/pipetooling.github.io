import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5682',
  date: '2026-10-20',
  title: 'Bids: taking the GC off hands the bid to the alternate',
  kind: 'feature',
  highlights: [
    'When the lead GC drops a project, press × on the ★ Bid’s GC card in Edit Bid. The alternate becomes the bid’s GC in one confirmed press — no retyping a name the bid already knows. With two or more alternates the confirm asks who steps up, and "Keep as an alternate instead" is one click away.',
    'Every alternate card gains "make bid’s GC", the same handoff from the other side, and the change ▸ list now puts the GCs already on this bid first.',
    'The handoff keeps the record straight: letters already sent, per-GC due dates and bid rooms stay with the GC they belong to instead of silently re-badging onto the new one, and the bid’s notes record who handed the bid to whom.',
  ],
}

export default note

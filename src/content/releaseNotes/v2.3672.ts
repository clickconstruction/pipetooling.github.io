import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3672',
  date: '2026-09-21',
  title: 'Materials by stage, PR 2: the boxes on the sheet and the Stages panel',
  kind: 'feature',
  highlights: [
    'Bids → Takeoffs: three small boxes under every fixture or tie-in — 1 Rough In, 2 Top Out, 3 Trim Set. Click one for the whole fixture, click two for an even split (½ · ½), click the split text to type your own shares (70 / 30), Shift-click to make a stage the only one. The keys 1, 2, 3 work on a focused row.',
    'Every part line follows its fixture (shown dashed) until you click its own boxes; ↺ hands it back. Inside an assembly bundle each part has boxes of its own, so the trap can be Rough In while the supply stops stay Trim. A bundle whose parts disagree splits its price by the parts’ catalog value.',
    'The rail gains a Stages panel: raw material per stage → × the factor, the total, the shares, and how many fixtures are staged. Fill from rules stages the whole sheet from the fixture names (waste pipe half and half, water and gas in the wall, drains below the slab, fixtures at trim) and says what it did; boxes you set by hand are kept.',
    'The factor field shows the company number (1.5) and lets a bid use its own. The printed schedule and the cover letter section arrive in the next release.',
  ],
}

export default note

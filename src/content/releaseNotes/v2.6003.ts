import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6003',
  date: '2026-10-27',
  title: 'Pricing: the strip names the version your prices land on',
  kind: 'fix',
  roles: ['estimator', 'assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'On Bids → Pricing, the strip with Revenue, Profit and Margin now starts with a chip naming the version you are pricing, like "INCLUDING WATER SOFTENER · alternate" or "Tommy Gillis · base". The strip stays on screen while you type, so the name is always in view. The "saved ✓" after a typed price names the version too: "saved ✓ on INCLUDING WATER SOFTENER".',
    'Each version keeps its own prices. A price typed on the alternate never moves the base, and the other way round. The cover letter prices the alternate as "Add $N" against the base, from each version\'s own rows.',
    'Why: on 2026-10-27 Wendi changed the hose bibs\' price on BP545 and it showed up on the alternate\'s line of the cover letter, not the base\'s. The card she had clicked moved her onto the alternate, and nothing on the Workbench said so while she typed.',
  ],
}

export default note

import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7984',
  date: '2026-11-19',
  title: 'Painted maps: the rule for saying Precise Location is on',
  kind: 'infra',
  highlights: [
    'A first step toward a line on the painted map that says Precise Location is on, which the owner asked for.',
    'The rule is written and tested. A phone that is sure within about 330 ft has the switch on. A phone that is only sure within a mile or more, 4 seconds running, looks to have it off.',
    'The steps to the switch are written for each kind of phone: Safari, Chrome and the other browsers on an iPhone, and Android.',
    'Nothing on a screen changes yet. The line on the walk comes next.',
  ],
}

export default note

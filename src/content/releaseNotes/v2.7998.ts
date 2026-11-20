import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7998',
  date: '2026-11-19',
  title: 'Papers: add someone a paper went to onto a list',
  kind: 'feature',
  highlights: [
    'A paper sent to someone you typed in reads Not on a list. Its line now carries Add to a list, signed or not.',
    'Say what they are: a new customer, a new supply house or vendor, or someone at a company you already have.',
    'Their paper comes with them. Nothing is copied, and the line then reads Customer or Supply house.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note

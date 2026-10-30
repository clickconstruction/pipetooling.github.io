import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6170',
  date: '2026-10-30',
  title: 'Legal desk: the settlement floor is retired — the firm settles for what can be had and records the amount',
  kind: 'feature',
  highlights: [
    'The Settlement authority block on Fees & steps and the floor field on Mark attorney ready are gone. The firm settles as it can, which is the owner’s call of October 30: a floor that blocks a settlement costs more in collections and at trial.',
    'On the firm’s portal a Settled step always asks for the settlement amount and moves the stage at once. The matter card reads Settling: Settle as you can. Record the settlement with its amount.',
    'The claim bar keeps every standing offer as a mark and loses the floor mark. A settlement ask the firm made under a floor before today can still be signed off, and Needs You names it as a settlement to sign off.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note

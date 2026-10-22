import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { NO_TESTER_WORDS, walkTesterLine } from './testerLine'

const tester = { id: 'u-tester', email: 'walk-tester@walk.pipetooling.local', read_only: true, last_sign_in_at: '2026-10-20T15:00:00.000Z' }
const KIT = JSON.stringify({ customerId: 'cu', contactId: 'c', email: 'bids@x.example', madeAt: '2026-10-22T14:00:00.000Z' })
const TZ = APP_CALENDAR_TZ

describe('walkTesterLine (punch list #142 PR 3)', () => {
  it('says there is no tester yet', () => {
    expect(walkTesterLine(null, null, TZ)).toEqual({ words: NO_TESTER_WORDS, present: false })
  })

  it('names the kit’s last walk while a kit stands, else the account’s last sign-in, else no walk yet', () => {
    expect(walkTesterLine(tester, KIT, TZ)).toEqual({ words: 'Walk tester · training mode · last walk Oct 22', present: true })
    expect(walkTesterLine(tester, null, TZ).words).toBe('Walk tester · training mode · last walk Oct 20')
    expect(walkTesterLine(tester, 'not json', TZ).words).toBe('Walk tester · training mode · last walk Oct 20')
    expect(walkTesterLine({ ...tester, last_sign_in_at: null }, null, TZ).words).toBe('Walk tester · training mode · no walk yet')
  })

  it('says when the account is somehow not in training mode', () => {
    expect(walkTesterLine({ ...tester, read_only: false }, null, TZ).words).toBe('Walk tester · not in training mode · last walk Oct 20')
  })
})

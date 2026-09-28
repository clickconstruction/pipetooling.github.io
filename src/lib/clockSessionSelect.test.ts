import { describe, expect, it } from 'vitest'
import { CLOCK_SESSION_DAY_EDITOR_SELECT } from './clockSessionSelect'
import { normalizeDayEditorSession } from './myTimeDayTimeline'

describe('CLOCK_SESSION_DAY_EDITOR_SELECT', () => {
  it('reads every field of a day editor session, and nothing else', () => {
    const session = normalizeDayEditorSession({
      id: 'a',
      clocked_in_at: '2026-01-05T14:00:00.000Z',
      clocked_out_at: null,
      work_date: '2026-01-05',
      notes: '',
      job_ledger_id: null,
      bid_id: null,
      approved_at: null,
    })
    const columns = CLOCK_SESSION_DAY_EDITOR_SELECT.split(',').map((c) => c.trim())
    expect([...columns].sort()).toEqual(Object.keys(session).sort())
  })
})

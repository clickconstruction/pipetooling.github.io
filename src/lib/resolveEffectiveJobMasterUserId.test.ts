import { describe, expect, it } from 'vitest'

import {
  chooseJobOwnerFromOverrideRows,
  JOB_OWNER_OVERRIDE_DEFAULT_KEY,
} from './resolveEffectiveJobMasterUserId'

const ME = 'user-roxi'
const MALACHI = 'user-malachi'

describe('chooseJobOwnerFromOverrideRows (v2.1532)', () => {
  it('falls back to the user themselves when no rows exist', () => {
    expect(chooseJobOwnerFromOverrideRows([], ME)).toBe(ME)
  })

  it('uses the org-wide default when the user has no personal row', () => {
    const rows = [{ key: JOB_OWNER_OVERRIDE_DEFAULT_KEY, value_text: MALACHI }]
    expect(chooseJobOwnerFromOverrideRows(rows, ME)).toBe(MALACHI)
  })

  it('a personal row beats the default', () => {
    const rows = [
      { key: JOB_OWNER_OVERRIDE_DEFAULT_KEY, value_text: MALACHI },
      { key: `job_owner_override_${ME}`, value_text: 'user-other-master' },
    ]
    expect(chooseJobOwnerFromOverrideRows(rows, ME)).toBe('user-other-master')
  })

  it('a personal row pointing at the user themselves exempts them from the default', () => {
    const rows = [
      { key: JOB_OWNER_OVERRIDE_DEFAULT_KEY, value_text: MALACHI },
      { key: `job_owner_override_${ME}`, value_text: ME },
    ]
    expect(chooseJobOwnerFromOverrideRows(rows, ME)).toBe(ME)
  })

  it('blank or null values are treated as unset', () => {
    const rows = [
      { key: JOB_OWNER_OVERRIDE_DEFAULT_KEY, value_text: '  ' },
      { key: `job_owner_override_${ME}`, value_text: null },
    ]
    expect(chooseJobOwnerFromOverrideRows(rows, ME)).toBe(ME)
  })

  it("another user's personal row is ignored", () => {
    const rows = [{ key: 'job_owner_override_someone-else', value_text: MALACHI }]
    expect(chooseJobOwnerFromOverrideRows(rows, ME)).toBe(ME)
  })
})

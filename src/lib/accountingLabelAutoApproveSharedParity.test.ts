import { describe, expect, it } from 'vitest'
import * as app from './accountingLabelAutoApprove'
// Deno edge copy (supabase/functions/_shared) — must behave identically.
import * as shared from '../../supabase/functions/_shared/accountingLabelAutoApprove'

// Guards against drift between the client kernel and the edge-function copy
// mercury-webhook evaluates before asking the SQL writer to approve a fresh
// rule match. If this fails, the two implementations diverged — reconcile them.

const STATUSES = ['pending', 'approved', 'rejected', null, undefined]
const LABEL_KEYS = ['internal_transfers', 'office', null, undefined, '']
const RULES = [{ enabled: true }, { enabled: false }, null, undefined]
const SETTINGS = [{ autoApproveRuleMatches: true }, { autoApproveRuleMatches: false }]
const BOOLS = [true, false]

describe('accountingLabelAutoApprove shared/app parity', () => {
  it('constants agree', () => {
    expect(shared.ACCOUNTING_LABEL_AUTO_APPROVE_SETTING_KEY).toBe(app.ACCOUNTING_LABEL_AUTO_APPROVE_SETTING_KEY)
    expect(shared.AUTO_APPROVE_INTERNAL_TRANSFERS_DEFAULT_KEY).toBe(app.AUTO_APPROVE_INTERNAL_TRANSFERS_DEFAULT_KEY)
  })

  it('parseAutoApproveSettingValue agrees on every fixture', () => {
    for (const v of ['true', 'TRUE', ' true ', 'false', '1', 'yes', '', null, undefined]) {
      expect(shared.parseAutoApproveSettingValue(v)).toBe(app.parseAutoApproveSettingValue(v))
    }
  })

  it('shouldAutoApproveSuggestion agrees on the full input lattice', () => {
    let cases = 0
    for (const status of STATUSES)
      for (const suggestedLabelDefaultKey of LABEL_KEYS)
        for (const txHasJobSplits of BOOLS)
          for (const txHasAssignment of BOOLS)
            for (const rule of RULES)
              for (const settings of SETTINGS) {
                const suggestion = { status, suggestedLabelDefaultKey, txHasJobSplits, txHasAssignment }
                expect(
                  shared.shouldAutoApproveSuggestion(suggestion, rule, settings),
                  `mismatch for ${JSON.stringify({ suggestion, rule, settings })}`,
                ).toEqual(app.shouldAutoApproveSuggestion(suggestion, rule, settings))
                cases++
              }
    expect(cases).toBe(STATUSES.length * LABEL_KEYS.length * 2 * 2 * RULES.length * SETTINGS.length)
  })
})

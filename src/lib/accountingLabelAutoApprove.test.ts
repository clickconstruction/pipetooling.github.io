import { describe, expect, it } from 'vitest'
import {
  ACCOUNTING_LABEL_AUTO_APPROVE_SETTING_KEY,
  parseAutoApproveSettingValue,
  shouldAutoApproveSuggestion,
  type AutoApproveSuggestionInput,
} from './accountingLabelAutoApprove'

const ON = { autoApproveRuleMatches: true }
const OFF = { autoApproveRuleMatches: false }
const RULE = { enabled: true }

function pending(over: Partial<AutoApproveSuggestionInput> = {}): AutoApproveSuggestionInput {
  return { status: 'pending', suggestedLabelDefaultKey: null, txHasJobSplits: false, txHasAssignment: false, ...over }
}

describe('shouldAutoApproveSuggestion (server auto-approve gate, Tier-2 #27)', () => {
  it('approves a plain pending rule match once the org switch is on', () => {
    expect(shouldAutoApproveSuggestion(pending(), RULE, ON)).toEqual({ approve: true, reason: 'rule_match' })
  })

  it('does nothing while the switch is off — the default until a dev flips it', () => {
    expect(shouldAutoApproveSuggestion(pending(), RULE, OFF)).toEqual({ approve: false, reason: 'switch_off' })
  })

  it('only pending rows are candidates', () => {
    expect(shouldAutoApproveSuggestion(pending({ status: 'approved' }), RULE, ON).reason).toBe('not_pending')
    expect(shouldAutoApproveSuggestion(pending({ status: 'rejected' }), RULE, ON).reason).toBe('not_pending')
    expect(shouldAutoApproveSuggestion(pending({ status: null }), RULE, ON).reason).toBe('not_pending')
  })

  it('a deleted or disabled rule does not approve on its own', () => {
    expect(shouldAutoApproveSuggestion(pending(), null, ON).reason).toBe('rule_missing_or_disabled')
    expect(shouldAutoApproveSuggestion(pending(), { enabled: false }, ON).reason).toBe('rule_missing_or_disabled')
  })

  it('a hand-set label always wins', () => {
    expect(shouldAutoApproveSuggestion(pending({ txHasAssignment: true }), RULE, ON).reason).toBe('already_labeled')
  })

  it('Internal Transfers on a split transaction stays pending for a human (the client four-place guard)', () => {
    expect(
      shouldAutoApproveSuggestion(
        pending({ suggestedLabelDefaultKey: 'internal_transfers', txHasJobSplits: true }),
        RULE,
        ON,
      ),
    ).toEqual({ approve: false, reason: 'internal_transfers_conflict' })
    // Splits alone, or Internal Transfers alone, are fine.
    expect(shouldAutoApproveSuggestion(pending({ txHasJobSplits: true }), RULE, ON).approve).toBe(true)
    expect(
      shouldAutoApproveSuggestion(pending({ suggestedLabelDefaultKey: 'internal_transfers' }), RULE, ON).approve,
    ).toBe(true)
  })

  it('checks run in the SQL order, so the reason names the first excluding clause', () => {
    const everythingWrong = pending({
      status: 'approved',
      suggestedLabelDefaultKey: 'internal_transfers',
      txHasJobSplits: true,
      txHasAssignment: true,
    })
    expect(shouldAutoApproveSuggestion(everythingWrong, null, OFF).reason).toBe('switch_off')
    expect(shouldAutoApproveSuggestion(everythingWrong, null, ON).reason).toBe('not_pending')
    expect(shouldAutoApproveSuggestion({ ...everythingWrong, status: 'pending' }, null, ON).reason).toBe(
      'rule_missing_or_disabled',
    )
    expect(shouldAutoApproveSuggestion({ ...everythingWrong, status: 'pending' }, RULE, ON).reason).toBe(
      'already_labeled',
    )
  })
})

describe('parseAutoApproveSettingValue', () => {
  it('only the literal true turns the switch on', () => {
    expect(parseAutoApproveSettingValue('true')).toBe(true)
    expect(parseAutoApproveSettingValue(' TRUE ')).toBe(true)
    expect(parseAutoApproveSettingValue('false')).toBe(false)
    expect(parseAutoApproveSettingValue('1')).toBe(false)
    expect(parseAutoApproveSettingValue('')).toBe(false)
    expect(parseAutoApproveSettingValue(null)).toBe(false)
    expect(parseAutoApproveSettingValue(undefined)).toBe(false)
  })

  it('the setting key is the one the SQL writer and the webhook read', () => {
    expect(ACCOUNTING_LABEL_AUTO_APPROVE_SETTING_KEY).toBe('accounting_label_auto_approve_rule_matches')
  })
})

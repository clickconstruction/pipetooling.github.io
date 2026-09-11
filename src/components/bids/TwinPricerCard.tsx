/**
 * The pricing robot's card (Price Matrix PR 5 — docs/PRICE_MATRIX_PLAN.md).
 * Two faces of one data load:
 *
 *  - `scoreboard`: the numbers — requests finished, rows priced vs asked, how
 *    often the estimator kept the robot's pick, quotes it found expired.
 *  - `console`: the receipts — the rulebook (what the robot learned and from
 *    where, human- or robot-authored, times used) with a Retire door, and how
 *    many of the estimator's corrections the robot has not digested yet.
 *
 * Twin tables predate the generated types — untyped client, fail-soft: a
 * checkout ahead of the migration renders nothing rather than a broken card.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { buildPricingScorecard, describeAgreement, type PricingCorrectionRow, type PricingRequestRow, type PricingRuleRow } from '../../lib/bids/pricingScorecard'
import { BTN, CARD, CARD_TITLE, CHIP, MUTED, STEP_REF, TWIN_VIOLET } from './twinConsoleStyles'

const db = supabase as unknown as SupabaseClient

export function TwinPricerCard({ variant }: { variant: 'scoreboard' | 'console' }) {
  const { showToast } = useToastContext()
  const [requests, setRequests] = useState<PricingRequestRow[] | null>(null)
  const [corrections, setCorrections] = useState<PricingCorrectionRow[]>([])
  const [rules, setRules] = useState<PricingRuleRow[]>([])
  const [available, setAvailable] = useState(true)
  const [busyRule, setBusyRule] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [r, c, k] = await Promise.all([
        db.from('bid_price_matrix_requests').select('id, status, finished_at, result').in('status', ['ready', 'done']).order('finished_at', { ascending: false }).limit(200),
        db.from('fixture_component_corrections').select('id, action, digested_at, created_at').order('created_at', { ascending: false }).limit(500),
        db.from('fixture_component_rules').select('id, rule, kind, source, active, times_used, created_at, mirror_note').order('created_at', { ascending: false }).limit(100),
      ])
      if (r.error || c.error || k.error) {
        setAvailable(false)
        return
      }
      setAvailable(true)
      setRequests((r.data ?? []) as PricingRequestRow[])
      setCorrections((c.data ?? []) as PricingCorrectionRow[])
      setRules((k.data ?? []) as PricingRuleRow[])
    } catch {
      setAvailable(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const card = useMemo(() => buildPricingScorecard(requests ?? [], corrections, rules), [requests, corrections, rules])

  async function retire(rule: PricingRuleRow) {
    setBusyRule(rule.id)
    try {
      const { error } = await db.from('fixture_component_rules').update({ active: false, updated_at: new Date().toISOString() }).eq('id', rule.id)
      if (error) throw error
      showToast('Rule retired — the robot stops reading it next session.', 'success')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not retire the rule.', 'error')
    } finally {
      setBusyRule(null)
    }
  }

  if (!available || requests === null) return null
  // Nothing to say until the pricer has run once or a rule exists.
  if (card.requestsFinished === 0 && rules.length === 0 && variant === 'console') return null

  if (variant === 'scoreboard') {
    if (card.requestsFinished === 0) return null
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '1rem' }} data-testid="pricer-scorecard">
        <h4 style={{ margin: '0 0 0.45rem', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
          Pricing robot
        </h4>
        <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <Stat label="matrices" value={String(card.requestsFinished)} />
          <Stat label="quotes read" value={String(card.housesRead)} />
          <Stat label="rows priced" value={`${card.rowsPricedByRobot} of ${card.rowsTotal}`} />
          <Stat label="asked instead of guessed" value={String(card.rowsAsked)} tone="amber" />
          <Stat label="agreement" value={card.agreementPct == null ? '—' : `${card.agreementPct}%`} tone={card.agreementPct != null && card.agreementPct >= 90 ? 'green' : undefined} />
          <Stat label="rules learned" value={String(card.rulesActive)} />
        </div>
        <div style={{ ...MUTED, marginTop: '0.35rem' }}>
          {describeAgreement(card)}
          {card.choicesMade ? ` · ${card.choicesMade} option${card.choicesMade === 1 ? '' : 's'} settled by the estimator` : ''}
          {card.expiredQuotesSeen ? ` · ${card.expiredQuotesSeen} quote${card.expiredQuotesSeen === 1 ? '' : 's'} already expired when read` : ''}
          {card.correctionsUndigested ? ` · ${card.correctionsUndigested} correction${card.correctionsUndigested === 1 ? '' : 's'} waiting for the robot to digest` : ''}
        </div>
      </div>
    )
  }

  const active = rules.filter((r) => r.active)
  return (
    <div style={CARD} data-testid="pricer-receipts">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h4 style={{ ...CARD_TITLE, margin: 0 }}>
          <span style={STEP_REF}>≈</span>Pricing robot · what it learned
        </h4>
        <span style={{ ...CHIP, background: 'var(--bg-violet-100)', color: TWIN_VIOLET }}>{active.length} rule{active.length === 1 ? '' : 's'}</span>
        {card.correctionsUndigested ? (
          <span style={{ ...CHIP, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }} title="Corrections the estimator made in the compare that the robot has not read yet — it digests them at the start of its next session (get_component_corrections)">
            {card.correctionsUndigested} correction{card.correctionsUndigested === 1 ? '' : 's'} undigested
          </span>
        ) : null}
        <span style={{ ...MUTED, marginLeft: 'auto' }}>{describeAgreement(card)}</span>
      </div>
      {active.length === 0 ? (
        <p style={{ ...MUTED, margin: '0.4rem 0 0' }}>No rules yet. The estimator's "remember this" and the robot's own generalizations land here with where they came from.</p>
      ) : (
        <div style={{ marginTop: '0.4rem' }}>
          {active.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.35rem 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)', fontSize: '0.8rem' }}>
              <span style={{ ...CHIP, borderRadius: 999, background: r.source === 'robot' ? 'var(--bg-violet-100)' : 'var(--bg-green-tint)', color: r.source === 'robot' ? TWIN_VIOLET : 'var(--text-green-800)', flex: 'none', marginTop: 2 }}>
                {r.source === 'robot' ? 'robot' : 'estimator'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div><b>Learned</b> · {r.rule}</div>
                <div style={MUTED}>
                  {r.kind.replace('_', ' ')} · used {r.times_used} time{r.times_used === 1 ? '' : 's'}
                  {r.mirror_note ? ` · from: ${r.mirror_note}` : ''}
                </div>
              </div>
              <button type="button" style={BTN} disabled={busyRule === r.id} onClick={() => void retire(r)} title="Retire this rule — the robot stops reading it; the corrections that made it stay on record">
                Retire
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'green' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: tone === 'amber' ? 'var(--text-amber-700)' : tone === 'green' ? 'var(--text-green-800)' : 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: '0.68rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

/**
 * Whose is it… (punch list #346, PR 2): the window behind the band on People → Subs, in place of Assign….
 *
 * Assign… wrote one name over every other name on the sheet with no word of what that did. This shows, before
 * anything is saved, what each choice adds to each person's Balance due and that the parts are the sheet's open
 * money, once. No choice links one sheet to two subs: a sheet names only
 * the one person it pays (Taunya, 2026-11-15), so a part each sub did goes on a sheet of its own.
 *
 * The save is the page's own (`assignGroup`): this window only picks.
 */
import { useState, type CSSProperties } from 'react'
import type { UnattributedGroup } from '../../lib/people/subsHqRows'
import { assignedNamesLabel } from '../../lib/people/subsHqRows'
import { whoseSheetPlan, type WhoseSheetChoice } from '../../lib/subWorkOrders/sheetCrewWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { MoneyText } from '../Money'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type WhoseSheetWindowProps = {
  group: UnattributedGroup
  roster: ReadonlyArray<{ id: string; name: string; benched: boolean }>
  /** A safe guess for a name the roster did not know; picked to start with. */
  suggestion?: { id: string; name: string } | null
  saving: boolean
  onAssign: (person: { id: string; name: string }) => void
  onClose: () => void
}

const card = (on: boolean, dead = false): CSSProperties => ({ display: 'block', width: '100%', textAlign: 'left', font: 'inherit', padding: '0.55rem 0.7rem', borderRadius: 8, marginTop: 8, border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-700)', cursor: dead ? 'default' : 'pointer', opacity: dead ? 0.7 : 1, boxSizing: 'border-box' })

export function WhoseSheetWindow({ group, roster, suggestion, saving, onAssign, onClose }: WhoseSheetWindowProps) {
  const names = group.rawAssignedTo.split('|').map((n) => n.trim()).filter(Boolean)
  const shared = group.reason === 'shared'
  // On a shared sheet the choice is among the subs written on it; a name the roster did not know picks from the roster.
  const onSheet = roster.filter((r) => names.some((n) => n.toLowerCase() === r.name.trim().toLowerCase()))
  const options = shared && onSheet.length > 0 ? onSheet : roster
  const [kind, setKind] = useState<WhoseSheetChoice['kind']>('one')
  const [personId, setPersonId] = useState<string>(suggestion?.id ?? '')
  const person = options.find((r) => r.id === personId) ?? roster.find((r) => r.id === personId) ?? null
  const choice: WhoseSheetChoice | null = kind === 'one' ? (person ? { kind: 'one', personId: person.id, name: person.name } : null) : { kind }
  const plan = choice ? whoseSheetPlan(names, group.totalBalance, group.sheetCount, choice) : null
  const canSave = !!plan?.confirmLabel && !!person && !saving

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}>
      <div role="dialog" aria-modal="true" aria-label="Whose sheet is this?" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 10, padding: '1.1rem 1.2rem', width: 'min(520px, 100%)', maxHeight: 'min(90vh, 100%)', overflowY: 'auto', boxSizing: 'border-box' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>Whose sheet is this?</h3>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {group.jobNumber ? `#${group.jobNumber} · ` : ''}
          {group.label}
          {group.sheetCount > 1 ? ` · ${group.sheetCount} sheets` : ''} · <MoneyText text={money(group.totalBalance)} /> open · written for {group.rawAssignedTo ? assignedNamesLabel(group.rawAssignedTo) : 'nobody'}
        </div>

        <button type="button" aria-pressed={kind === 'one'} onClick={() => setKind('one')} style={card(kind === 'one')}>
          <b>{shared ? "It is one sub's sheet" : 'It is the sheet of a sub on the roster'}</b>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{shared ? 'The other name comes off. Nothing is added to the other sub.' : 'The name on the sheet is replaced by the roster name.'}</div>
          {kind === 'one' ? (
            <select
              aria-label="Which sub"
              value={personId}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setPersonId(e.target.value)}
              style={{ marginTop: 6, padding: '0.3rem 0.4rem', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: '0.8125rem', fontFamily: 'inherit', maxWidth: '100%' }}
            >
              <option value="" disabled>
                Pick the sub…
              </option>
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.benched ? ' (on the bench)' : ''}
                </option>
              ))}
            </select>
          ) : null}
        </button>

        <button type="button" aria-pressed={kind === 'leave'} onClick={() => setKind('leave')} style={card(kind === 'leave')}>
          <b>{shared ? 'Leave it shared' : 'Leave it as it is'}</b>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>It stays on nobody's row and keeps its line in the band.</div>
        </button>

        <div data-testid="whose-sheet-plan" style={{ marginTop: 12, padding: '0.55rem 0.7rem', borderRadius: 8, background: 'var(--bg-page)', fontSize: '0.8125rem' }}>
          <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)' }}>Before anything is saved</div>
          {plan ? (
            <>
              <div style={{ marginTop: 2 }}>{plan.words}</div>
              {plan.adds.length > 0 ? (
                <div style={{ marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {plan.adds.map((a) => `${a.name} +${money(a.amount)}`).join(' · ')} ·{' '}
                  <b style={{ color: plan.sumsToOpen ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{plan.sumsToOpen ? <MoneyText text={`= ${money(group.totalBalance)} ✓ the open money, once`} /> : 'does not add up to the open money'}</b>
                </div>
              ) : null}
            </>
          ) : (
            <div style={{ marginTop: 2, color: 'var(--text-muted)' }}>Pick the sub to see what their Balance due gains.</div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} style={{ font: 'inherit', fontSize: '0.875rem', padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
            {plan?.confirmLabel ? 'Cancel' : 'Close'}
          </button>
          {kind === 'one' ? (
            <button
              type="button"
              disabled={!canSave}
              onClick={() => person && onAssign({ id: person.id, name: person.name })}
              style={{ font: 'inherit', fontSize: '0.875rem', fontWeight: 650, padding: '0.4rem 0.9rem', borderRadius: 6, border: 'none', background: canSave ? '#2563eb' : DEAD_PRESS_FILL, color: canSave ? 'white' : DEAD_PRESS_TEXT, cursor: canSave ? 'pointer' : 'default' }}
            >
              {saving ? 'Saving…' : (plan?.confirmLabel ?? 'Pick the sub first')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default WhoseSheetWindow

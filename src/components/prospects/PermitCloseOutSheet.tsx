import { useState, type CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { PERMIT_LEAD_ROLE_WORDS, type PermitLeadRole, type PursueFor, type ResearchPermitRow } from '../../lib/research/permitResearch'
import { NOT_PURSUING_REASONS, PURSUE_FOR_WORDS, builderNameOfPermit, type NotPursuingCode } from '../../lib/research/permitBuilders'
import { skimTitle } from '../../lib/research/permitSkim'
import type { Researcher } from './PermitSkimDeck'

/**
 * Permits, the close-out of a kept permit (punch list #302, PR 7). Pursue asks two taps: what
 * for (this job, their next jobs, or both, since the plumber is sometimes chosen already) and who
 * follows up. Not pursuing asks one of five reasons. Nothing is typed.
 */
export type PermitCloseOut = { kind: 'pursue'; pursueFor: PursueFor; forUserId: string | null; role: PermitLeadRole } | { kind: 'not_pursuing'; code: NotPursuingCode }

const chip = (on: boolean): CSSProperties => ({ padding: '7px 12px', borderRadius: 999, fontSize: '0.8125rem', border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text)', fontWeight: on ? 600 : 400, minHeight: 36, cursor: 'pointer', font: 'inherit' })
const label: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '14px 0 6px' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }

export function PermitCloseOutSheet({
  mode,
  row,
  me,
  researchers,
  saving,
  error,
  onDone,
  onCancel,
}: {
  mode: 'pursue' | 'not_pursuing'
  row: ResearchPermitRow
  me: string
  researchers: readonly Researcher[]
  saving: boolean
  error: string | null
  onDone: (out: PermitCloseOut) => void
  onCancel: () => void
}) {
  const [pursueFor, setPursueFor] = useState<PursueFor>('this_job')
  const [forUserId, setForUserId] = useState<string | null>(row.verdict_for_user ?? me)
  const [role, setRole] = useState<PermitLeadRole>(row.builder_kind === 'owner' || row.builder_kind === 'developer' ? 'owner' : row.builder_kind === 'architect' ? 'architect' : 'gc')
  const [code, setCode] = useState<NotPursuingCode | null>(null)
  const who = builderNameOfPermit(row) ?? 'who pulled it'
  const follower = researchers.find((r) => r.id === forUserId)
  const dead = saving || (mode === 'not_pursuing' && code == null)
  const reasonWords = NOT_PURSUING_REASONS.find((r) => r.code === code)?.words.toLowerCase()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 760, paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={() => !saving && onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="permit-close-out-title"
        style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 12, padding: '1.25rem 1.5rem', maxWidth: 480, width: '92%', maxHeight: 'min(92vh, 100%)', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="permit-close-out-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
          {mode === 'pursue' ? `Pursue ${who}` : 'Not pursuing this one'}
        </h2>
        <div style={muted}>
          {skimTitle(row)} · {row.address ?? row.permit_number}
        </div>

        {mode === 'pursue' ? (
          <>
            <div style={label}>What for</div>
            <div role="group" aria-label="What for" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.keys(PURSUE_FOR_WORDS) as PursueFor[]).map((p) => (
                <button key={p} type="button" aria-pressed={pursueFor === p} onClick={() => setPursueFor(p)} style={chip(pursueFor === p)}>
                  {PURSUE_FOR_WORDS[p]}
                </button>
              ))}
            </div>
            {researchers.length > 0 && (
              <>
                <div style={label}>Who follows up</div>
                <div role="group" aria-label="Who follows up" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {researchers.slice(0, 10).map((r) => (
                    <button key={r.id} type="button" aria-pressed={forUserId === r.id} onClick={() => setForUserId(r.id)} style={chip(forUserId === r.id)}>
                      {r.id === me ? 'Me' : r.name}
                    </button>
                  ))}
                  <button type="button" aria-pressed={forUserId == null} onClick={() => setForUserId(null)} style={chip(forUserId == null)}>
                    Anyone
                  </button>
                </div>
              </>
            )}
            <div style={label}>They are</div>
            <select aria-label="They are" value={role} onChange={(e) => setRole(e.target.value as PermitLeadRole)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', font: 'inherit', background: 'var(--surface)', color: 'var(--text)', minHeight: 40 }}>
              {(Object.keys(PERMIT_LEAD_ROLE_WORDS) as PermitLeadRole[]).map((r) => (
                <option key={r} value={r}>
                  {PERMIT_LEAD_ROLE_WORDS[r]}
                </option>
              ))}
            </select>
            <p style={{ ...muted, margin: '12px 0' }}>A lead goes on the GCs deck with the permit as a job on it. A lead of the same name is reused.</p>
          </>
        ) : (
          <>
            <div style={label}>Why</div>
            <div role="group" aria-label="Why" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {NOT_PURSUING_REASONS.map((r) => (
                <button key={r.code} type="button" aria-pressed={code === r.code} onClick={() => setCode(r.code)} style={chip(code === r.code)}>
                  {r.words}
                </button>
              ))}
            </div>
            <p style={{ ...muted, margin: '12px 0' }}>It goes to Closed with the reason, your name and today. It can be put back.</p>
          </>
        )}

        {error && <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            aria-disabled={dead}
            onClick={() => {
              if (dead) return
              if (mode === 'pursue') onDone({ kind: 'pursue', pursueFor, forUserId, role })
              else if (code) onDone({ kind: 'not_pursuing', code })
            }}
            style={{ background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#ffffff', border: 0, borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: dead ? 'default' : 'pointer' }}
          >
            {saving ? 'Keeping…' : mode === 'pursue' ? (follower ? `Pursue · hand to ${follower.id === me ? 'me' : follower.name}` : 'Pursue · make the lead') : reasonWords ? `Not pursuing · ${reasonWords}` : 'Pick a reason'}
          </button>
          <button type="button" onClick={onCancel} disabled={saving} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: '0.875rem', minHeight: 44, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

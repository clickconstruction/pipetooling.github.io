import { useState } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  PERMIT_LEAD_ROLE_WORDS,
  PERMIT_VERDICTS,
  VERDICT_WORDS,
  defaultLookAgainYmd,
  plumberWords,
  plumbingOnFile,
  shortDay,
  verdictHold,
  workWords,
  type LeadFacts,
  type PermitLeadRole,
  type PermitVerdict,
  type ResearchPermitRow,
} from '../../lib/research/permitResearch'

/**
 * Research (punch list #292): the one sheet behind a row's Decide press. Four verdicts, a reason
 * that cannot be empty, a look-again day on Look into it, and on Approach them the part the
 * company on the permit plays, since the lead it makes carries it. The press names the verdict.
 */
export type PermitDecision = { verdict: PermitVerdict; reason: string; lookAgainOn: string | null; role: PermitLeadRole }

export function PermitDecideSheet({
  row,
  todayYmd,
  saving,
  error,
  onDecide,
  onCancel,
  initialVerdict,
  facts = {},
}: {
  row: ResearchPermitRow
  todayYmd: string
  saving: boolean
  error: string | null
  onDecide: (decision: PermitDecision) => void
  onCancel: () => void
  /** The verdict to open on, when a door chose one (Who pulled it's Approach them). */
  initialVerdict?: PermitVerdict
  /** What the Who pulled it card found; the lead carries it. */
  facts?: LeadFacts
}) {
  const [verdict, setVerdict] = useState<PermitVerdict>(initialVerdict ?? row.verdict ?? (plumbingOnFile(row) ? 'taken' : 'approach'))
  const carried = [facts.phone ? 'the phone' : null, facts.website ? 'the website' : null, facts.companyAddress ? 'the office address' : null, facts.ownerOfRecord ? 'the owner of record' : null].filter(Boolean)
  const [reason, setReason] = useState(row.verdict ? row.verdict_reason ?? '' : '')
  const [lookAgainOn, setLookAgainOn] = useState(row.verdict_look_again_on ?? defaultLookAgainYmd(todayYmd))
  const [role, setRole] = useState<PermitLeadRole>('gc')
  const [tried, setTried] = useState(false)
  const hold = verdictHold(reason)
  const dead = saving || hold != null
  const work = workWords(row)
  const pressWords = verdict === 'approach' ? 'Approach them · make the lead' : VERDICT_WORDS[verdict].press

  const submit = () => {
    setTried(true)
    if (dead) return
    onDecide({ verdict, reason, lookAgainOn: verdict === 'look' ? lookAgainOn : null, role })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 750, paddingTop: 'var(--app-top-chrome, 0px)' }}
      onClick={() => !saving && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="permit-decide-title"
        style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 12, padding: '1.25rem 1.5rem', maxWidth: 560, width: '92%', maxHeight: 'min(92vh, 100%)', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <h2 id="permit-decide-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              {row.address ?? row.permit_number} · {work.main}
            </h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              {row.permit_number} · {row.stage} {shortDay(row.filed_on)} · {work.detail}
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              Pulled by <strong>{row.contact ?? 'nobody named'}</strong>
              {plumbingOnFile(row) ? <span style={{ color: 'var(--text-muted)' }}> · {row.plumber ? `plumbing permit by ${row.plumber}` : `a plumbing permit on file, ${plumberWords(row).under}`}</span> : <span style={{ color: 'var(--text-green-700)' }}> · no plumber yet</span>}
            </div>
          </div>
          <span style={{ flex: '1 1 auto' }} />
          <button type="button" aria-label="Close" onClick={onCancel} disabled={saving} style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', width: 36, height: 36, borderRadius: 8, fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {PERMIT_VERDICTS.map((v) => {
            const on = v === verdict
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => setVerdict(v)}
                style={{ textAlign: 'left', border: on ? '1px solid #2563eb' : '1px solid var(--border)', boxShadow: on ? 'inset 0 0 0 1px #2563eb' : undefined, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text)', borderRadius: 8, padding: '10px 12px', minHeight: 44, cursor: 'pointer', font: 'inherit' }}
              >
                <strong>{VERDICT_WORDS[v].press}</strong>
                <br />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{VERDICT_WORDS[v].hint}</span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="permit-decide-why" style={{ fontWeight: 600 }}>
            Why
          </label>
          <textarea
            id="permit-decide-why"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="One line the next estimator can read."
            style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', font: 'inherit', fontSize: '0.9375rem', resize: 'vertical', background: 'var(--surface)', color: 'var(--text)' }}
          />
          <div style={{ color: tried && hold ? 'var(--text-red-700, var(--text-red-700))' : 'var(--text-muted)', fontSize: '0.8125rem' }}>
            {tried && hold ? hold : 'A verdict with no reason is refused. Your name and today go on the row.'}
          </div>
        </div>

        {verdict === 'look' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label htmlFor="permit-decide-again" style={{ fontWeight: 600 }}>
              Look again on
            </label>
            <input
              id="permit-decide-again"
              type="date"
              value={lookAgainOn}
              min={todayYmd}
              onChange={(e) => setLookAgainOn(e.target.value)}
              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', font: 'inherit', background: 'var(--surface)', color: 'var(--text)', minHeight: 40 }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>The row comes back to the top that day.</span>
          </div>
        )}

        {verdict === 'approach' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 600 }}>The lead</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ background: 'var(--bg-200)', color: 'var(--text)', borderRadius: 999, padding: '3px 10px', fontSize: '0.8125rem', fontWeight: 600 }}>
                {facts.companyName ?? row.contact ?? 'Who pulled the permit'} · GC lead · source: A permit
              </span>
              <label htmlFor="permit-decide-role" style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                They are
              </label>
              <select id="permit-decide-role" value={role} onChange={(e) => setRole(e.target.value as PermitLeadRole)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', font: 'inherit', background: 'var(--surface)', color: 'var(--text)', minHeight: 36 }}>
                {(Object.keys(PERMIT_LEAD_ROLE_WORDS) as PermitLeadRole[]).map((r) => (
                  <option key={r} value={r}>
                    {PERMIT_LEAD_ROLE_WORDS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Opens on the GCs deck with the permit as a job on it. A lead of the same name is reused.
              {carried.length > 0 ? ` The lead carries ${carried.join(', ')} from Who pulled it.` : ''}
            </div>
          </div>
        )}

        {error && <div style={{ color: 'var(--text-red-700, var(--text-red-700))', fontSize: '0.875rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={submit}
            aria-disabled={dead}
            style={{ background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#ffffff', border: 0, borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: dead ? 'default' : 'pointer' }}
          >
            {saving ? 'Keeping…' : pressWords}
          </button>
          <button type="button" onClick={onCancel} disabled={saving} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: '0.875rem', minHeight: 44, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

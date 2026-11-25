import { useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import { fixSpelling, type SpellingFixFailure } from '../../hooks/useAddressLookAlikes'
import { onFileCountWords } from '../../lib/addresses/addressesOnFile'
import { FIX_SPELLING_WORDS, fixButtonWords, fixOutcomeWords, numberCaution, spellingFixPlan, type KeepSide } from '../../lib/addresses/fixSpelling'
import type { LookAlikePair } from '../../lib/addresses/lookAlikes'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }
const press: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
const quiet: CSSProperties = { ...press, background: 'var(--surface)', color: 'var(--text-link)', border: '1px solid var(--border-strong)', fontWeight: 600 }
const rowLabel: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '0.6rem', minHeight: 44, padding: '0.45rem 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }

/**
 * Fix the spelling (punch list #439, piece 2): the small window a pair's **Fix the spelling…** opens. It asks which
 * of the two spellings to keep, names every job and bid written the other way, each ticked, and changes the picked
 * ones at **Change N addresses**. A row that does not take stays here with its reason while the rest go through.
 *
 * It opens over *Addresses that look alike* and writes nothing until its button is pressed.
 */
export default function AddressSpellingFixWindow({ pair, onClose, onChanged }: { pair: LookAlikePair; onClose: () => void; /** Called after any address changed, so the list reads again. */ onChanged: () => void }) {
  const { showToast } = useToastContext()
  const [keep, setKeep] = useState<KeepSide>('a')
  const [left, setLeft] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<SpellingFixFailure[]>([])
  const [changed, setChanged] = useState<Set<string>>(new Set())

  const plan = useMemo(() => spellingFixPlan(pair, keep), [pair, keep])
  const rows = useMemo(() => plan.rows.filter((r) => !changed.has(`${r.kind}:${r.id}`)), [plan, changed])
  const picked = rows.filter((r) => !left.has(`${r.kind}:${r.id}`))
  const caution = numberCaution(plan)
  const reasons = useMemo(() => new Map(failed.map((f) => [`${f.row.kind}:${f.row.id}`, f.reason])), [failed])
  const outcome = failed.length > 0 ? fixOutcomeWords(0, failed.length) : null

  function pickSide(side: KeepSide) {
    if (busy || side === keep) return
    setKeep(side)
    setLeft(new Set())
    setFailed([])
  }

  async function run() {
    if (busy || picked.length === 0) return
    setBusy(true)
    const result = await fixSpelling(picked, plan.to)
    setBusy(false)
    const words = fixOutcomeWords(result.done, result.failed.length)
    showToast(words.line, words.tone === 'success' ? 'success' : 'error')
    if (result.done > 0) onChanged()
    if (result.failed.length === 0) {
      onClose()
      return
    }
    const failedIds = new Set(result.failed.map((f) => `${f.row.kind}:${f.row.id}`))
    setChanged((was) => new Set([...was, ...picked.map((r) => `${r.kind}:${r.id}`).filter((id) => !failedIds.has(id))]))
    setFailed(result.failed)
  }

  const dead = busy || picked.length === 0
  const footer = (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.5rem' }}>
      <button type="button" onClick={onClose} disabled={busy} style={quiet}>
        {FIX_SPELLING_WORDS.cancel}
      </button>
      <button
        type="button"
        data-testid="address-fix-run"
        onClick={() => void run()}
        disabled={dead}
        style={dead ? { ...press, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid var(--border)', cursor: 'default' } : { ...press, background: '#2563eb', color: '#fff', border: '1px solid #2563eb' }}
      >
        {fixButtonWords(picked.length)}
      </button>
    </div>
  )

  return (
    <ResponsiveModalShell title={FIX_SPELLING_WORDS.title} onRequestClose={busy ? () => undefined : onClose} maxWidthDesktop={560} zIndex={1200} footer={footer}>
      <div data-testid="address-fix-window" style={{ display: 'grid', gap: '0.75rem', padding: '0.25rem 0 0.75rem', fontSize: '0.875rem' }}>
        <p style={{ margin: 0, ...muted }}>{FIX_SPELLING_WORDS.lead}</p>
        <fieldset style={{ margin: 0, padding: 0, border: 'none', minWidth: 0 }}>
          <legend style={{ padding: 0, marginBottom: 4, fontWeight: 600, fontSize: '0.8125rem' }}>{FIX_SPELLING_WORDS.keep}</legend>
          {(['a', 'b'] as const).map((side) => {
            const entry = side === 'a' ? pair.a : pair.b
            return (
              <label key={side} style={rowLabel}>
                <input type="radio" name="address-fix-keep" checked={keep === side} disabled={busy} onChange={() => pickSide(side)} style={{ marginTop: 3 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600, overflowWrap: 'anywhere' }}>{entry.address}</span>
                  <span style={muted}>{onFileCountWords(entry)}</span>
                </span>
              </label>
            )
          })}
        </fieldset>
        {caution ? (
          <p data-testid="address-fix-caution" style={{ margin: 0, padding: '0.5rem 0.65rem', borderRadius: 8, background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
            {caution}
          </p>
        ) : null}
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: 2 }}>{FIX_SPELLING_WORDS.changes}</div>
          {outcome?.head ? (
            <p data-testid="address-fix-failed-head" style={{ margin: '0 0 2px', color: 'var(--text-red-700)', fontSize: '0.8125rem', fontWeight: 600 }}>
              {outcome.head}
            </p>
          ) : null}
          {rows.length === 0 ? (
            <p style={{ margin: 0, ...muted }}>{FIX_SPELLING_WORDS.nothing}</p>
          ) : (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {rows.map((r) => {
                const id = `${r.kind}:${r.id}`
                const reason = reasons.get(id)
                return (
                  <label key={id} data-testid="address-fix-row" style={rowLabel}>
                    <input
                      type="checkbox"
                      checked={!left.has(id)}
                      disabled={busy}
                      onChange={() =>
                        setLeft((was) => {
                          const next = new Set(was)
                          if (next.has(id)) next.delete(id)
                          else next.add(id)
                          return next
                        })
                      }
                      style={{ marginTop: 3 }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{r.label}</span>
                      <span style={{ ...muted, overflowWrap: 'anywhere' }}>{r.from}</span>
                      {reason ? <span style={{ display: 'block', color: 'var(--text-red-700)', fontSize: '0.8125rem' }}>{reason}</span> : null}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
        <p style={{ margin: 0, ...muted }}>{FIX_SPELLING_WORDS.foot}</p>
      </div>
    </ResponsiveModalShell>
  )
}

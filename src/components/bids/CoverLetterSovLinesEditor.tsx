import { Fragment, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { lineSplit, parsePastedLineNames, reconcileLines, scaleLinesToContract, sovLinesTotals, type SovLine, type SovLineSeed } from '../../lib/bidDocuments/sovLines'

type Props = {
  bidId: string
  lines: SovLine[]
  /** The letter's amount the lines are checked against. */
  contractAmount: number
  splitOn: boolean
  ruleLaborPct: number
  /** The three stage lines as they stand now — what "Seed again" writes; null while the takeoff is still loading. */
  seeds: SovLineSeed[] | null
  /** Re-read the rows after a write. */
  onChanged: () => Promise<void> | void
}

type Draft = Partial<Record<'label' | 'value' | 'labor' | 'note', string>>

const cellStyle = { padding: '0.15rem 0.2rem' } as const
const inputStyle = { padding: '0.2rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', boxSizing: 'border-box' as const }
const numInputStyle = { ...inputStyle, width: '6.2rem', textAlign: 'right' as const }
const linkStyle = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-blue-700)', textDecoration: 'underline', textUnderlineOffset: 2 } as const
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: '0.8rem' } as const

/**
 * The My lines shape of the schedule of values (v2.4070): the estimator's own lines
 * — label, value, labor when the letter splits, a note — with the reconcile bar
 * against the contract, scale-to-contract, paste the GC's line names, seed again.
 * Writes go straight to `bid_sov_lines`; the parent re-reads through `onChanged`.
 */
export function CoverLetterSovLinesEditor({ bidId, lines, contractAmount, splitOn, ruleLaborPct, seeds, onChanged }: Props) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [busy, setBusy] = useState(false)

  const sorted = [...lines].sort((a, b) => a.sortOrder - b.sortOrder)
  const totals = sovLinesTotals(sorted, ruleLaborPct)
  const rec = reconcileLines(sorted, contractAmount)

  async function run(label: string, work: () => Promise<void>) {
    setBusy(true)
    try {
      await work()
      await onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, label), 'error')
    } finally {
      setBusy(false)
    }
  }

  function draftOf(id: string, field: keyof Draft, stored: string): string {
    const d = drafts[id]?.[field]
    return d == null ? stored : d
  }
  function setDraft(id: string, field: keyof Draft, v: string) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: v } }))
  }
  function clearDraft(id: string, field: keyof Draft) {
    setDrafts((prev) => {
      const d = { ...prev[id] }
      delete d[field]
      return { ...prev, [id]: d }
    })
  }

  async function commit(line: SovLine, field: keyof Draft) {
    const raw = drafts[line.id]?.[field]
    clearDraft(line.id, field)
    if (raw == null) return
    const patch: Partial<{ label: string; value: number; labor: number | null; note: string }> = {}
    if (field === 'label') {
      const label = raw.trim().slice(0, 200)
      if (label === line.label) return
      patch.label = label
    } else if (field === 'note') {
      const note = raw.trim().slice(0, 500)
      if (note === line.note) return
      patch.note = note
    } else {
      const s = raw.replace(/[$,]/g, '').trim()
      if (field === 'labor' && s === '') {
        if (line.labor == null) return
        patch.labor = null
      } else {
        const n = Number(s)
        if (!Number.isFinite(n) || n < 0) return
        const rounded = Math.round(n * 100) / 100
        if (field === 'value') {
          if (rounded === line.value) return
          patch.value = rounded
          if (line.labor != null && line.labor > rounded) patch.labor = rounded
        } else {
          const clamped = Math.min(line.value, rounded)
          if (clamped === line.labor) return
          patch.labor = clamped
        }
      }
    }
    await run('Could not save the line', async () => {
      const { error } = await supabase.from('bid_sov_lines').update(patch).eq('id', line.id)
      if (error) throw error
    })
  }

  async function addLine() {
    const maxSort = sorted.reduce((m, l) => Math.max(m, l.sortOrder), -1)
    await run('Could not add a line', async () => {
      const { error } = await supabase.from('bid_sov_lines').insert({ bid_id: bidId, sort_order: maxSort + 1, label: '', value: 0 })
      if (error) throw error
    })
  }

  async function removeLine(line: SovLine) {
    await run('Could not remove the line', async () => {
      const { error } = await supabase.from('bid_sov_lines').delete().eq('id', line.id)
      if (error) throw error
    })
  }

  async function move(line: SovLine, dir: -1 | 1) {
    const idx = sorted.findIndex((l) => l.id === line.id)
    const other = sorted[idx + dir]
    if (!other) return
    await run('Could not move the line', async () => {
      const a = await supabase.from('bid_sov_lines').update({ sort_order: other.sortOrder }).eq('id', line.id)
      if (a.error) throw a.error
      const b = await supabase.from('bid_sov_lines').update({ sort_order: line.sortOrder }).eq('id', other.id)
      if (b.error) throw b.error
    })
  }

  async function seedAgain() {
    if (!seeds) return
    const ok = sorted.length === 0 || (await confirmDialog({
      title: 'Seed again from the stages?',
      message: `Your ${sorted.length} ${sorted.length === 1 ? 'line' : 'lines'} will be replaced by the three stages as they stand now (${seeds.map((s) => `${s.label} $${formatCurrency(s.value)}`).join(' · ')}).`,
      confirmLabel: 'Replace the lines',
    }))
    if (!ok) return
    await run('Could not seed the lines', async () => {
      const del = await supabase.from('bid_sov_lines').delete().eq('bid_id', bidId)
      if (del.error) throw del.error
      const ins = await supabase.from('bid_sov_lines').insert(seeds.map((s) => ({ bid_id: bidId, sort_order: s.sortOrder, label: s.label, value: s.value, labor: s.labor, note: s.note, stage: s.stage })))
      if (ins.error) throw ins.error
    })
  }

  async function pasteNames() {
    const names = parsePastedLineNames(pasteText)
    if (names.length === 0) {
      showToast('Paste one line name per row.', 'info')
      return
    }
    const maxSort = sorted.reduce((m, l) => Math.max(m, l.sortOrder), -1)
    await run('Could not add the lines', async () => {
      const { error } = await supabase.from('bid_sov_lines').insert(names.map((label, i) => ({ bid_id: bidId, sort_order: maxSort + 1 + i, label, value: 0 })))
      if (error) throw error
    })
    setPasteText('')
    setPasteOpen(false)
  }

  async function scaleToContract() {
    const scaled = scaleLinesToContract(sorted, contractAmount)
    if (!scaled) {
      showToast('Give the lines a value first; all-zero lines cannot be scaled.', 'info')
      return
    }
    await run('Could not scale the lines', async () => {
      for (const l of scaled) {
        const { error } = await supabase.from('bid_sov_lines').update({ value: l.value, labor: l.labor }).eq('id', l.id)
        if (error) throw error
      }
    })
  }

  return (
    <div data-testid="cover-letter-sov-lines">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            <th style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, width: '1.6rem' }}>#</th>
            <th style={{ ...cellStyle, textAlign: 'left', fontWeight: 600 }}>Line</th>
            {splitOn ? <th style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>Labor</th> : null}
            {splitOn ? <th style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>Material</th> : null}
            <th style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>Value</th>
            <th style={cellStyle} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((line, i) => {
            const s = splitOn ? lineSplit(line, ruleLaborPct) : null
            return (
              <Fragment key={line.id}>
                <tr>
                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={cellStyle}>
                    <input
                      type="text"
                      aria-label={`Line ${i + 1} name`}
                      placeholder="Description of work"
                      value={draftOf(line.id, 'label', line.label)}
                      onChange={(e) => setDraft(line.id, 'label', e.target.value)}
                      onBlur={() => void commit(line, 'label')}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                      maxLength={200}
                      style={{ ...inputStyle, width: '100%' }}
                    />
                  </td>
                  {splitOn && s ? (
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Line ${i + 1} labor`}
                        title={s.source === 'rule' ? `No figure typed: the company labor share (${ruleLaborPct}%)` : 'Typed; blank it to use the company share'}
                        value={draftOf(line.id, 'labor', line.labor == null ? '' : formatCurrency(line.labor))}
                        placeholder={formatCurrency(s.labor)}
                        onChange={(e) => setDraft(line.id, 'labor', e.target.value)}
                        onBlur={() => void commit(line, 'labor')}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                        style={{ ...numInputStyle, background: s.source === 'typed' ? 'var(--bg-amber-100)' : undefined }}
                      />
                    </td>
                  ) : null}
                  {splitOn && s ? <td style={{ ...cellStyle, textAlign: 'right' }}>${formatCurrency(s.material)}</td> : null}
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Line ${i + 1} value`}
                      value={draftOf(line.id, 'value', formatCurrency(line.value))}
                      onChange={(e) => setDraft(line.id, 'value', e.target.value)}
                      onBlur={() => void commit(line, 'value')}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                      style={numInputStyle}
                    />
                  </td>
                  <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => void move(line, -1)} disabled={busy || i === 0} title="Move up" aria-label={`Move line ${i + 1} up`} style={{ ...iconBtn, color: i === 0 ? 'var(--text-faint-300)' : 'var(--text-muted)' }}>▲</button>{' '}
                    <button type="button" onClick={() => void move(line, 1)} disabled={busy || i === sorted.length - 1} title="Move down" aria-label={`Move line ${i + 1} down`} style={{ ...iconBtn, color: i === sorted.length - 1 ? 'var(--text-faint-300)' : 'var(--text-muted)' }}>▼</button>{' '}
                    <button type="button" onClick={() => void removeLine(line)} disabled={busy} title="Remove line" aria-label={`Remove line ${i + 1}`} style={{ ...iconBtn, color: 'var(--text-red-600)', fontSize: '0.95rem' }}>×</button>
                  </td>
                </tr>
                <tr>
                  <td />
                  <td colSpan={splitOn ? 5 : 3} style={{ padding: '0 0.2rem 0.3rem' }}>
                    <input
                      type="text"
                      aria-label={`Line ${i + 1} note`}
                      placeholder="Note for the GC (optional)"
                      value={draftOf(line.id, 'note', line.note)}
                      onChange={(e) => setDraft(line.id, 'note', e.target.value)}
                      onBlur={() => void commit(line, 'note')}
                      maxLength={500}
                      style={{ ...inputStyle, width: '100%', border: '1px solid var(--border)', fontSize: '0.75rem', fontStyle: draftOf(line.id, 'note', line.note) ? undefined : 'italic' }}
                    />
                  </td>
                </tr>
              </Fragment>
            )
          })}
          <tr style={{ fontWeight: 600 }}>
            <td style={{ ...cellStyle, borderTop: '1px solid var(--border-strong)' }} />
            <td style={{ ...cellStyle, borderTop: '1px solid var(--border-strong)' }}>{sorted.length} {sorted.length === 1 ? 'line' : 'lines'}</td>
            {splitOn ? <td style={{ ...cellStyle, borderTop: '1px solid var(--border-strong)', textAlign: 'right' }}>${formatCurrency(totals.labor)}</td> : null}
            {splitOn ? <td style={{ ...cellStyle, borderTop: '1px solid var(--border-strong)', textAlign: 'right' }}>${formatCurrency(totals.material)}</td> : null}
            <td style={{ ...cellStyle, borderTop: '1px solid var(--border-strong)', textAlign: 'right' }}>${formatCurrency(totals.value)}</td>
            <td style={{ borderTop: '1px solid var(--border-strong)' }} />
          </tr>
        </tbody>
      </table>
      {sorted.length > 0 && !rec.balanced ? (
        <div data-testid="cover-letter-sov-lines-gap" style={{ marginTop: '0.4rem', padding: '0.3rem 0.45rem', background: 'var(--bg-amber-100)', border: '1px solid var(--border-amber)', borderRadius: 4, color: 'var(--text-amber-700)', fontSize: '0.75rem' }}>
          ⚠ Lines add to ${formatCurrency(rec.total)} — ${formatCurrency(Math.abs(rec.gap))} {rec.gap > 0 ? 'short of' : 'over'} the ${formatCurrency(contractAmount)} contract.{' '}
          <button type="button" onClick={() => void scaleToContract()} disabled={busy} style={{ ...linkStyle, color: 'var(--text-amber-700)' }}>Scale every line to the contract</button>
        </div>
      ) : sorted.length > 0 ? (
        <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-green-700)' }}>Lines add to the ${formatCurrency(contractAmount)} contract.</div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', alignItems: 'center', marginTop: '0.45rem', fontSize: '0.75rem' }}>
        <button type="button" onClick={() => void addLine()} disabled={busy} style={{ padding: '0.2rem 0.6rem', background: 'var(--bg-blue-tint)', border: '1px solid #3b82f6', borderRadius: 4, color: 'var(--text-blue-700)', cursor: 'pointer', fontSize: '0.8125rem' }}>+ Add line</button>
        <button type="button" onClick={() => setPasteOpen((v) => !v)} style={linkStyle}>Paste the GC's line names…</button>
        <button type="button" onClick={() => void seedAgain()} disabled={busy || !seeds} title={seeds ? 'Replace the lines with the three stages as they stand now' : 'Waiting for the takeoff'} style={{ ...linkStyle, color: seeds ? 'var(--text-blue-700)' : 'var(--text-faint)' }}>Seed again from the stages</button>
      </div>
      {pasteOpen ? (
        <div style={{ marginTop: '0.4rem' }}>
          <textarea
            aria-label="The GC's line names, one per row"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder={'One line per row, as on the GC\'s form:\n1. Mobilization\n2. Underground rough-in\n3. Gas piping'}
            style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.8125rem', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.3rem', fontSize: '0.75rem' }}>
            <button type="button" onClick={() => void pasteNames()} disabled={busy} style={{ padding: '0.2rem 0.6rem', background: '#3b82f6', border: '1px solid #3b82f6', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: '0.8125rem' }}>Add these lines (values blank)</button>
            <button type="button" onClick={() => { setPasteOpen(false); setPasteText('') }} style={linkStyle}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

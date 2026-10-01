/**
 * The parts of one submittal row, in the row's editor (2026-10-01): each part bought on its own —
 * its name, how many go on one fixture, the house, the lead time, the stage it is needed for — and
 * whether the GC sees it. Every part is ordered; a part the GC does not see is "order only". On a
 * draft the parts can be renamed, switched, moved, taken off and typed in; on a shared revision
 * the GC has already read them, so only the office's facts (house, lead time, stage, how many)
 * change. Controlled: the row editor holds the drafts and saves them.
 */
import type { CSSProperties } from 'react'
import { describeLeadTime, parseLeadTime } from '../../lib/submittals/leadTime'
import { STAGE_WORDS, type PartDraft, type PartLeadTexts, type PartStage } from '../../lib/submittals/itemParts'

const inputStyle: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0 }
const small: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const iconBtn: CSSProperties = { minWidth: 32, height: 32, padding: '0 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer' }


export function SubmittalPartsEditor({
  drafts,
  onChange,
  leadTexts,
  onLeadTexts,
  houses,
  canEditProduct,
  assembly,
}: {
  drafts: PartDraft[]
  onChange: (next: PartDraft[]) => void
  leadTexts: PartLeadTexts
  onLeadTexts: (next: PartLeadTexts) => void
  houses: ReadonlyArray<{ id: string; name: string }>
  /** A draft: parts can be renamed, switched, moved, taken off and added. */
  canEditProduct: boolean
  /** "from LAV 1 assembly SPACEX", when the parts came out of one. */
  assembly?: string
}) {
  const set = (i: number, patch: Partial<PartDraft>) => onChange(drafts.map((d, k) => (k === i ? { ...d, ...patch } : d)))
  const move = (i: number, by: -1 | 1) => {
    const j = i + by
    if (j < 0 || j >= drafts.length) return
    const next = [...drafts]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    const texts: PartLeadTexts = { ...leadTexts }
    ;[texts[i], texts[j]] = [leadTexts[j] ?? '', leadTexts[i] ?? '']
    onLeadTexts(texts)
    onChange(next)
  }
  const remove = (i: number) => {
    const texts: PartLeadTexts = {}
    drafts.forEach((_, k) => {
      if (k < i) texts[k] = leadTexts[k] ?? ''
      else if (k > i) texts[k - 1] = leadTexts[k] ?? ''
    })
    onLeadTexts(texts)
    onChange(drafts.filter((_, k) => k !== i))
  }
  const add = () => onChange([...drafts, { label: '', quantity: 1, on_submittal: true, supply_house_id: null, lead_time_days: null, stage: null }])
  const gcCount = drafts.filter((d) => d.on_submittal && d.label.trim()).length
  const orderOnly = drafts.filter((d) => !d.on_submittal && d.label.trim()).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }} data-testid="parts-editor">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Parts · each one is bought on its own
        </span>
        <span style={small}>
          {gcCount} the GC sees{orderOnly > 0 ? ` · ${orderOnly} order only` : ''}
          {assembly ? ` · ${assembly}` : ''}
        </span>
      </div>
      {drafts.map((d, i) => {
        const leadText = leadTexts[i] ?? (d.lead_time_days != null ? describeLeadTime(d.lead_time_days) ?? '' : '')
        const leadBad = leadText.trim() !== '' && parseLeadTime(leadText) == null
        return (
          <div key={d.id ?? `new-${i}`} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.45rem 0.55rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', background: d.on_submittal ? 'var(--surface)' : 'var(--bg-subtle)' }} data-testid="part-editor-row">
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              {canEditProduct ? (
                <input type="text" aria-label={`Part ${i + 1}`} placeholder="maker and model, e.g. TOTO CT728CUVG#01" value={d.label} onChange={(e) => set(i, { label: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              ) : (
                <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-strong)', fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{d.label}</span>
              )}
              {canEditProduct ? (
                <>
                  <button type="button" aria-label={`Move part ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} style={{ ...iconBtn, opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                  <button type="button" aria-label={`Move part ${i + 1} down`} disabled={i === drafts.length - 1} onClick={() => move(i, 1)} style={{ ...iconBtn, opacity: i === drafts.length - 1 ? 0.4 : 1 }}>↓</button>
                  <button type="button" aria-label={`Take part ${i + 1} off`} title="Take it off this row. For a part another trade buys." onClick={() => remove(i)} style={iconBtn}>×</button>
                </>
              ) : null}
            </div>
            {d.priced_label ? (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-amber-700)' }} data-testid="part-priced">
                <span>In place of the priced <b style={{ fontWeight: 600 }}>{d.priced_label}</b>.</span>
                <input type="text" aria-label={`Why part ${i + 1} and not the one priced`} placeholder="why: the GC's spec, lead time, the house's stock…" value={d.reason_note ?? ''} onChange={(e) => set(i, { reason_note: e.target.value })} style={{ ...inputStyle, flex: '1 1 14rem' }} />
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8125rem', color: d.on_submittal ? 'var(--text-strong)' : 'var(--text-muted)', cursor: canEditProduct ? 'pointer' : 'default' }} title="Off: order only. It is bought, and it shows on the procurement log, but not on the GC's submittal.">
                <input type="checkbox" aria-label={`The GC sees part ${i + 1}`} checked={d.on_submittal} disabled={!canEditProduct} onChange={(e) => set(i, { on_submittal: e.target.checked })} />
                {d.on_submittal ? 'GC sees it' : 'Order only'}
              </label>
              <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', ...small }}>
                each fixture
                <input type="number" aria-label={`How many of part ${i + 1} on one fixture`} min={0} step="any" value={Number.isFinite(d.quantity) ? d.quantity : ''} onChange={(e) => set(i, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })} style={{ ...inputStyle, width: '4rem' }} />
              </label>
              {houses.length > 0 ? (
                <select aria-label={`House for part ${i + 1}`} value={d.supply_house_id ?? ''} onChange={(e) => set(i, { supply_house_id: e.target.value || null })} style={{ ...inputStyle, maxWidth: '11rem' }}>
                  <option value="">No house</option>
                  {d.supply_house_id && !houses.some((h) => h.id === d.supply_house_id) ? <option value={d.supply_house_id}>The house on this part</option> : null}
                  {houses.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              ) : null}
              <input
                type="text"
                aria-label={`Lead time for part ${i + 1}`}
                placeholder="lead: 3 wk"
                value={leadText}
                onChange={(e) => {
                  onLeadTexts({ ...leadTexts, [i]: e.target.value })
                  set(i, { lead_time_days: e.target.value.trim() === '' ? null : parseLeadTime(e.target.value) })
                }}
                style={{ ...inputStyle, width: '6.5rem', borderColor: leadBad ? '#dc2626' : 'var(--border-strong)' }}
              />
              <select aria-label={`Stage for part ${i + 1}`} value={d.stage ?? ''} onChange={(e) => set(i, { stage: (e.target.value || null) as PartStage | null })} style={{ ...inputStyle, maxWidth: '9rem' }} title="When it is needed on the job. Blank: the fixture's stage.">
                <option value="">the fixture's stage</option>
                {(Object.keys(STAGE_WORDS) as PartStage[]).map((k) => (
                  <option key={k} value={k}>{STAGE_WORDS[k]}</option>
                ))}
              </select>
            </div>
          </div>
        )
      })}
      {canEditProduct ? (
        <button type="button" onClick={add} style={{ ...iconBtn, alignSelf: 'flex-start', padding: '0 0.7rem' }} data-testid="add-part">
          + Add a part
        </button>
      ) : null}
    </div>
  )
}

/**
 * The parts of one submittal row, in the row's editor (2026-10-01): each part bought on its own —
 * its name, how many go on one fixture, the house, the lead time, the stage it is needed for — and
 * whether the GC sees it. Every part is ordered; a part the GC does not see is "order only". On a
 * draft the parts can be renamed, switched, moved, taken off and typed in; on a shared revision
 * the GC has already read them, so only the office's facts (house, lead time, stage, how many)
 * change. Controlled: the row editor holds the drafts and saves them.
 *
 * One line a part, under headings, in three groups by who sees it (`partsEditorGroups`): the GC's
 * parts in the order the submittal prints them (the arrows move a part inside that group only),
 * then order only, then left out. *Shown to* moves a part to another group. A part the reviewer
 * answered says so under its name. An empty lead time asks for one in amber; nothing in the box
 * reads like a lead time that was never typed. On a narrow screen a part is three short lines
 * (`.sub-parts-row` in `index.css`).
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import { describeLeadTime, parseLeadTime } from '../../lib/submittals/leadTime'
import { STAGE_WORDS, partPickOf, withPartPick, type PartDraft, type PartLeadTexts, type PartPick, type PartStage } from '../../lib/submittals/itemParts'
import { groupPartDrafts, neighborInGroup, type PartCallMark } from '../../lib/submittals/partsEditorGroups'

const inputStyle: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0, width: '100%', boxSizing: 'border-box' }
const small: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const iconBtn: CSSProperties = { minWidth: 24, height: 30, padding: '0 0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer' }
const PICK_WORDS: Record<PartPick, string> = { gc: 'GC sees it', order: 'Order only', out: 'Left out' }
const CALL_COLORS: Record<PartCallMark['tone'], { background: string; color: string }> = {
  approved: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  revise: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)' },
  rejected: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
}

export function SubmittalPartsEditor({
  drafts,
  onChange,
  leadTexts,
  onLeadTexts,
  houses,
  canEditProduct,
  focusId = null,
  fixtureOrderOnly = false,
  bought,
  calls,
}: {
  drafts: PartDraft[]
  onChange: (next: PartDraft[]) => void
  leadTexts: PartLeadTexts
  onLeadTexts: (next: PartLeadTexts) => void
  houses: ReadonlyArray<{ id: string; name: string; /** v2.4685 · the house's usual lead time, the empty box's placeholder */ default_lead_time_days?: number | null }>
  /** A draft: parts can be renamed, switched, moved, taken off and added. */
  canEditProduct: boolean
  /** The part a Procure line opened the editor on (2026-10-02): ringed, scrolled to, its house box focused. */
  focusId?: string | null
  /** 2026-10-02 · the whole fixture is order only: every part is bought and none is the GC's, whatever its own pick. */
  fixtureOrderOnly?: boolean
  /** By part id: "Ordered 09/23" when the procurement log holds an order for the part. Such a part cannot be left out. */
  bought?: ReadonlyMap<string, string>
  /** By part id: what the reviewer answered on it, for the line under its name. */
  calls?: ReadonlyMap<string, PartCallMark>
}) {
  const focusRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = focusRef.current
    if (!el) return
    el.scrollIntoView?.({ block: 'center' })
    const box = el.querySelector<HTMLElement>('select[aria-label^="House for part"]') ?? el.querySelector<HTMLElement>('input[aria-label^="Lead time for part"]')
    box?.focus({ preventScroll: true })
    // Once, on open: the editor keeps its own place after that.
  }, [])
  const set = (i: number, patch: Partial<PartDraft>) => onChange(drafts.map((d, k) => (k === i ? { ...d, ...patch } : d)))
  /** Trade places with another part: the two drafts, and the lead times being typed on them. */
  const swap = (i: number, j: number) => {
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
  /** A part typed here and never saved has nothing to remember: left out, it simply goes. */
  const setPick = (i: number, pick: PartPick) => {
    const d = drafts[i]!
    if (pick === 'out' && !d.id) remove(i)
    else onChange(drafts.map((x, k) => (k === i ? withPartPick(x, pick) : x)))
  }
  const groups = groupPartDrafts(drafts, fixtureOrderOnly)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }} data-testid="parts-editor">
      <div className="sub-parts-row sub-parts-head" aria-hidden="true">
        <span style={{ gridArea: 'mv' }} />
        <span style={{ gridArea: 'name' }}>Part</span>
        <span style={{ gridArea: 'each' }} title="How many go on one fixture">Each</span>
        <span style={{ gridArea: 'house' }}>{houses.length > 0 ? 'House' : ''}</span>
        <span style={{ gridArea: 'lead' }}>Lead time</span>
        <span style={{ gridArea: 'stage' }}>Stage</span>
        <span style={{ gridArea: 'pick' }}>Shown to</span>
      </div>
      {groups.map((group) => (
        <div key={group.key} role="group" aria-label={group.title} data-testid="part-group" data-group={group.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: group.key === 'out' ? 'var(--text-muted)' : 'var(--text-strong)' }}>{group.title}</span>
            <span style={small}>{group.hint}</span>
          </div>
          {group.indexes.map((i) => {
            const d = drafts[i]!
            const n = i + 1
            const leadText = leadTexts[i] ?? (d.lead_time_days != null ? describeLeadTime(d.lead_time_days) ?? '' : '')
            const leadBad = leadText.trim() !== '' && parseLeadTime(leadText) == null
            // v2.4685 · a house's usual lead time covers an empty box: the log reads it, so nothing is owed.
            const usualHouse = d.supply_house_id ? houses.find((h) => h.id === d.supply_house_id) : undefined
            const usual = usualHouse?.default_lead_time_days != null ? describeLeadTime(usualHouse.default_lead_time_days) : null
            const leadOwed = leadText.trim() === '' && !usual
            const focused = focusId != null && d.id === focusId
            const pick = partPickOf(d)
            const shown: PartPick = fixtureOrderOnly && pick === 'gc' ? 'order' : pick
            const held = bought?.get(d.id ?? '') ?? ''
            const call = d.id ? calls?.get(d.id) ?? null : null
            const up = group.key === 'gc' ? neighborInGroup(group, i, -1) : null
            const down = group.key === 'gc' ? neighborInGroup(group, i, 1) : null
            return (
              <div
                key={d.id ?? `new-${i}`}
                ref={focused ? focusRef : undefined}
                className={`sub-parts-row${d.left_out ? ' sub-parts-row--out' : ''}`}
                style={focused ? { borderColor: '#2563eb', boxShadow: 'inset 0 0 0 1px #2563eb', background: 'var(--bg-blue-tint)' } : undefined}
                data-testid="part-editor-row"
                data-focused={focused ? 'true' : undefined}
                data-pick={pick}
              >
                <span className="sub-parts-mv" style={{ gridArea: 'mv' }}>
                  {canEditProduct && group.key === 'gc' ? (
                    <>
                      <button type="button" aria-label={`Move part ${n} up`} disabled={up == null} onClick={() => (up != null ? swap(i, up) : undefined)} style={{ ...iconBtn, opacity: up == null ? 0.4 : 1 }}>↑</button>
                      <button type="button" aria-label={`Move part ${n} down`} disabled={down == null} onClick={() => (down != null ? swap(i, down) : undefined)} style={{ ...iconBtn, opacity: down == null ? 0.4 : 1 }}>↓</button>
                    </>
                  ) : null}
                </span>
                <span style={{ gridArea: 'name', display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                  {canEditProduct && !d.left_out ? (
                    <input type="text" aria-label={`Part ${n}`} title={d.label} placeholder="maker and model, e.g. TOTO CT728CUVG#01" value={d.label} onChange={(e) => set(i, { label: e.target.value })} style={inputStyle} />
                  ) : (
                    <span style={{ fontSize: '0.8125rem', padding: '0.35rem 0', color: d.left_out ? 'var(--text-muted)' : 'var(--text-strong)', fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere', textDecoration: d.left_out ? 'line-through' : undefined }}>{d.label}</span>
                  )}
                  {call ? (
                    <span style={{ ...small, display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'baseline' }} data-testid="part-call" data-tone={call.tone}>
                      <b style={{ ...CALL_COLORS[call.tone], fontSize: '0.7rem', fontWeight: 700, padding: '0.05rem 0.45rem', borderRadius: 999, whiteSpace: 'nowrap' }}>{call.words}</b>
                      {call.note ? <span>“{call.note}”</span> : null}
                    </span>
                  ) : null}
                  {d.priced_label ? (
                    <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-amber-700)' }} data-testid="part-priced">
                      <span>In place of the priced <b style={{ fontWeight: 600 }}>{d.priced_label}</b>.</span>
                      <input type="text" aria-label={`Why part ${n} and not the one priced`} placeholder="why: the GC's spec, lead time, the house's stock…" value={d.reason_note ?? ''} onChange={(e) => set(i, { reason_note: e.target.value })} style={{ ...inputStyle, flex: '1 1 14rem', width: 'auto' }} />
                    </span>
                  ) : null}
                  {held && !d.left_out ? <span style={small} data-testid="part-bought">{held}</span> : null}
                </span>
                {d.left_out ? (
                  <span style={{ ...small, gridArea: 'note', alignSelf: 'center' }} data-testid="part-left-out">not submitted, not ordered · Save takes it off</span>
                ) : (
                  <>
                    <label style={{ gridArea: 'each', display: 'flex', gap: '0.3rem', alignItems: 'center', ...small }}>
                      <span className="sub-parts-each-word">each</span>
                      <input type="number" aria-label={`How many of part ${n} on one fixture`} title="How many go on one fixture" min={0} step="any" value={Number.isFinite(d.quantity) ? d.quantity : ''} onChange={(e) => set(i, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })} style={inputStyle} />
                    </label>
                    {houses.length > 0 ? (
                      <select aria-label={`House for part ${n}`} value={d.supply_house_id ?? ''} onChange={(e) => set(i, { supply_house_id: e.target.value || null })} style={{ ...inputStyle, gridArea: 'house' }}>
                        <option value="">No house</option>
                        {d.supply_house_id && !houses.some((h) => h.id === d.supply_house_id) ? <option value={d.supply_house_id}>The house on this part</option> : null}
                        {houses.map((h) => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    ) : null}
                    <input
                      type="text"
                      aria-label={`Lead time for part ${n}`}
                      title={usual ? `${usual} is ${usualHouse!.name}'s usual. Type a number to use another.` : 'How long the house takes, like 3 wk or 10 days'}
                      placeholder={usual ? `${usual} · ${usualHouse!.name}'s usual` : 'add'}
                      data-owed={leadOwed ? 'true' : undefined}
                      value={leadText}
                      onChange={(e) => {
                        onLeadTexts({ ...leadTexts, [i]: e.target.value })
                        set(i, { lead_time_days: e.target.value.trim() === '' ? null : parseLeadTime(e.target.value) })
                      }}
                      style={{ ...inputStyle, gridArea: 'lead', ...(leadBad ? { borderColor: '#dc2626' } : leadOwed ? { borderColor: '#d97706', background: 'var(--bg-amber-tint)' } : {}) }}
                    />
                    <select aria-label={`Stage for part ${n}`} value={d.stage ?? ''} onChange={(e) => set(i, { stage: (e.target.value || null) as PartStage | null })} style={{ ...inputStyle, gridArea: 'stage' }} title="When it is needed on the job. Blank: the fixture's stage.">
                      <option value="">the fixture's stage</option>
                      {(Object.keys(STAGE_WORDS) as PartStage[]).map((k) => (
                        <option key={k} value={k}>{STAGE_WORDS[k]}</option>
                      ))}
                    </select>
                  </>
                )}
                {/* Where the three buttons were: one small menu. On a shared revision the GC has read the parts, so they hold. */}
                <select
                  aria-label={`What happens to part ${n}`}
                  data-testid="part-pick"
                  value={shown}
                  disabled={!canEditProduct}
                  title={canEditProduct ? 'GC sees it, order only, or left out. Changing it moves the part to that group.' : 'The GC has read this revision. Change the parts on the next draft.'}
                  onChange={(e) => setPick(i, e.target.value as PartPick)}
                  style={{ ...inputStyle, gridArea: 'pick', fontWeight: 600, ...(shown === 'gc' ? { color: 'var(--text-blue-700)' } : shown === 'order' ? { color: 'var(--text-amber-700)' } : { color: 'var(--text-muted)' }) }}
                >
                  <option value="gc" disabled={fixtureOrderOnly}>{fixtureOrderOnly ? `${PICK_WORDS.gc} · the whole fixture is order only` : PICK_WORDS.gc}</option>
                  <option value="order">{PICK_WORDS.order}</option>
                  <option value="out" disabled={held !== '' && pick !== 'out'}>{held && pick !== 'out' ? `${PICK_WORDS.out} · it cannot be: ${held}` : PICK_WORDS.out}</option>
                </select>
              </div>
            )
          })}
        </div>
      ))}
      {canEditProduct ? (
        <button type="button" onClick={add} style={{ ...iconBtn, alignSelf: 'flex-start', padding: '0 0.7rem', marginTop: '0.35rem' }} data-testid="add-part">
          + Add a part
        </button>
      ) : null}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { NumericEntryPad } from '../NumericEntryPad'

export function NewCountRow({ bidId, serviceTypeId, onSaved, onCancel, onSavedAndAddAnother, showDragHandleColumn }: { bidId: string; serviceTypeId?: string; onSaved: () => void; onCancel: () => void; onSavedAndAddAnother?: () => void; showDragHandleColumn?: boolean }) {
  const { showToast } = useToastContext()
  const countInputRef = useRef<HTMLInputElement>(null)
  const [fixture, setFixture] = useState('')
  const [count, setCount] = useState('')
  const [groupTag, setGroupTag] = useState('')
  const [page, setPage] = useState('')
  const [saving, setSaving] = useState(false)
  const [countsFixtureGroups, setCountsFixtureGroups] = useState<Array<{ label: string; fixtures: string[] }>>([])

  useEffect(() => {
    if (!serviceTypeId) {
      setCountsFixtureGroups([])
      return
    }
    const stId = serviceTypeId
    let cancelled = false
    async function load() {
      const { data: groupsData } = await supabase
        .from('counts_fixture_groups')
        .select('id, label, sequence_order')
        .eq('service_type_id', stId)
        .order('sequence_order', { ascending: true })
      if (cancelled || !groupsData?.length) {
        if (!cancelled) setCountsFixtureGroups([])
        return
      }
      const groupIds = (groupsData as { id: string }[]).map((g) => g.id)
      const { data: itemsData } = await supabase
        .from('counts_fixture_group_items')
        .select('group_id, name, sequence_order')
        .in('group_id', groupIds)
        .order('sequence_order', { ascending: true })
      if (cancelled) return
      const groups = (groupsData as { id: string; label: string; sequence_order: number }[]).map((g) => ({
        label: g.label,
        fixtures: ((itemsData as { group_id: string; name: string }[]) ?? [])
          .filter((i) => i.group_id === g.id)
          .map((i) => i.name),
      }))
      setCountsFixtureGroups(groups)
    }
    void load()
    return () => { cancelled = true }
  }, [serviceTypeId])

  async function submit() {
    const num = parseFloat(count)
    if (isNaN(num) || !fixture.trim()) return
    setSaving(true)
    const { data: maxSeqData } = await supabase.from('bids_count_rows').select('sequence_order').eq('bid_id', bidId).order('sequence_order', { ascending: false }).limit(1)
    const maxSeq = maxSeqData?.[0]?.sequence_order ?? 0
    const { error } = await supabase.from('bids_count_rows').insert({ bid_id: bidId, fixture: fixture.trim(), count: num, group_tag: groupTag.trim() || null, page: page.trim() || null, sequence_order: maxSeq + 1 })
    if (error) { setSaving(false); showToast(error.message, 'error'); return }
    onSaved()
  }

  async function submitAndAdd(): Promise<boolean> {
    const num = parseFloat(count)
    if (isNaN(num) || !fixture.trim()) return false
    setSaving(true)
    const { data: maxSeqData } = await supabase.from('bids_count_rows').select('sequence_order').eq('bid_id', bidId).order('sequence_order', { ascending: false }).limit(1)
    const maxSeq = maxSeqData?.[0]?.sequence_order ?? 0
    const { error } = await supabase.from('bids_count_rows').insert({ bid_id: bidId, fixture: fixture.trim(), count: num, group_tag: groupTag.trim() || null, page: page.trim() || null, sequence_order: maxSeq + 1 })
    if (error) {
      setSaving(false)
      showToast(error.message, 'error')
      return false
    }
    setFixture('')
    setCount('')
    setGroupTag('')
    setPage('')
    setSaving(false)
    onSavedAndAddAnother?.()
    return true
  }

  async function submitAndAddThenFocusCount() {
    const ok = await submitAndAdd()
    if (ok) requestAnimationFrame(() => countInputRef.current?.focus())
  }

  const calcWidth = 132
  const hasFixtureGroups = countsFixtureGroups.length > 0
  const missingFields: string[] = []
  if (!fixture.trim()) missingFields.push('Fixture')
  if (isNaN(parseFloat(count))) missingFields.push('Count')
  const canSubmit = missingFields.length === 0

  return (
    <>
      <tr style={{ borderBottom: hasFixtureGroups ? 'none' : '1px solid var(--border)' }}>
        {showDragHandleColumn && <td rowSpan={hasFixtureGroups ? 2 : 1} style={{ padding: '0.75rem', width: 32, verticalAlign: 'top', borderBottom: '1px solid var(--border)' }} />}
        <td rowSpan={hasFixtureGroups ? 2 : 1} style={{ padding: '0.75rem', width: calcWidth, verticalAlign: 'top', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: calcWidth }}>
            <input ref={countInputRef} type="number" step="any" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Count*" style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
            <div style={{ marginTop: hasFixtureGroups ? '1.75rem' : undefined }}>
              <NumericEntryPad widthPx={calcWidth} value={count} onChange={setCount} />
            </div>
          </div>
        </td>
        <td style={{ padding: '0.75rem', width: '50%', verticalAlign: 'top', borderBottom: '1px solid var(--border)' }}>
          <input type="text" value={fixture} onChange={(e) => setFixture(e.target.value)} placeholder="Fixture or Tie-in*" style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem', verticalAlign: 'top', borderBottom: '1px solid var(--border)' }}>
          <input type="text" value={groupTag} onChange={(e) => setGroupTag(e.target.value)} placeholder="Group/Tag" style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem', verticalAlign: 'top', borderBottom: '1px solid var(--border)' }}>
          <input
            type="text"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Tab' || e.shiftKey || !canSubmit || saving) return
              e.preventDefault()
              void submitAndAddThenFocusCount()
            }}
            placeholder="Plan Page"
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
          />
        </td>
        <td rowSpan={hasFixtureGroups ? 2 : 1} style={{ padding: '0.75rem', verticalAlign: 'top', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
              <button type="button" onClick={submit} disabled={!canSubmit || saving} title={!canSubmit ? `Required: ${missingFields.join(', ')}` : undefined} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
              <button type="button" onClick={onCancel} style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-200)', color: 'var(--text-700)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <button type="button" onClick={() => void submitAndAddThenFocusCount()} disabled={!canSubmit || saving} title={!canSubmit ? `Required: ${missingFields.join(', ')}` : undefined} style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', alignSelf: 'center' }}>Save<br />& Add</button>
              {!canSubmit && !saving && missingFields.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#FF6600', display: 'inline-block' }}>
                <span style={{ display: 'block' }}>Required:</span>
                {missingFields.map((f) => (
                  <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                ))}
              </span>
              )}
            </div>
          </div>
        </td>
      </tr>
      {hasFixtureGroups && (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <td colSpan={3} style={{ padding: '0.75rem', verticalAlign: 'top' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {countsFixtureGroups.map((group) => (
                <div key={group.label} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, marginRight: '0.25rem', flexShrink: 0 }}>{group.label}</span>
                  {group.fixtures.map((name) => (
                    <button key={name} type="button" tabIndex={-1} onClick={() => setFixture(name)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>{name}</button>
                  ))}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

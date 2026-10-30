import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  BID_PLAN_SET_SELECT,
  comparePlanSets,
  planSetDateWords,
  planSetDraftProblem,
  planSetFileFromProbe,
  planSetFileWords,
  samePlanLink,
  type BidPlanSetRow,
} from '../../lib/bids/bidPlanSets'

/**
 * Edit Bid → Plans → Plan sets (v2.6169): one row per set of plans on the bid — its name, date, memo
 * and what stands behind its link (read by `plan-fetch`'s probe the moment the set saves) — with Open,
 * Check the link, Robot reads this set and ×. The Plans link field above stays the one set the robot
 * reads and the Plans panel searches: **Robot reads this set** copies a set's link into it, and the
 * set carrying that link wears the chip. Saved bids only — a set needs a bid id.
 */
export type BidPlanSetsFieldProps = {
  bidId: string
  /** The form's Plans link: the set the robot reads. */
  plansLink: string
  /** Robot reads this set: the form's Plans link takes the set's link. */
  onRobotSetChange: (link: string) => void
}

type Draft = { name: string; planDate: string; memo: string; link: string }
const EMPTY_DRAFT: Draft = { name: '', planDate: '', memo: '', link: '' }

type ProbeAnswer = { readable: boolean; note?: string | null; name?: string | null; size?: number | null; count?: number | null; error?: string }

/** Ask plan-fetch what stands behind the link; null when the function could not answer (the row keeps *Not read yet*). */
async function probeLink(link: string): Promise<ProbeAnswer | null> {
  try {
    const { data, error } = await supabase.functions.invoke<ProbeAnswer>('plan-fetch', { body: { probe_url: link } })
    if (error || !data || data.error || typeof data.readable !== 'boolean') return null
    return data
  } catch {
    return null
  }
}

export function BidPlanSetsField({ bidId, plansLink, onRobotSetChange }: BidPlanSetsFieldProps) {
  const { user } = useAuth()
  const [rows, setRows] = useState<BidPlanSetRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [gen, setGen] = useState(0)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data, error: err } = await supabase.from('bid_plan_sets').select(BID_PLAN_SET_SELECT).eq('bid_id', bidId)
        if (err) throw err
        if (cancelled) return
        setRows(((data ?? []) as BidPlanSetRow[]).sort(comparePlanSets))
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not read the plan sets'))
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, gen])

  /** Read the file name and size behind a set's link and keep them on the row. */
  const checkLink = useCallback(async (row: Pick<BidPlanSetRow, 'id' | 'link'>) => {
    const answer = await probeLink(row.link)
    if (!answer) return
    const { error: err } = await supabase.from('bid_plan_sets').update(planSetFileFromProbe(answer)).eq('id', row.id)
    if (err) throw err
  }, [])

  const save = useCallback(async () => {
    const p = planSetDraftProblem(draft)
    setProblem(p)
    if (p) return
    setBusy('save')
    setError(null)
    try {
      const link = draft.link.trim()
      const { data, error: err } = await supabase
        .from('bid_plan_sets')
        .insert({ bid_id: bidId, name: draft.name.trim(), memo: draft.memo.trim(), plan_date: draft.planDate || null, link, created_by: user?.id ?? null })
        .select('id, link')
        .single()
      if (err) throw err
      // The first set on a bid with no plans link is the robot's set from here.
      if (!plansLink.trim() && rows.length === 0) onRobotSetChange(link)
      setDraft(EMPTY_DRAFT)
      setAdding(false)
      await checkLink(data as { id: string; link: string })
      setGen((n) => n + 1)
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not save the set'))
    } finally {
      setBusy(null)
    }
  }, [draft, bidId, user?.id, plansLink, rows.length, onRobotSetChange, checkLink])

  const check = useCallback(
    async (row: BidPlanSetRow) => {
      setBusy(row.id)
      setError(null)
      try {
        await checkLink(row)
        setGen((n) => n + 1)
      } catch (e) {
        setError(formatErrorMessage(e, 'Could not read the link'))
      } finally {
        setBusy(null)
      }
    },
    [checkLink],
  )

  const remove = useCallback(async (row: BidPlanSetRow) => {
    setBusy(row.id)
    setError(null)
    try {
      const { error: err } = await supabase.from('bid_plan_sets').delete().eq('id', row.id)
      if (err) throw err
      setPendingRemove(null)
      setGen((n) => n + 1)
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not remove the set'))
    } finally {
      setBusy(null)
    }
  }, [])

  async function pasteLink() {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (text) setDraft((d) => ({ ...d, link: text }))
    } catch {
      setProblem('Paste the link into the box: the clipboard could not be read here.')
    }
  }

  const btn: CSSProperties = { font: 'inherit', fontSize: '0.78rem', padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
  const input: CSSProperties = { font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: 0, width: '100%', boxSizing: 'border-box', background: 'var(--surface)', color: 'inherit' }
  const lab: CSSProperties = { display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }

  return (
    <div data-testid="bid-plan-sets" style={{ marginTop: '0.25rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 500 }}>Plan sets</span>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Every set of plans on this bid, each with its name, date, memo and link. The robot reads the one in the Plans link above.</span>
      </div>
      {!loaded ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.4rem 0' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.4rem 0' }}>The Plans link above is this bid’s one set. Add a set to keep an addendum or a permit set beside it.</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: '0.4rem 0 0', padding: 0, display: 'grid', gap: '0.4rem' }}>
          {rows.map((row) => {
            const robotReads = samePlanLink(row.link, plansLink)
            const date = planSetDateWords(row.plan_date)
            const rowBusy = busy === row.id
            return (
              <li key={row.id} data-testid="bid-plan-set-row" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{row.name}</span>
                    {date ? <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{date}</span> : null}
                    {robotReads ? (
                      <span data-testid="bid-plan-set-robot" style={{ fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0.4rem', borderRadius: 999, background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', color: 'var(--text-blue-800)' }}>
                        Robot reads this
                      </span>
                    ) : null}
                  </div>
                  {row.memo ? <div style={{ fontSize: '0.8rem', color: 'var(--text-base)' }}>{row.memo}</div> : null}
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }} data-testid="bid-plan-set-file">
                    {planSetFileWords({ fileName: row.file_name, fileSize: row.file_size, fileCount: row.file_count, checkedAt: row.checked_at, checkNote: row.check_note })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => openInExternalBrowser(row.link)} title={row.link} style={btn}>
                    Open ↗
                  </button>
                  <button type="button" disabled={rowBusy} onClick={() => void check(row)} title="Read the file name and size behind the link again" style={btn}>
                    {rowBusy && pendingRemove !== row.id ? 'Reading…' : 'Check the link'}
                  </button>
                  {!robotReads ? (
                    <button type="button" onClick={() => onRobotSetChange(row.link)} title="Put this set’s link in the Plans link above, so the robot and the Plans panel read it" style={btn}>
                      Robot reads this set
                    </button>
                  ) : null}
                  {pendingRemove === row.id ? (
                    <>
                      <button type="button" disabled={rowBusy} onClick={() => void remove(row)} style={{ ...btn, borderColor: 'var(--border-red)', color: 'var(--text-red-700)' }}>
                        Remove
                      </button>
                      <button type="button" disabled={rowBusy} onClick={() => setPendingRemove(null)} style={btn}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" aria-label={`Remove ${row.name}`} title="Take this set off the bid; the files in Drive stay" disabled={rowBusy} onClick={() => setPendingRemove(row.id)} style={{ ...btn, color: 'var(--text-muted)', lineHeight: 1 }}>
                      ×
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {adding ? (
        <div data-testid="bid-plan-set-draft" style={{ marginTop: '0.5rem', padding: '0.6rem 0.7rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', display: 'grid', gap: '0.5rem' }}>
          <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label htmlFor="bid-plan-set-name" style={lab}>Name</label>
              <input id="bid-plan-set-name" type="text" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Addendum 2" maxLength={200} style={input} />
            </div>
            <div>
              <label htmlFor="bid-plan-set-date" style={lab}>Date</label>
              <input id="bid-plan-set-date" type="date" value={draft.planDate} onChange={(e) => setDraft((d) => ({ ...d, planDate: e.target.value }))} style={input} />
            </div>
          </div>
          <div>
            <label htmlFor="bid-plan-set-memo" style={lab}>Memo</label>
            <input id="bid-plan-set-memo" type="text" value={draft.memo} onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))} placeholder="What changed, or who sent it" maxLength={2000} style={input} />
          </div>
          <div>
            <label htmlFor="bid-plan-set-link" style={lab}>Link · a Google Drive folder or file</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input id="bid-plan-set-link" type="url" value={draft.link} onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))} placeholder="https://drive.google.com/drive/folders/…" style={{ ...input, flex: 1 }} />
              <button type="button" onClick={() => void pasteLink()} style={btn}>
                Paste a link
              </button>
            </div>
          </div>
          {problem ? (
            <div role="status" style={{ fontSize: '0.8rem', color: 'var(--text-amber-700)' }}>
              {problem}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" disabled={busy === 'save'} onClick={() => void save()} style={{ ...btn, background: '#2563eb', color: '#fff', borderColor: '#2563eb', fontWeight: 600 }}>
              {busy === 'save' ? 'Saving…' : 'Save the set'}
            </button>
            <button
              type="button"
              disabled={busy === 'save'}
              onClick={() => {
                setAdding(false)
                setDraft(EMPTY_DRAFT)
                setProblem(null)
              }}
              style={btn}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} style={{ ...btn, marginTop: '0.5rem', border: '1px dashed var(--border-strong)', background: 'var(--bg-subtle)' }}>
          + Add a set of plans
        </button>
      )}
      {error ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-red-700)', marginTop: '0.35rem' }}>{error}</div>
      ) : null}
    </div>
  )
}

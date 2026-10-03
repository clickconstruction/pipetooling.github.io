import { useState, type Dispatch } from 'react'
import {
  bw,
  GC_COMPANY,
  pDate,
  punchCounts,
  punchItems,
  punchState,
  shortDate,
  type GcAction,
  type GcProject,
  type PunchItem,
  type PunchState,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, input, type Tone } from './gcUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: the punch list (Building lane, owner 2026-10-03). On Closeout, our
 * superintendent lists what is left on a trade's work and checks each item the trade fixes. In the
 * trade's portal, the items to fix with "It is fixed". We accept the work once every item is checked.
 */

const STATE_WORDS: Record<PunchState, { tone: Tone; word: string }> = {
  open: { tone: 'amber', word: 'to fix' },
  fixed: { tone: 'blue', word: 'fixed, check it' },
  done: { tone: 'green', word: 'checked' },
}

/** One trade's punch list on Closeout: the items, their checks, and a line to add one. */
export function GcBuildingPunchList({
  project,
  pkg,
  company,
  canAdd,
  dispatch,
}: {
  project: GcProject
  pkg: TradePackage
  company: string
  /** The job is being built and the work is not accepted yet. */
  canAdd: boolean
  dispatch: Dispatch<GcAction>
}) {
  const items = punchItems(project, pkg.id)
  const c = punchCounts(project, pkg.id)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [where, setWhere] = useState('')
  if (items.length === 0 && !canAdd) return null
  const add = () => {
    dispatch({ type: 'addPunchItem', projectId: project.id, packageId: pkg.id, text, ...(where.trim() ? { where } : {}) })
    setText('')
    setWhere('')
  }
  return (
    <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', display: 'grid', gap: '0.45rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>Punch list</strong>
        {items.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>Nothing listed yet.</span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>
            {c.open + c.fixed === 0 ? `All ${c.total} checked fixed.` : `${c.open + c.fixed} of ${c.total} still open.`}
          </span>
        )}
        {canAdd && !adding && (
          <Btn kind="quiet" onClick={() => setAdding(true)}>
            Add an item
          </Btn>
        )}
      </div>
      {items.map((item) => (
        <PunchRow key={item.id} item={item} company={company} onCheck={(fixed, note) => dispatch({ type: 'checkPunchItem', projectId: project.id, itemId: item.id, fixed, ...(note ? { note } : {}) })} />
      ))}
      {canAdd && adding && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) add()
            }}
            placeholder="What is left to fix"
            aria-label={`A punch item for ${company}`}
            style={{ ...input, flex: '2 1 14rem' }}
          />
          <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Where, like Grid C-4" aria-label="Where on the job" style={{ ...input, flex: '1 1 9rem' }} />
          <Btn kind="primary" disabled={!text.trim()} onClick={add}>
            Add to the punch list
          </Btn>
          <Btn kind="quiet" onClick={() => setAdding(false)}>
            Done adding
          </Btn>
        </div>
      )}
      {items.length > 0 && c.open + c.fixed > 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {company} marks each item fixed in their portal. Our superintendent checks it on the job. We accept the work once every item is checked.
        </div>
      )}
    </div>
  )
}

function PunchRow({ item, company, onCheck }: { item: PunchItem; company: string; onCheck: (fixed: boolean, note?: string) => void }) {
  const st = punchState(item)
  const [back, setBack] = useState(false)
  const [note, setNote] = useState('')
  return (
    <div style={{ display: 'grid', gap: '0.25rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Chip tone={STATE_WORDS[st].tone}>{STATE_WORDS[st].word}</Chip>
        <span style={{ color: st === 'done' ? 'var(--text-muted)' : undefined }}>
          {item.text}
          {item.where ? <span style={{ color: 'var(--text-muted)' }}> · {item.where}</span> : null}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {st === 'done' ? `checked ${shortDate(item.checkedOn)}` : st === 'fixed' ? `${company} fixed it ${shortDate(item.fixedOn)}` : `listed ${shortDate(item.addedOn)}`}
        </span>
      </div>
      {item.sentBack && st !== 'done' && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-amber-800)', paddingLeft: '0.2rem' }}>
          Sent back {item.sentBack.times === 1 ? 'once' : `${item.sentBack.times} times`}, last {shortDate(item.sentBack.on)}.{item.sentBack.note ? ` ${item.sentBack.note}` : ''}
        </div>
      )}
      {st === 'fixed' && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn kind="primary" onClick={() => onCheck(true)}>
            Checked, it is fixed
          </Btn>
          {back ? (
            <>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is still wrong" aria-label="What is still wrong" style={{ ...input, flex: '1 1 14rem' }} />
              <Btn disabled={!note.trim()} onClick={() => onCheck(false, note)}>
                Send it back
              </Btn>
            </>
          ) : (
            <Btn onClick={() => setBack(true)}>Not fixed</Btn>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The trade's punch list in its portal, inside the pay application door: the items to fix with
 * "It is fixed", the ones waiting on our check, and how many we checked. In the portal's language;
 * what our superintendent typed stays as typed.
 */
export function GcBuildingPunchForTrade({ project, pkg, dispatch }: { project: GcProject; pkg: TradePackage; dispatch: Dispatch<GcAction> }) {
  const { lang } = usePortalLang()
  const w = (key: Parameters<typeof bw>[1], vars?: Record<string, string | number>) => bw(lang, key, { gc: GC_COMPANY.shortName, ...vars })
  const items = punchItems(project, pkg.id)
  const c = punchCounts(project, pkg.id)
  if (c.open + c.fixed === 0) return null
  return (
    <div style={{ padding: '0.55rem 0.65rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', borderRadius: 6, display: 'grid', gap: '0.45rem' }}>
      <div>
        <strong>{w('punchHead')}</strong>
        {c.open > 0 && <span style={{ color: 'var(--text-amber-800)' }}> · {w('punchToFix', { n: c.open })}</span>}
      </div>
      {items
        .filter((i) => punchState(i) !== 'done')
        .map((item) => {
          const st = punchState(item)
          return (
            <div key={item.id} style={{ display: 'grid', gap: '0.2rem' }}>
              <div>
                {item.text}
                {item.where ? <span style={{ color: 'var(--text-muted)' }}> · {item.where}</span> : null}
              </div>
              {item.sentBack && st === 'open' && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-amber-800)' }}>
                  {w('punchBack', { date: pDate(lang, item.sentBack.on) })}
                  {item.sentBack.note ? ` “${item.sentBack.note}”` : ''}
                </div>
              )}
              {st === 'open' ? (
                <div>
                  <Btn kind="primary" onClick={() => dispatch({ type: 'tradeFixPunchItem', projectId: project.id, itemId: item.id })}>
                    {w('punchFixedBtn')}
                  </Btn>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{w('punchWaiting')}</div>
              )}
            </div>
          )
        })}
      {c.done > 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{w('punchChecked', { n: c.done })}</div>}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{w('punchWhy')}</div>
    </div>
  )
}

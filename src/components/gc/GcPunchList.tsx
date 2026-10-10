import { useState } from 'react'
import { Btn, Chip, input, type Tone } from './gcUi'
import { punchCounts, punchItems, punchState, type PunchState } from '../../lib/gc/buildingPunch'
import { punchCanAdd } from '../../lib/gc/punchRows'
import type { GcProject, PunchItem, TradePackage } from '../../lib/gc/types'
import { shortDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, the Building lane's U3b-ii: one trade's punch list on real data, ported from the prototype's
 * `GcBuildingPunchList` and `PunchRow` (`GcBuildingPunch.tsx`, branch spike/gc-mode; the plan:
 * to-dos/gc-mode/mockups/building-u3b.md). Our superintendent lists what is left to fix on a trade we hired. The trade
 * marks each item fixed in its portal (the Portal's P5), or tells us by phone and we record it. We check it on the job
 * or send it back. We accept the work once every item is checked. The database's own functions check every press
 * (the Building lane's U3b-i). It shows in the Punch list window and under each trade on Closeout.
 */

export interface PunchWrites {
  onAdd: (packageId: string, item: { text: string; where: string; photoUrl: string }) => void
  /** Take off an item added by mistake. It stays in the record. */
  onRemove: (itemId: string) => void
  /** The trade told us it is fixed. */
  onFixedIn: (itemId: string) => void
  onCheck: (itemId: string, fixed: boolean, note?: string) => void
}

const STATE_WORDS: Record<PunchState, { tone: Tone; word: string }> = {
  open: { tone: 'amber', word: 'to fix' },
  fixed: { tone: 'blue', word: 'fixed, check it' },
  done: { tone: 'green', word: 'checked' },
}

export function GcPunchList({
  project,
  pkg,
  company,
  writes,
  busy = null,
}: {
  project: GcProject
  pkg: TradePackage
  company: string
  writes: PunchWrites
  /** What a press works on: an item's id, or the trade's while an item is added. */
  busy?: string | null
}) {
  const items = punchItems(project, pkg.id)
  const c = punchCounts(project, pkg.id)
  const canAdd = punchCanAdd(project, pkg)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [where, setWhere] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  if (items.length === 0 && !canAdd) return null
  const add = () => {
    writes.onAdd(pkg.id, { text: text.trim(), where: where.trim(), photoUrl: photoUrl.trim() })
    setText('')
    setWhere('')
    setPhotoUrl('')
  }
  return (
    <div data-punch-list={pkg.id} style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', display: 'grid', gap: '0.45rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>Punch list</strong>
        <span data-punch-count style={{ color: 'var(--text-muted)' }}>
          {items.length === 0 ? 'Nothing listed yet.' : c.open + c.fixed === 0 ? `All ${c.total} checked fixed.` : `${c.open + c.fixed} of ${c.total} still open.`}
        </span>
        {canAdd && !adding && (
          <Btn kind="quiet" onClick={() => setAdding(true)}>
            Add an item
          </Btn>
        )}
      </div>
      {items.map((item) => (
        <PunchRow key={item.id} item={item} company={company} writes={writes} busy={busy === item.id} />
      ))}
      {canAdd && adding && (
        <div data-punch-add style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim() && busy !== pkg.id) add()
            }}
            placeholder="What is left to fix"
            aria-label={`A punch item for ${company}`}
            style={{ ...input, flex: '2 1 14rem' }}
          />
          <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Where, like Grid C-4" aria-label="Where on the job" style={{ ...input, flex: '1 1 9rem' }} />
          <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="A photo's Drive link" aria-label="A photo's Drive link" style={{ ...input, flex: '1 1 11rem' }} />
          <Btn kind="primary" disabled={!text.trim() || busy === pkg.id} onClick={add}>
            Add to the punch list
          </Btn>
          <Btn kind="quiet" onClick={() => setAdding(false)}>
            Done adding
          </Btn>
        </div>
      )}
      {items.length > 0 && c.open + c.fixed > 0 && (
        <div data-punch-why style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {company} marks each item fixed in their portal, or tells us by phone. Our superintendent checks it on the job. We accept the work once every
          item is checked.
        </div>
      )}
    </div>
  )
}

function PunchRow({ item, company, writes, busy }: { item: PunchItem; company: string; writes: PunchWrites; busy: boolean }) {
  const st = punchState(item)
  const [back, setBack] = useState(false)
  const [note, setNote] = useState('')
  const [removing, setRemoving] = useState(false)
  // Only an item nothing was done on comes off: never fixed, checked or sent back (gc_remove_punch_item).
  const untouched = st === 'open' && !item.sentBack
  return (
    <div data-punch-item={item.id} data-punch-state={st} style={{ display: 'grid', gap: '0.25rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Chip tone={STATE_WORDS[st].tone}>{STATE_WORDS[st].word}</Chip>
        <span style={{ color: st === 'done' ? 'var(--text-muted)' : undefined }}>{item.text}</span>
        {item.where && <span style={{ color: 'var(--text-muted)' }}>{item.where}</span>}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {st === 'done' ? `checked ${shortDate(item.checkedOn)}` : st === 'fixed' ? `${company} fixed it ${shortDate(item.fixedOn)}` : `listed ${shortDate(item.addedOn)}`}
        </span>
      </div>
      {item.sentBack && st !== 'done' && (
        <div data-punch-back style={{ fontSize: '0.8rem', color: 'var(--text-amber-800)', paddingLeft: '0.2rem' }}>
          Sent back {item.sentBack.times === 1 ? 'once' : `${item.sentBack.times} times`}, last {shortDate(item.sentBack.on)}. {item.sentBack.note}
        </div>
      )}
      {st === 'open' && !removing && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn disabled={busy} onClick={() => writes.onFixedIn(item.id)}>
            They say it is fixed
          </Btn>
          {untouched && (
            <Btn kind="quiet" disabled={busy} onClick={() => setRemoving(true)}>
              Take it off
            </Btn>
          )}
        </div>
      )}
      {st === 'open' && removing && (
        <div data-punch-remove style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>
            Take “{item.text}” off the punch list? It stays in the record.
          </span>
          <Btn
            kind="primary"
            disabled={busy}
            onClick={() => {
              writes.onRemove(item.id)
              setRemoving(false)
            }}
          >
            Take it off
          </Btn>
          <Btn kind="quiet" onClick={() => setRemoving(false)}>
            Keep it
          </Btn>
        </div>
      )}
      {st === 'fixed' && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn kind="primary" disabled={busy} onClick={() => writes.onCheck(item.id, true)}>
            Checked, it is fixed
          </Btn>
          {back ? (
            <>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is still wrong" aria-label="What is still wrong" style={{ ...input, flex: '1 1 14rem' }} />
              <Btn
                disabled={!note.trim() || busy}
                onClick={() => {
                  writes.onCheck(item.id, false, note.trim())
                  setBack(false)
                  setNote('')
                }}
              >
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

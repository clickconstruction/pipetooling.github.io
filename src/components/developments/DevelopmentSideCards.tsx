/**
 * The Plans card and the Questions card (punch list #208, design spike). Plans: every set on the
 * site, newest first, who carries it, and the line naming the pieces on an older set or none with
 * **Ask the estimators about the N**. The Questions look moved to `DevelopmentQuestionsLook.tsx`
 * (v2.6214); `QuestionRow` stays here, the one row shared with a record's own log (`RecordQuestions.tsx`).
 */
import { requestIsOpen, type MemberRequest } from '../../lib/developments/overview'
import { planSetMemoWrite, plansNeedWords, type PlanCarrier, type PlanSet, type PlansView, plansAskLine, type PlansAsk } from '../../lib/developments/plans'
import { ageWords, Chip, LinkButton, shortDay, SmallButton } from './developmentPageBits'
import { useState } from 'react'

/**
 * A set's memo line (v2.6207, the owner: *a memo line … an agent could use to record what they think has
 * changed on the plans*): the words read in place; with a writer, a press opens a one-line box, Enter or
 * Save keeps it, Escape or Cancel leaves it. A set that hangs on jobs alone has no row to hold a memo.
 */
function PlanSetMemo({ set, write }: { set: PlanSet; write?: (set: PlanSet, memo: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(set.memo)
  const [busy, setBusy] = useState(false)
  const canWrite = !!write && planSetMemoWrite(set) !== null
  const keep = async () => {
    if (!write || busy) return
    setBusy(true)
    const ok = await write(set, draft.trim())
    setBusy(false)
    if (ok) setEditing(false)
  }
  if (editing && canWrite) {
    return (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', width: '100%', minWidth: 0 }} data-testid="plan-set-memo-edit">
        <input
          value={draft}
          autoFocus
          maxLength={2000}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void keep()
            } else if (e.key === 'Escape') {
              setDraft(set.memo)
              setEditing(false)
            }
          }}
          placeholder="What changed on the plans"
          aria-label="The set's memo"
          style={{ flex: 1, minWidth: 0, font: 'inherit', fontSize: '0.8rem', padding: '2px 6px', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
        />
        <SmallButton onClick={() => void keep()} primary disabled={busy} title="Keep the memo on this set">
          {busy ? 'Keeping…' : 'Save'}
        </SmallButton>
        <LinkButton
          onClick={() => {
            setDraft(set.memo)
            setEditing(false)
          }}
          nowrap
        >
          Cancel
        </LinkButton>
      </span>
    )
  }
  if (set.memo) {
    return canWrite ? (
      <button type="button" onClick={() => setEditing(true)} title="Change the memo" data-testid="plan-set-memo" style={{ font: 'inherit', fontSize: '0.82rem', color: 'inherit', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'text', borderBottom: '1px dotted var(--border-strong)' }}>
        {set.memo}
      </button>
    ) : (
      <span data-testid="plan-set-memo">{set.memo}</span>
    )
  }
  return canWrite ? (
    <LinkButton onClick={() => setEditing(true)} title="Write what changed on the plans in this set" nowrap>
      Add a memo
    </LinkButton>
  ) : (
    <span style={{ color: 'var(--text-faint)' }}>—</span>
  )
}

export function DevelopmentPlansCard({
  view,
  openCarrier,
  askAbout,
  askOnRecord,
  openQuestions,
  memoWriter,
}: {
  view: PlansView
  openCarrier: (c: PlanCarrier) => void
  /** Keeps a set's memo (v2.6207); absent for a reader who cannot write one. */
  memoWriter?: (set: PlanSet, memo: string) => Promise<boolean>
  /** The Plans question read back (PR 5): while it waits the line stands where the press was; answered, the words read under the chips. */
  askOnRecord?: PlansAsk | null
  openQuestions?: () => void
  askAbout: (count: number) => void
}) {
  const th: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }
  const td: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }
  // The pieces behind each chip (the owner, 2026-10-28: *do all 8*, item 3): a chip for those with no plans, one for those on an older set; a press opens the list.
  const [openChip, setOpenChip] = useState<'none' | 'older' | null>(null)
  const older = view.olderOrNone.filter((c) => !view.none.some((n) => n.kind === c.kind && n.id === c.id))
  const carriers = (list: PlanCarrier[]) => (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {list.map((c) => (
        <LinkButton key={`${c.kind}:${c.id}`} onClick={() => openCarrier(c)}>
          {c.label}
        </LinkButton>
      ))}
    </span>
  )
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {view.sets.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Set</th>
              <th style={th}>Dated</th>
              <th style={th}>Filed</th>
              <th style={th}>Memo</th>
              <th style={th}>On</th>
            </tr>
          </thead>
          <tbody>
            {view.sets.map((s, i) => (
              <tr key={s.key}>
                <td style={td}>
                  <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none', fontWeight: 600 }}>
                    Open the folder
                  </a>
                  {i === 0 ? (
                    <>
                      {' '}
                      <Chip label="newest" color="#3b82f6" soft />
                    </>
                  ) : null}
                </td>
                <td style={td}>{s.dated ? shortDay(s.dated) : <span style={{ color: 'var(--text-faint)' }}>no date filed</span>}</td>
                <td style={td}>
                  {s.filedAt ? shortDay(s.filedAt) : '—'}
                  {s.filedBy ? ` · ${s.filedBy}` : ''}
                </td>
                <td style={{ ...td, minWidth: 160 }}>
                  <PlanSetMemo set={s} write={memoWriter} />
                </td>
                <td style={td}>{carriers(s.carriers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {/* The pieces without the newest set, as chips that open their lists; the ask beside them. No sentence. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} data-testid="plans-chips" aria-label={plansNeedWords(view) ?? 'every job and bid on the newest set'}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{view.sets.length ? `${view.sets.length} ${view.sets.length === 1 ? 'set' : 'sets'}` : 'no set filed'}</span>
        {view.none.length > 0 ? (
          <button type="button" className={`developmentChipPress${openChip === 'none' ? ' isOn' : ''}`} aria-expanded={openChip === 'none'} onClick={() => setOpenChip((v) => (v === 'none' ? null : 'none'))} data-testid="plans-chip-none">
            {view.none.length} without plans <span aria-hidden>{openChip === 'none' ? '▾' : '▸'}</span>
          </button>
        ) : null}
        {older.length > 0 ? (
          <button type="button" className={`developmentChipPress${openChip === 'older' ? ' isOn' : ''}`} aria-expanded={openChip === 'older'} onClick={() => setOpenChip((v) => (v === 'older' ? null : 'older'))} data-testid="plans-chip-older">
            {older.length} on an older set <span aria-hidden>{openChip === 'older' ? '▾' : '▸'}</span>
          </button>
        ) : null}
        {view.none.length === 0 && older.length === 0 && view.sets.length > 0 ? <span className="developmentCountChip">every job and bid on the newest set</span> : null}
        {view.olderOrNone.length > 0 && !(askOnRecord && askOnRecord.open) ? (
          <span style={{ marginLeft: 'auto' }}>
            <SmallButton onClick={() => askAbout(view.olderOrNone.length)} title="Writes one question to the estimators about these jobs and bids; the answer reads back here">
              Ask the estimators about the {view.olderOrNone.length}
            </SmallButton>
          </span>
        ) : null}
        {askOnRecord && askOnRecord.open ? (
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-amber-800)', fontWeight: 600 }} data-testid="plans-ask-waiting">
            {openQuestions ? (
              <LinkButton onClick={openQuestions} title="The question, under Questions">
                {plansAskLine(askOnRecord, shortDay)} ›
              </LinkButton>
            ) : (
              plansAskLine(askOnRecord, shortDay)
            )}
          </span>
        ) : null}
      </div>
      {askOnRecord && !askOnRecord.open ? (
        <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="plans-ask-answered">
          <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{plansAskLine(askOnRecord, shortDay).split(' · ')[0]}</span>
          {' · '}
          {plansAskLine(askOnRecord, shortDay).split(' · ').slice(1).join(' · ')}
          {openQuestions ? (
            <>
              {' '}
              <LinkButton onClick={openQuestions}>Questions ›</LinkButton>
            </>
          ) : null}
        </div>
      ) : null}
      {openChip === 'none' && view.none.length > 0 ? (
        <div style={{ fontSize: '0.8rem' }} data-testid="plans-list-none">
          {carriers(view.none)}
        </div>
      ) : null}
      {openChip === 'older' && older.length > 0 ? (
        <div style={{ fontSize: '0.8rem' }} data-testid="plans-list-older">
          {carriers(older)}
        </div>
      ) : null}
    </div>
  )
}


/**
 * One question as the Questions card and a record's own log draw it (PR 4b): the day, the wait while
 * it is open, who asked whom, the piece it is about (a door when the caller gives one), the words,
 * every reply with its author, and the close note. `askedOn` marks a bid's question shown on the job
 * it became.
 */
export function QuestionRow({ request: r, names, about, askedOn }: { request: MemberRequest; names: ReadonlyMap<string, string>; about?: { label: string; onOpen: () => void } | null; askedOn?: string | null }) {
  const open = requestIsOpen(r)
  return (
    <div data-testid={`question-row-${r.id}`} data-open={open ? '1' : undefined} style={{ border: `1px solid ${open ? 'var(--bg-amber-200)' : 'var(--border)'}`, borderLeft: `4px solid ${open ? '#d97706' : '#059669'}`, borderRadius: 6, padding: '8px 10px', background: open ? 'var(--bg-amber-tint)' : 'var(--surface)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <span>{shortDay(r.created_at)}</span>
        {open ? <strong style={{ color: 'var(--text-amber-800)' }}>waiting · {ageWords(r.created_at)}</strong> : <span>asked</span>}
        <span>
          {names.get(r.from_user_id) ?? 'someone'} → {r.lane === 'dispatch' ? 'Dispatch' : 'the estimators'}
        </span>
        {about ? <LinkButton onClick={about.onOpen}>{about.label}</LinkButton> : null}
        {askedOn ? (
          <span style={{ fontStyle: 'italic' }} title="Asked on the bid this job came from" data-testid="question-asked-on">
            asked on {askedOn}
          </span>
        ) : null}
      </div>
      <div style={{ marginTop: 4, fontSize: '0.88rem', color: 'var(--text-strong)' }}>{r.title}</div>
      {r.notes.map((n) => (
        <div key={n.id} style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--bg-green-200)', fontSize: '0.84rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {names.get(n.author_user_id) ?? 'someone'} · {shortDay(n.created_at)}
          </span>
          <div>{n.body}</div>
        </div>
      ))}
      {r.closed_at && r.closed_note ? <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: '0.84rem', color: 'var(--text-muted)' }}>Closed · {r.closed_note}</div> : null}
    </div>
  )
}

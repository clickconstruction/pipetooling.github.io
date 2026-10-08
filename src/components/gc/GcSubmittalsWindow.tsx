import { useEffect, useState } from 'react'
import { Btn, Card, Chip, Why, input, type Tone } from './gcUi'
import { submittalCounts, submittalRows, type SubmittalRow, type SubmittalState } from '../../lib/gc/buildingSubmittals'
import { scheduleLinesOf } from '../../lib/gc/schedule/schedule'
import { SUBMITTAL_KINDS, submittalRoundKey, type SubmittalCameIn, type SubmittalDraft, type SubmittalRoundExtra } from '../../lib/gc/submittalRows'
import type { GcProject, GcState, SubmittalAnswer, SubmittalKind, TradePackage } from '../../lib/gc/types'
import { shortDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, the Building lane's U4b: the submittal register on real data, ported from the prototype's
 * `GcBuildingSubmittals.tsx` (branch spike/gc-mode; the plan: to-dos/gc-mode/mockups/building-u4.md). By trade: what
 * each sends for the architect's approval before its work, whose move it is, when it is needed. The office records a
 * round that came by email, sends it to the architect, and records the answer. The database's own functions check
 * every step (the Building lane's U4a); the window only carries the press. The trade's own round comes from its
 * portal with the Portal lane's P5.
 */

export interface SubmittalWrites {
  onAdd: (draft: SubmittalDraft) => void
  onCameIn: (cameIn: SubmittalCameIn) => void
  /** The newest round goes to the architect by email (gc-architect-email). */
  onSendToArchitect: (submittalId: string) => void
  /** It went to the architect some other way. */
  onMarkSent: (submittalId: string) => void
  onAnswer: (submittalId: string, answer: SubmittalAnswer, note: string) => void
}

/** Who can open a Drive link: anyone with it, only people given access, or unknown. */
export type LinkAccess = 'anyone' | 'restricted' | null

interface Props {
  /** The board with the submittals laid over it, and the schedule when it is drawn. */
  state: GcState
  project: GcProject
  /** What each round holds beside the kernel's shape: its Drive link and who sent it. */
  extras: Map<string, SubmittalRoundExtra>
  /** The sections each trade's own scope lines name, by trade id, for the section box. */
  sections?: Record<string, string[]>
  /** Reads who can open a Drive link, for the warning under it. Absent: no check. */
  checkLink?: (url: string) => Promise<LinkAccess>
  writes: SubmittalWrites
  /** The submittal a write is working on, or 'new' for one being added. */
  busy?: string | null
  problem?: string | null
  onClose: () => void
}

const STATE_WORDS: Record<SubmittalState, { tone: Tone; word: string }> = {
  trade: { tone: 'grey', word: 'waiting on them' },
  us: { tone: 'amber', word: 'waiting on us' },
  architect: { tone: 'blue', word: 'with the architect' },
  approved: { tone: 'green', word: 'approved' },
}

const ANSWER_WORDS: Record<SubmittalAnswer, string> = {
  approved: 'Approved',
  'approved as noted': 'Approved as noted',
  revise: 'Revise and resubmit',
}

export function GcSubmittalsWindow({ state, project, extras, sections = {}, checkLink, writes, busy, problem, onClose }: Props) {
  const rows = submittalRows(state, project)
  const c = submittalCounts(state, project)
  const trades = project.packages.filter((k) => !k.selfPerform && k.awardedInviteId)
  const architect = project.architect || 'the architect'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: submittals`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(860px, 100%)', maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · submittals</div>
            <div data-submittal-lede style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              What each trade sends {architect} to approve before its work.
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>

        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.9rem' }}>
          <Why>
            A trade sends product data, shop drawings or samples for the architect to approve before its work. We look, then send them on, and record
            the answer. A submittal holds the lines it covers on the schedule until it is approved.
          </Why>
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
              {problem}
            </div>
          )}
          {rows.length > 0 && (
            <Card>
              <div data-submittal-counts style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.875rem' }}>
                <strong>Submittals</strong>
                <Chip tone="grey">{c.trade} waiting on trades</Chip>
                <Chip tone="amber">{c.us} waiting on us</Chip>
                <Chip tone="blue">{c.architect} with the architect</Chip>
                <Chip tone="green">{c.approved} approved</Chip>
                {c.late > 0 && <Chip tone="red">{c.late} late</Chip>}
              </div>
            </Card>
          )}
          {trades.length === 0 && <Card>No trade is awarded yet. Submittals start once one is.</Card>}
          {trades.map((pkg) => (
            <TradeSubmittals
              key={pkg.id}
              project={project}
              pkg={pkg}
              rows={rows.filter((r) => r.submittal.packageId === pkg.id)}
              today={state.today}
              architect={architect}
              extras={extras}
              sections={sections[pkg.id] ?? []}
              checkLink={checkLink}
              writes={writes}
              busy={busy ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TradeSubmittals({
  project,
  pkg,
  rows,
  today,
  architect,
  extras,
  sections,
  checkLink,
  writes,
  busy,
}: {
  project: GcProject
  pkg: TradePackage
  rows: SubmittalRow[]
  today: string
  architect: string
  extras: Map<string, SubmittalRoundExtra>
  sections: string[]
  checkLink?: (url: string) => Promise<LinkAccess>
  writes: SubmittalWrites
  busy: string | null
}) {
  const [adding, setAdding] = useState(false)
  const company = rows[0]?.company ?? pkg.trade
  return (
    <Card>
      <div data-submittal-trade={pkg.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div>
          <strong>{pkg.trade}</strong>
          {rows.length > 0 && company !== pkg.trade && <span style={{ color: 'var(--text-muted)' }}> · {company}</span>}
        </div>
        {!adding && (
          <Btn kind="quiet" onClick={() => setAdding(true)} disabled={busy === 'new'}>
            Add a submittal
          </Btn>
        )}
      </div>
      {rows.length === 0 && !adding && <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>None asked for yet.</div>}
      <div style={{ display: 'grid', gap: '0.6rem', marginTop: rows.length > 0 ? '0.6rem' : 0 }}>
        {rows.map((r) => (
          <SubmittalLine key={r.submittal.id} row={r} today={today} architect={architect} extras={extras} checkLink={checkLink} writes={writes} busy={busy === r.submittal.id} />
        ))}
      </div>
      {adding && (
        <AddSubmittal
          project={project}
          pkg={pkg}
          sections={sections}
          busy={busy === 'new'}
          onAdd={(draft) => {
            writes.onAdd(draft)
            setAdding(false)
          }}
          onDone={() => setAdding(false)}
        />
      )}
    </Card>
  )
}

function SubmittalLine({
  row,
  today,
  architect,
  extras,
  checkLink,
  writes,
  busy,
}: {
  row: SubmittalRow
  today: string
  architect: string
  extras: Map<string, SubmittalRoundExtra>
  checkLink?: (url: string) => Promise<LinkAccess>
  writes: SubmittalWrites
  busy: boolean
}) {
  const s = row.submittal
  const [answering, setAnswering] = useState<SubmittalAnswer | null>(null)
  const [note, setNote] = useState('')
  const [cameIn, setCameIn] = useState(false)
  const late = row.state !== 'approved' && row.daysLate > 0
  const newest = s.rounds.length > 0 ? extras.get(submittalRoundKey(s.id, s.rounds.length)) : undefined
  return (
    <div data-submittal={s.id} data-submittal-state={row.state} style={{ display: 'grid', gap: '0.25rem', fontSize: '0.875rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <strong>{s.number}</strong>
        <span>
          {s.title} <span style={{ color: 'var(--text-muted)' }}>· {s.kind}</span>
        </span>
        <Chip tone={late ? 'red' : STATE_WORDS[row.state].tone}>{STATE_WORDS[row.state].word}</Chip>
        <span style={{ fontSize: '0.8rem', color: late ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
          {row.approvedOn
            ? `approved ${shortDate(row.approvedOn)}${row.daysLate > 0 ? `, ${row.daysLate} days after it was needed` : ''}`
            : row.neededBy
              ? `${row.neededBy === today ? 'needed today' : `needed by ${shortDate(row.neededBy)}`}${late ? `, ${row.daysLate} days late` : ''}`
              : 'no day needed yet'}
        </span>
      </div>
      {s.rounds.map((r, i) => {
        const extra = extras.get(submittalRoundKey(s.id, i + 1))
        return (
          <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {s.rounds.length > 1 ? `Round ${i + 1}: ` : ''}
            {extra?.sentBy === 'office' ? 'came by email' : 'sent'} {shortDate(r.sentOn)}, {r.file}
            {extra?.driveUrl && (
              <>
                {' '}
                <a href={extra.driveUrl} target="_blank" rel="noreferrer">
                  open the file
                </a>
              </>
            )}
            {r.note ? `. ${r.note.replace(/[.\s]+$/, '')}` : ''}
            {r.toArchitectOn ? `. To the architect ${shortDate(r.toArchitectOn)}` : ''}
            {r.answer && r.answeredOn ? `. ${r.answer === 'revise' ? 'Sent back to revise' : r.answer === 'approved as noted' ? 'Approved as noted' : 'Approved'} ${shortDate(r.answeredOn)}` : ''}
            {r.answerNote ? `: ${r.answerNote}` : '.'}
          </div>
        )
      })}
      {row.state === 'trade' && !cameIn && (
        <div>
          <Btn kind="plain" onClick={() => setCameIn(true)} disabled={busy}>
            It came by email
          </Btn>
        </div>
      )}
      {row.state === 'trade' && cameIn && (
        <CameInForm
          busy={busy}
          checkLink={checkLink}
          onRecord={(round) => {
            writes.onCameIn({ submittalId: s.id, ...round })
            setCameIn(false)
          }}
          onCancel={() => setCameIn(false)}
        />
      )}
      {row.state === 'us' && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn
            kind="primary"
            onClick={() => writes.onSendToArchitect(s.id)}
            disabled={busy || !newest?.driveUrl}
            title={newest?.driveUrl ? undefined : 'It came with no Drive link, so it cannot be emailed from here.'}
          >
            Send to {architect}
          </Btn>
          <Btn kind="quiet" onClick={() => writes.onMarkSent(s.id)} disabled={busy}>
            We sent it another way
          </Btn>
        </div>
      )}
      {row.state === 'architect' && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>The architect's answer:</span>
          {(['approved', 'approved as noted', 'revise'] as SubmittalAnswer[]).map((a) => (
            <Btn key={a} kind={answering === a ? 'primary' : 'quiet'} onClick={() => setAnswering(a)} disabled={busy}>
              {ANSWER_WORDS[a]}
            </Btn>
          ))}
        </div>
      )}
      {row.state === 'architect' && answering && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={answering === 'revise' ? 'What to change' : 'A note, if the architect made one'}
            aria-label="The architect's note"
            style={{ ...input, flex: '1 1 16rem' }}
          />
          <Btn
            kind="primary"
            disabled={busy || (answering === 'revise' && !note.trim())}
            title={answering === 'revise' && !note.trim() ? 'Say what to change first.' : undefined}
            onClick={() => {
              writes.onAnswer(s.id, answering, note)
              setAnswering(null)
              setNote('')
            }}
          >
            Record it
          </Btn>
        </div>
      )}
    </div>
  )
}

/** A round that came by email: the file's name, its Drive link and the trade's note (decision 6). */
function CameInForm({
  busy,
  checkLink,
  onRecord,
  onCancel,
}: {
  busy: boolean
  checkLink?: (url: string) => Promise<LinkAccess>
  onRecord: (round: { file: string; driveUrl?: string; note: string }) => void
  onCancel: () => void
}) {
  const [file, setFile] = useState('')
  const [link, setLink] = useState('')
  const [note, setNote] = useState('')
  const [access, setAccess] = useState<LinkAccess>(null)
  const check = (url: string) => {
    setAccess(null)
    if (!checkLink || !url.trim()) return
    void checkLink(url.trim())
      .then(setAccess)
      .catch(() => setAccess(null))
  }
  return (
    <div data-submittal-came-in style={{ display: 'grid', gap: '0.4rem', padding: '0.55rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={file} onChange={(e) => setFile(e.target.value)} placeholder="The file's name" aria-label="The file's name" style={{ ...input, flex: '1 1 12rem' }} />
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={(e) => check(e.target.value)}
          placeholder="Its Drive link"
          aria-label="Its Drive link"
          style={{ ...input, flex: '2 1 16rem' }}
        />
      </div>
      <div data-submittal-link-hint style={{ fontSize: '0.8rem', color: access === 'restricted' ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
        {access === 'restricted'
          ? 'Only people given access can open this link. The architect may not be one of them.'
          : 'With its Drive link, you can email it to the architect from here.'}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Their note, if they wrote one" aria-label="Their note" style={input} />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn
          kind="primary"
          disabled={busy || !file.trim()}
          title={file.trim() ? undefined : 'Name the file first.'}
          onClick={() => onRecord({ file, ...(link.trim() ? { driveUrl: link } : {}), note })}
        >
          Record it
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}

function AddSubmittal({
  project,
  pkg,
  sections,
  busy,
  onAdd,
  onDone,
}: {
  project: GcProject
  pkg: TradePackage
  sections: string[]
  busy: boolean
  onAdd: (draft: SubmittalDraft) => void
  onDone: () => void
}) {
  const lines = scheduleLinesOf(pkg)
  const onSchedule = new Set((project.schedule?.activities ?? []).map((a) => a.lineId))
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<SubmittalKind>('product data')
  const [section, setSection] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [lead, setLead] = useState(14)
  const [neededBy, setNeededBy] = useState('')
  // Its day comes from the schedule when the work it holds is drawn; otherwise the office gives one.
  const needsDay = !picked.some((id) => onSchedule.has(id))
  const label = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' } as const
  const listId = `gc-submittal-sections-${pkg.id}`
  return (
    <div data-submittal-add style={{ marginTop: '0.6rem', padding: '0.65rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What it covers, like Rooftop units" aria-label="What the submittal covers" style={{ ...input, flex: '2 1 14rem' }} />
        <select value={kind} onChange={(e) => setKind(e.target.value as SubmittalKind)} style={input} aria-label="Kind">
          {SUBMITTAL_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          value={section}
          onChange={(e) => setSection(e.target.value)}
          placeholder="Spec section, like 23 81 19"
          aria-label="Spec section"
          list={sections.length > 0 ? listId : undefined}
          style={{ ...input, flex: '1 1 9rem' }}
        />
        {sections.length > 0 && (
          <datalist id={listId}>
            {sections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>
      <div style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={label}>The work it holds on the schedule until approved</span>
        <div style={{ display: 'flex', gap: '0.2rem 0.9rem', flexWrap: 'wrap' }}>
          {lines.map((l) => (
            <label key={l.lineId} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <input type="checkbox" checked={picked.includes(l.lineId)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, l.lineId] : x.filter((id) => id !== l.lineId)))} />
              <span>{l.label}</span>
            </label>
          ))}
        </div>
      </div>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={label}>Days from approval to on site</span>
        <input type="number" min={0} value={lead} onChange={(e) => setLead(Math.max(0, Number(e.target.value) || 0))} style={{ ...input, width: '5rem' }} />
        <span style={{ color: 'var(--text-muted)' }}>It is needed by the first start of that work, less these days.</span>
      </label>
      {needsDay && (
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={label}>Needed by</span>
          <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} aria-label="Needed by" style={input} />
          <span style={{ color: 'var(--text-muted)' }}>None of the work it holds is on the schedule yet.</span>
        </label>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn
          kind="primary"
          disabled={busy || !title.trim()}
          onClick={() =>
            onAdd({
              packageId: pkg.id,
              title,
              kind,
              ...(section.trim() ? { specSection: section } : {}),
              lineIds: picked,
              leadDays: lead,
              ...(needsDay && neededBy ? { neededBy } : {}),
            })
          }
        >
          Add submittal
        </Btn>
        <Btn kind="quiet" onClick={onDone}>
          Done adding
        </Btn>
      </div>
    </div>
  )
}

import { useState, type CSSProperties } from 'react'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { STATEMENT_SEND_CHANNELS, TEMPERATURES, type StatementSendChannel, type Temperature } from '../../lib/jobs/gcStatementRounds'
import { payPromiseLabel } from '../../lib/jobs/payPromise'
import GcBillLines from './GcBillLines'
import {
  EMPTY_CALL_SHEET_DRAFT,
  callSheetAnswers,
  callSheetBillsLabel,
  callSheetBillsSummary,
  callSheetDraftIsEmpty,
  type CallSheet,
  type CallSheetAnswer,
  type CallSheetDraft,
} from '../../lib/jobs/gcCallSheet'

type Props = {
  sheet: CallSheet
  /** The account man the sheet is for; null when nobody is set on these GCs. */
  ownerName: string | null
  actorId: string
  actorName: string
  /** People the word could have come from. */
  wordSources: ReadonlyArray<{ id: string; name: string }>
  /** His answers from the ask-by-link page, to read, change and save. Opens the sheet in review. */
  initialDrafts?: Readonly<Record<string, CallSheetDraft>>
  /** Today in the company calendar — a bill's promised date before it reads late. */
  todayYmd?: string
  /** A bill's job link: Job Detail on top, the sheet and what was typed kept under it. */
  onOpenJobDetail?: (jobId: string) => void
  busy: boolean
  error: string | null
  onSave: (answers: CallSheetAnswer[], word: { wordFrom: { userId: string; name: string }; heardVia: WordHeardVia | null }) => void
  onPrint: () => void
  onClose: () => void
}

const TEMP_TONE: Record<Temperature, { bg: string; fg: string; border: string }> = {
  hot: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)', border: 'var(--border-green)' },
  warm: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', border: 'var(--border-amber)' },
  cool: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)', border: 'var(--border-blue)' },
  cold: { bg: 'var(--bg-orange-tint)', fg: 'var(--text-red-700)', border: '#fecaca' },
}

/** How the word reached the person typing: one of the channels, or the ask-by-link page. */
export type WordHeardVia = StatementSendChannel | 'link'

const fieldStyle: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)' }

/**
 * The call sheet: one account man's GCs, answers typed as he gives them, one
 * save. A row left untouched is not saved; a row started must carry a read
 * and a sentence, the same bar the mark form sets. Each GC's total opens onto
 * the bills behind it — the job, its age, what is owed, the date it was
 * promised — and each bill onto its recent activity or the job itself.
 */
export default function GcCallSheetModal({ sheet, ownerName, actorId, actorName, wordSources, initialDrafts, todayYmd, onOpenJobDetail, busy, error, onSave, onPrint, onClose }: Props) {
  const fromLink = initialDrafts != null && Object.keys(initialDrafts).length > 0
  const [drafts, setDrafts] = useState<Record<string, CallSheetDraft>>(() => ({ ...(initialDrafts ?? {}) }))
  const [sourceId, setSourceId] = useState<string>(() => (sheet.ownerUserId && wordSources.some((u) => u.id === sheet.ownerUserId) ? sheet.ownerUserId : actorId))
  const [heardVia, setHeardVia] = useState<WordHeardVia>(fromLink ? 'link' : 'call')
  const [problems, setProblems] = useState<Record<string, string>>({})
  /** The GCs whose bills are open under their total. */
  const [billsOpen, setBillsOpen] = useState<ReadonlySet<string>>(new Set())
  const withBills = sheet.rows.filter((r) => (r.bills?.length ?? 0) + (r.collections?.length ?? 0) > 0)
  const allBillsOpen = withBills.length > 0 && withBills.every((r) => billsOpen.has(r.gcId))
  const toggleBills = (gcId: string) =>
    setBillsOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(gcId)) next.add(gcId)
      return next
    })

  const source = wordSources.find((u) => u.id === sourceId) ?? { id: actorId, name: actorName }
  const fromSomeoneElse = source.id !== actorId
  const sourceFirstName = source.name.split(/\s+/)[0] || 'them'
  const draftOf = (gcId: string) => drafts[gcId] ?? EMPTY_CALL_SHEET_DRAFT
  const setDraft = (gcId: string, patch: Partial<CallSheetDraft>) => {
    setDrafts((prev) => ({ ...prev, [gcId]: { ...(prev[gcId] ?? EMPTY_CALL_SHEET_DRAFT), ...patch } }))
    setProblems((prev) => {
      if (!(gcId in prev)) return prev
      const next = { ...prev }
      delete next[gcId]
      return next
    })
  }
  const started = sheet.rows.filter((r) => !callSheetDraftIsEmpty(draftOf(r.gcId))).length

  const save = () => {
    if (busy) return
    // The mark's own channel has no "link": a word that came by the link is filed under "other", and says "link" as how it was heard.
    const channel: StatementSendChannel = heardVia === 'link' ? 'other' : !fromSomeoneElse && heardVia === 'email' ? 'call' : heardVia
    const out = callSheetAnswers(sheet, drafts, channel)
    setProblems(out.problems)
    if (Object.keys(out.problems).length > 0 || out.answers.length === 0) return
    onSave(out.answers, { wordFrom: { userId: source.id, name: source.name }, heardVia: fromSomeoneElse ? heardVia : null })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Call sheet${ownerName ? ` — ${ownerName}` : ''}`}
      onClick={() => (busy ? undefined : onClose())}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 64 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(760px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
      >
        <div style={{ padding: '0.85rem 1.1rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700 }}>Call sheet{ownerName ? ` — ${ownerName}` : ''}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {sheet.rows.length} GC{sheet.rows.length === 1 ? '' : 's'} · ${formatCurrency(sheet.total)}
            </span>
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close the call sheet" style={{ marginLeft: 'auto', border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
              ✕
            </button>
          </div>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 20rem', minWidth: 0 }}>
              {fromLink
                ? `${sourceFirstName} answered these on his link. Read them, change what needs changing, and save — nothing is on the record until you do.`
                : `One call. Fill a row as ${fromSomeoneElse ? sourceFirstName : 'you go'} answers — a row you leave blank is left alone.`}
            </span>
            {withBills.length > 0 ? (
              <button
                type="button"
                onClick={() => setBillsOpen(allBillsOpen ? new Set() : new Set(withBills.map((r) => r.gcId)))}
                style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {allBillsOpen ? 'Hide all bills' : 'Show all bills'}
              </button>
            ) : null}
          </p>
        </div>

        <div style={{ overflowY: 'auto', padding: '0.2rem 1.1rem' }}>
          {sheet.rows.map((r) => {
            const d = draftOf(r.gcId)
            const problem = problems[r.gcId]
            const bills = r.bills ?? []
            const collections = r.collections ?? []
            const open = billsOpen.has(r.gcId)
            return (
              <div key={r.gcId} data-testid="gc-call-sheet-row" style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                  <b>{r.gcName}</b>
                  <span style={{ color: 'var(--text-muted)' }}>
                    ${formatCurrency(r.amount)}
                    {r.oldestAgeDays != null ? ` · oldest ${r.oldestAgeDays}d` : ''}
                  </span>
                  {r.promise ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: r.promise.late ? 'var(--text-red-700)' : 'var(--text-green-800)' }}>{payPromiseLabel(r.promise)}</span>
                  ) : null}
                  {r.wordIn ? <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-green-800)' }}>✓ word in this week</span> : null}
                </div>
                {bills.length + collections.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleBills(r.gcId)}
                    aria-expanded={open}
                    aria-label={`${open ? 'Hide' : 'Show'} ${r.gcName}’s bills`}
                    title={`The bills that make up ${r.gcName}’s $${formatCurrency(r.amount)}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', margin: '0.15rem 0 0', padding: 0, border: 'none', background: 'none', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span aria-hidden style={{ display: 'inline-block', width: '0.7rem' }}>
                      {open ? '▾' : '▸'}
                    </span>
                    {callSheetBillsLabel(callSheetBillsSummary(bills), (n) => `$${formatCurrency(n)}`)}
                    {collections.length > 0 ? ` · ${collections.length} more in Collections` : ''}
                  </button>
                ) : null}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.1rem 0 0.4rem' }}>
                  {r.lastWord
                    ? `Last word ${new Date(r.lastWord.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${r.lastWord.temperature ? ` · ${r.lastWord.temperature}` : ''} · ${r.lastWord.by} · “${r.lastWord.note.length > 110 ? `${r.lastWord.note.slice(0, 110)}…` : r.lastWord.note}”`
                    : 'No word yet'}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span role="radiogroup" aria-label={`Temperature for ${r.gcName}`} style={{ display: 'inline-flex', gap: '0.2rem' }}>
                    {TEMPERATURES.map((t) => {
                      const on = !d.noChange && d.temperature === t.value
                      const tone = TEMP_TONE[t.value]
                      return (
                        <button
                          key={t.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={d.noChange}
                          title={t.hint}
                          onClick={() => setDraft(r.gcId, { temperature: on ? null : t.value })}
                          style={{
                            font: 'inherit',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: 5,
                            border: on ? `1px solid ${tone.border}` : '1px solid var(--border-strong)',
                            background: on ? tone.bg : 'var(--surface)',
                            color: on ? tone.fg : 'var(--text-muted)',
                            cursor: d.noChange ? 'default' : 'pointer',
                            opacity: d.noChange ? 0.5 : 1,
                          }}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </span>
                  <input
                    type="text"
                    value={d.noChange ? '' : d.note}
                    disabled={d.noChange}
                    maxLength={600}
                    onChange={(e) => setDraft(r.gcId, { note: e.target.value })}
                    placeholder={d.noChange ? 'No change — repeats the last word' : fromSomeoneElse ? `What did ${sourceFirstName} say?` : 'What did they say?'}
                    aria-label={`What was said about ${r.gcName}`}
                    style={{ ...fieldStyle, flex: '1 1 220px', minWidth: 0 }}
                  />
                  <input
                    type="date"
                    value={d.payBy}
                    onChange={(e) => setDraft(r.gcId, { payBy: e.target.value })}
                    aria-label={`${r.gcName} expects to pay by`}
                    title="The date they said they’d pay"
                    style={fieldStyle}
                  />
                  {r.noChangeAllowed ? (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer' }} title="Repeats the last read and its pay date. Allowed once — the next word needs a fresh sentence.">
                      <input type="checkbox" checked={d.noChange} onChange={(e) => setDraft(r.gcId, { noChange: e.target.checked })} style={{ margin: 0 }} />
                      no change
                    </label>
                  ) : null}
                </div>
                {problem ? <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{problem}</p> : null}
                {/* Under the answer, so what she types stays in view while she reads the bills. */}
                {open ? (
                  <div data-testid="gc-call-sheet-bills" style={{ margin: '0.55rem 0 0.2rem' }}>
                    <GcBillLines rows={bills} onOpenJobDetail={onOpenJobDetail} showCustomer compact todayYmd={todayYmd} />
                    {bills.length > 0 ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', padding: '0.3rem 2.35rem 0 0.6rem', fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        <span>
                          {bills.length} bill{bills.length === 1 ? '' : 's'} — what {r.gcName} owes
                        </span>
                        <span>${formatCurrency(callSheetBillsSummary(bills).total)}</span>
                      </div>
                    ) : null}
                    {collections.length > 0 ? (
                      <>
                        <p style={{ margin: '0.5rem 0 0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <b style={{ color: 'var(--text-red-700)' }}>In Collections</b> — owed too, and not in the ${formatCurrency(r.amount)} above: ${formatCurrency(callSheetBillsSummary(collections).total)}
                        </p>
                        <GcBillLines rows={collections} onOpenJobDetail={onOpenJobDetail} showCustomer compact todayYmd={todayYmd} />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div style={{ padding: '0.6rem 1.1rem 0.8rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', borderRadius: '0 0 10px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
            <label htmlFor="gc-call-sheet-from" style={{ fontWeight: 700 }}>
              Whose word
            </label>
            <select id="gc-call-sheet-from" value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={{ ...fieldStyle, fontSize: '0.78rem' }}>
              {wordSources.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id === actorId ? 'Mine — I talked to them' : `${u.name}${u.id === sheet.ownerUserId ? ' · account man' : ''}`}
                </option>
              ))}
            </select>
            <span style={{ color: 'var(--text-muted)' }}>{fromSomeoneElse ? 'heard by' : 'reached them by'}</span>
            <span role="radiogroup" aria-label={fromSomeoneElse ? 'How you heard it' : 'How you reached them'} style={{ display: 'inline-flex', gap: '0.2rem', flexWrap: 'wrap' }}>
              {[...STATEMENT_SEND_CHANNELS.filter((c) => fromSomeoneElse || c.value !== 'email'), ...(fromLink && fromSomeoneElse ? [{ value: 'link' as const, label: 'His link' }] : [])].map((c) => {
                const on = c.value === heardVia
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setHeardVia(c.value)}
                    style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: on ? 700 : 500, padding: '0.12rem 0.5rem', borderRadius: 999, border: on ? '1px solid var(--text-blue-700)' : '1px solid var(--border-strong)', background: on ? 'var(--bg-blue-100)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', cursor: 'pointer' }}
                  >
                    {c.label}
                  </button>
                )
              })}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {fromSomeoneElse ? `Stamps ${source.name}’s word — entered by ${actorName || 'you'}.` : `Stamps ${actorName || 'you'}.`} Does not mark a statement sent.
            </span>
            <button type="button" onClick={onPrint} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}>
              <span aria-hidden>🖨</span> Print sheet
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || started === 0}
              style={{ padding: '0.3rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, border: 'none', borderRadius: 4, background: '#2563eb', color: '#ffffff', cursor: busy || started === 0 ? 'default' : 'pointer', opacity: busy || started === 0 ? 0.55 : 1 }}
            >
              {busy ? 'Saving…' : started === 0 ? 'Save answers' : `Save ${started} answer${started === 1 ? '' : 's'}`}
            </button>
          </div>
          {error ? <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{error}</p> : null}
        </div>
      </div>
    </div>
  )
}

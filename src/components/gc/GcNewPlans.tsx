import { useEffect, useMemo, useState, type Dispatch } from 'react'
import {
  currentRev,
  packagesForSheets,
  planEmail,
  planLabel,
  planRecipients,
  sheetsInText,
  type GcAction,
  type GcProject,
  type GcState,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'

/**
 * GC mode design spike: a new set of plans came in. Three steps on one page, each feeding the
 * next. 1: paste what we noticed, and the sheets and trades are read out of it. 2: who hears
 * about it (every company bidding while we bid, only the companies on the job once it is ours).
 * 3: the email each one gets, in two versions: it changes your trade, or it does not. Nothing is
 * really sent from the prototype. The real build sends through the app's own email.
 */

interface Props {
  state: GcState
  project: GcProject
  dispatch: Dispatch<GcAction>
  onClose: () => void
}

function StepHeading({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
      <span
        style={{
          display: 'inline-flex',
          width: '1.5rem',
          height: '1.5rem',
          borderRadius: '50%',
          background: '#2563eb',
          color: 'white',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '0.85rem',
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      <strong>{title}</strong>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{hint}</span>
    </div>
  )
}

export function GcNewPlansWindow({ state, project, dispatch, onClose }: Props) {
  const label = `Addendum ${currentRev(project) + 1}`
  const [note, setNote] = useState('')
  /** Null: follow what the notes say. A list: the office has taken over. */
  const [sheetText, setSheetText] = useState<string | null>(null)
  const [touchOverride, setTouchOverride] = useState<string[] | null>(null)
  const [skipped, setSkipped] = useState<string[]>([])
  const [previewId, setPreviewId] = useState<string | null>(null)

  const sheets = useMemo(
    () => (sheetText === null ? sheetsInText(note) : sheetText.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean)),
    [note, sheetText],
  )
  const touches = touchOverride ?? packagesForSheets(project, sheets)
  const everyone = planRecipients(state, project, touches)
  const going = everyone.filter((r) => !skipped.includes(r.partner.id))
  const companies = new Set(going.map((r) => r.partner.id)).size
  const ours = project.packages.filter((p) => p.selfPerform && touches.includes(p.id))
  const preview = going.find((r) => r.partner.id === previewId) ?? going.find((r) => r.touched) ?? going[0] ?? null
  const email = planEmail(project, label, note.trim(), sheets, preview)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: a new set of plans`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(1040px, 100%)',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-strong)',
        }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · a new set of plans came in</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              This becomes <strong>{label}</strong>. It replaces {planLabel(project, currentRev(project))} in every portal.
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '0.9rem 1rem', overflowY: 'auto', display: 'grid', gap: '1.1rem' }}>
          <section>
            <StepHeading n={1} title="What we noticed" hint="Paste or type what is different. Sheet numbers are read out of it." />
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              placeholder={'For example:\nE-201: two more floor boxes in bay 2.\nM-101: RTU-3 moved 6 ft north. Curb detail changed on A-401.'}
              style={{ ...input, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.5rem', fontSize: '0.875rem' }}>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                Sheets that changed
                <input
                  style={{ ...input, flex: '1 1 14rem' }}
                  value={sheetText ?? sheets.join(', ')}
                  onChange={(e) => setSheetText(e.target.value)}
                  placeholder="None found yet. Type them, like A-201, S-101"
                />
                {sheetText !== null && <Btn kind="quiet" onClick={() => setSheetText(null)}>Read them from the notes again</Btn>}
              </label>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                Trades it changes
                {project.packages.map((p) => (
                  <label key={p.id} style={{ whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={touches.includes(p.id)}
                      onChange={(e) => setTouchOverride(e.target.checked ? [...touches, p.id] : touches.filter((t) => t !== p.id))}
                    />{' '}
                    {p.trade}
                  </label>
                ))}
                {touchOverride !== null && <Btn kind="quiet" onClick={() => setTouchOverride(null)}>Guess from the sheets again</Btn>}
              </div>
              {touchOverride === null && sheets.length > 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  The trades are a guess from the sheet letters. Tick or untick to fix it.
                </span>
              )}
              {ours.length > 0 && (
                <div style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-violet-100)', color: 'var(--text-violet-800)', borderRadius: 6 }}>
                  This changes {ours.map((p) => p.trade.toLowerCase()).join(' and ')}, which is ours. Check {ours.map((p) => p.selfPerform?.ref).join(', ')} against the new set.
                </div>
              )}
            </div>
          </section>

          <section>
            <StepHeading
              n={2}
              title="Who hears about it"
              hint={
                project.stage === 'pursuing'
                  ? 'We are still bidding, so every company bidding gets it.'
                  : 'The job is ours, so only the company on each trade gets it.'
              }
            />
            {everyone.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No company is on this project yet. The set still replaces the old one.</div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {everyone.map((r) => {
                  const on = !skipped.includes(r.partner.id)
                  return (
                    <label
                      key={r.invite.id}
                      style={{
                        display: 'flex',
                        gap: '0.6rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        padding: '0.4rem 0.7rem',
                        borderBottom: '1px solid var(--border)',
                        background: r.touched ? 'var(--bg-amber-tint)' : undefined,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => setSkipped(e.target.checked ? skipped.filter((x) => x !== r.partner.id) : [...skipped, r.partner.id])}
                      />
                      <strong>{r.partner.company}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>{r.pkg.trade}</span>
                      {r.touched ? (
                        <Chip tone="amber">{r.hasBid ? 'changes their trade · asked to confirm their number' : 'changes their trade'}</Chip>
                      ) : (
                        <Chip tone="grey">no change to their trade · for their records</Chip>
                      )}
                      <span style={{ flex: 1 }} />
                      {on && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            setPreviewId(r.partner.id)
                          }}
                          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer' }}
                        >
                          {preview?.partner.id === r.partner.id ? 'shown below' : 'See their email'}
                        </button>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <StepHeading n={3} title="The email" hint={preview ? `As ${preview.partner.company} gets it.` : 'No one to email.'} />
            <div data-theme="light" style={{ border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-base)', padding: '0.8rem 1rem', fontSize: '0.9rem', display: 'grid', gap: '0.5rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                To: {preview ? `${preview.partner.contact}, ${preview.partner.company}` : 'no one'} · From: Click Construction
              </div>
              <div style={{ fontWeight: 700 }}>{email.subject}</div>
              {email.body.map((line, i) => (
                <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{line}</div>
              ))}
              <div>
                <span style={{ display: 'inline-block', padding: '0.4rem 0.9rem', borderRadius: 6, background: '#2563eb', color: 'white', fontWeight: 600 }}>Open the plans</span>
              </div>
            </div>
          </section>
        </div>

        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-600)' }}>
            {companies === 0
              ? 'No email goes out.'
              : `${companies} ${companies === 1 ? 'company gets' : 'companies get'} an email. ${going.filter((r) => r.touched).length} are told it changes their trade.`}
          </span>
          <span style={{ flex: 1 }} />
          <Btn kind="quiet" onClick={onClose}>Cancel</Btn>
          <Btn
            kind="primary"
            disabled={note.trim() === ''}
            title={note.trim() === '' ? 'Say what changed first.' : undefined}
            onClick={() => {
              dispatch({
                type: 'issueAddendum',
                projectId: project.id,
                note: note.trim(),
                sheets,
                touches,
                recipients: going.map((r) => r.partner.id),
              })
              onClose()
            }}
          >
            Issue {label}{companies > 0 ? ` and email ${companies}` : ''}
          </Btn>
        </div>
      </div>
    </div>
  )
}

/**
 * A sub's company's paper window on People → Contracts (punch list #403, step 6, PR 2). One window, two kinds:
 *
 *   - **Send for signature**: a subs' paper from the Contract Book, who signs (a worker, the owner first) and their
 *     email. The paper goes out under the name a sub knows, to the people at the company who get its contracts, the
 *     signer among them.
 *   - **Enter from paper**: the same paper, who signed, their title, the day, and a link to the scan.
 *
 * A paper the company has signed is listed and held, with its reason. The rules and words are
 * `src/lib/people/subCompanyPapers.ts`; the calls are `subCompanyPapersIo.ts`.
 */
import { useEffect, useMemo, useState } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useToastContext } from '../../contexts/ToastContext'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import type { CompanyGroup } from '../../lib/people/subCompanies'
import {
  COMPANY_PAPER_WORDS,
  companyEntryRefusal,
  companyPaperChoices,
  companySendRefusal,
  defaultSigner,
  workerEmail,
  type BookEntryChoice,
  type CompanyPaperRow,
} from '../../lib/people/subCompanyPapers'
import { enterCompanyPaperFromPaper, sendCompanyPaperFromPeople } from '../../lib/people/subCompanyPapersIo'

export type SubCompanyPaperWindowProps = {
  kind: 'send' | 'enter'
  group: CompanyGroup
  papers: readonly CompanyPaperRow[]
  bookEntries: readonly BookEntryChoice[]
  roster: ReadonlyArray<{ name: string | null; email: string | null }>
  onClose: () => void
  onDone: () => void
}

const field = { display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', fontWeight: 400, fontFamily: 'inherit', fontSize: '0.9375rem' } as const
const label = { display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' } as const

export function SubCompanyPaperWindow({ kind, group, papers, bookEntries, roster, onClose, onDone }: SubCompanyPaperWindowProps) {
  const { showToast } = useToastContext()
  useBodyScrollLock(true)
  const choices = useMemo(() => companyPaperChoices(bookEntries, papers), [bookEntries, papers])
  const firstReady = choices.find((c) => !c.held) ?? null
  const opener = defaultSigner(group.workers)
  const [choiceId, setChoiceId] = useState(firstReady?.id ?? '')
  const [signer, setSigner] = useState(opener?.name ?? '')
  const [title, setTitle] = useState(opener?.title ?? '')
  const [email, setEmail] = useState(opener ? workerEmail(opener.name, roster) : '')
  const [signedOn, setSignedOn] = useState(() => todayYmdInAppTz())
  const [link, setLink] = useState('')
  const [why, setWhy] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const choice = choices.find((c) => c.id === choiceId) ?? null
  const heading = kind === 'send' ? COMPANY_PAPER_WORDS.send : COMPANY_PAPER_WORDS.enter

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || busy) return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  /** A worker picked from the list: their title and their roster address come with them. */
  const pickWorker = (name: string) => {
    setSigner(name)
    const w = group.workers.find((x) => x.name === name)
    if (w) {
      setTitle(w.title)
      setEmail(workerEmail(w.name, roster))
    }
    setWhy(null)
  }

  async function go() {
    if (busy) return
    const refusal =
      kind === 'send'
        ? companySendRefusal({ choice, signer, email })
        : companyEntryRefusal({ choice, signer, signedOn, today: todayYmdInAppTz() })
    if (refusal || !choice) {
      setWhy(refusal ?? COMPANY_PAPER_WORDS.pickPaper)
      return
    }
    setBusy(true)
    setWhy(null)
    const outcome =
      kind === 'send'
        ? await sendCompanyPaperFromPeople({ company: group.company, bookEntryId: choice.id, paper: choice.name, signer: { name: signer, title, email } })
        : await enterCompanyPaperFromPaper({ companyId: group.company.id, bookEntryId: choice.id, signer: { name: signer, title }, signedOn, link })
    setBusy(false)
    if (!outcome.ok) {
      setWhy(outcome.why)
      return
    }
    showToast(outcome.words, 'success')
    onDone()
  }

  const workerNames = group.workers.map((w) => w.name)
  const typedSigner = signer.trim() !== '' && !workerNames.includes(signer)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 714, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        data-sub-company-paper-window={kind}
        style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: 8, width: 'min(560px, 92vw)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxSizing: 'border-box' }}
      >
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem' }}>{heading}</h3>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{group.company.name}</p>

        <label style={label}>
          <span style={{ fontWeight: 600 }}>Paper</span>
          <select aria-label="Paper" value={choiceId} disabled={busy} onChange={(e) => (setChoiceId(e.target.value), setWhy(null))} style={field}>
            {choiceId === '' ? <option value="">Pick a paper</option> : null}
            {choices.map((c) => (
              <option key={c.id} value={c.id} disabled={Boolean(c.held)}>
                {c.held ? `${c.name}, ${c.held}` : c.name}
              </option>
            ))}
          </select>
        </label>

        <label style={label}>
          <span style={{ fontWeight: 600 }}>{kind === 'send' ? 'Who signs' : 'Who signed'}</span>
          <select aria-label={kind === 'send' ? 'Who signs' : 'Who signed'} value={typedSigner ? '' : signer} disabled={busy} onChange={(e) => pickWorker(e.target.value)} style={field}>
            {group.workers.map((w) => (
              <option key={w.personId} value={w.name}>
                {w.title ? `${w.name}, ${w.title}` : w.name}
              </option>
            ))}
            <option value="">Someone else</option>
          </select>
        </label>
        {signer === '' || typedSigner ? (
          <label style={label}>
            <span style={{ fontWeight: 600 }}>Their name</span>
            <input aria-label="Their name" value={signer} disabled={busy} onChange={(e) => (setSigner(e.target.value), setWhy(null))} style={field} />
          </label>
        ) : null}
        <label style={label}>
          <span style={{ fontWeight: 600 }}>Title</span> <span style={{ color: 'var(--text-muted)' }}>optional</span>
          <input aria-label="Title" value={title} disabled={busy} placeholder="Owner" onChange={(e) => setTitle(e.target.value)} style={field} />
        </label>

        {kind === 'send' ? (
          <label style={label}>
            <span style={{ fontWeight: 600 }}>Their email</span>
            <input aria-label="Their email" type="email" value={email} disabled={busy} onChange={(e) => (setEmail(e.target.value), setWhy(null))} style={field} />
          </label>
        ) : (
          <>
            <label style={label}>
              <span style={{ fontWeight: 600 }}>Day they signed</span>
              <input aria-label="Day they signed" type="date" value={signedOn} max={todayYmdInAppTz()} disabled={busy} onChange={(e) => (setSignedOn(e.target.value), setWhy(null))} style={field} />
            </label>
            <label style={label}>
              <span style={{ fontWeight: 600 }}>Link to the scan</span> <span style={{ color: 'var(--text-muted)' }}>optional</span>
              <input aria-label="Link to the scan" type="url" value={link} disabled={busy} placeholder="https://" onChange={(e) => setLink(e.target.value)} style={field} />
            </label>
          </>
        )}

        <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {kind === 'send'
            ? `The paper says ${signer.trim() || 'the signer'}${title.trim() ? `, ${title.trim()}` : ''}, ${COMPANY_PAPER_WORDS.signingFor(group.company.name)}. It goes to everyone at the company who gets its contracts.`
            : `The paper is kept as signed by ${signer.trim() || 'the signer'}, ${COMPANY_PAPER_WORDS.signingFor(group.company.name)}.`}
        </p>
        {why ? (
          <p role="alert" style={{ margin: '0.5rem 0 0', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
            {why}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '1rem' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ padding: '0.5rem 0.9rem', minHeight: 44, border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void go()}
            disabled={busy}
            aria-busy={busy || undefined}
            style={{ padding: '0.5rem 0.9rem', minHeight: 44, border: 'none', borderRadius: 4, background: busy ? DEAD_PRESS_FILL : '#2563eb', color: busy ? DEAD_PRESS_TEXT : '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            {busy ? (kind === 'send' ? 'Sending…' : 'Entering…') : kind === 'send' ? 'Send email' : 'Enter as signed'}
          </button>
        </div>
      </div>
    </div>
  )
}

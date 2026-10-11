import { useState, type ReactNode } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { aYearFrom, portalInsurance, portalPapers, portalVetting, type PortalPaper } from '../../lib/gc/portal'
import { pDate } from '../../lib/gc/portalI18n'
import { portalCoiUpload, type PickedFile } from '../../lib/gc/tradePortalFile'
import type { PaperworkLine } from '../../lib/gc/tradePortalPage'
import type { GcState, Partner } from '../../lib/gc/types'
import { HAIR, MUTED } from '../../lib/portal/portalTheme'
import { Btn, Chip, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePortalPress, usePress } from './gcTradePortalPress'
import { escapeHtml, printPortalHtml } from './gcTradePortalPrint'
import { PortalFilePick } from './GcTradePortalFile'
import { PortalBlock, PortalNote } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal's P5b-1 (to-dos/gc-mode/mockups/portal-p5b.md): the company's own papers with us,
 * from the design spike's `GcPortalPaperwork.tsx` and `GcPortalPapers.tsx`. The vetting form of a company new to us, its
 * master agreement and its W-9 opened to sign on `/contract/accept` (the page the office's email opens, so one paper
 * system: the W-9's tax number lives only in its signed PDF), and its insurance certificate, which it sends from here
 * (P5b-2: the file kind, then the kind `coi`) and which waits as received until the office marks it good (the owner's
 * "Office looks first"). The spike's "Tell Click the day it will come" comes with a kind of its own later.
 */

const GC = GC_COMPANY.shortName

export function GcTradePortalPaperwork({
  partner,
  today,
  open,
  onOpen,
  onPapers,
}: {
  partner: Partner
  today: string
  /** The line whose form is open, when the company came here from Needs you. */
  open: PaperworkLine | null
  onOpen: (line: PaperworkLine | null) => void
  /** Your papers, every paper signed with us. */
  onPapers: () => void
}) {
  const { lang, t } = usePortalLang()
  const press = usePortalPress()
  const coi = portalInsurance(partner, today, lang)
  const vet = portalVetting(partner, lang)
  const [opening, setOpening] = useState<'msa' | 'w9' | null>(null)
  const [problem, setProblem] = useState<{ paper: 'msa' | 'w9'; words: string } | null>(null)
  const openPaper = async (paper: 'msa' | 'w9') => {
    if (!press) return
    setOpening(paper)
    setProblem(null)
    try {
      const refused = await press.openPaper(paper)
      if (refused) setProblem({ paper, words: refused })
    } finally {
      setOpening(null)
    }
  }
  const refusal = (paper: 'msa' | 'w9') =>
    problem?.paper === paper ? <div style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem.words}</div> : null

  return (
    <PortalBlock title={t('paperTitle', { gc: GC })}>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        {/* A company we did not know: its form, and where the office's check stands (question 3). */}
        {vet.state !== 'known' && (
          <>
            <Line label={t('vetLine')}>
              <Chip tone={vet.state === 'approved' ? 'green' : vet.state === 'declined' ? 'red' : 'grey'}>{vet.words}</Chip>
              {press && vet.state === 'send' && open !== 'vet' && (
                <Btn kind="primary" onClick={() => onOpen('vet')}>
                  {t('vetFormBtn')}
                </Btn>
              )}
            </Line>
            {(vet.state === 'send' || vet.state === 'checking') && <div style={{ fontSize: '0.8rem', color: MUTED }}>{t('vetWhy', { gc: GC })}</div>}
            {press && open === 'vet' && vet.state === 'send' && <VettingForm onDone={() => onOpen(null)} />}
          </>
        )}

        <Line label={t('masterAgreement')}>
          {partner.msa === 'signed' && <Chip tone="green">{t('signedOn', { date: pDate(lang, partner.msaSignedOn) })}</Chip>}
          {partner.msa === 'sent' && press && (
            <Btn kind="primary" disabled={opening !== null} onClick={() => void openPaper('msa')}>
              {t('readSign')}
            </Btn>
          )}
          {partner.msa === 'none' && <Chip tone="grey">{t('msaWhenPicked', { gc: GC })}</Chip>}
        </Line>
        {refusal('msa')}

        <Line label={t('insuranceCert')}>
          <Chip tone={coi.soon ? 'amber' : coi.done ? 'green' : 'red'}>{coi.words}</Chip>
          {/* One it sent waits for the office's look (P5b-2m): it says so, and asks for nothing more. */}
          {partner.coiReceived ? (
            <Chip tone="grey">{t('coiChecking', { gc: GC, date: pDate(lang, partner.coiReceived.sentOn) })}</Chip>
          ) : (
            press &&
            open !== 'coi' && (
              <Btn kind={coi.done && !coi.soon ? 'quiet' : 'primary'} onClick={() => onOpen('coi')}>
                {t(coi.done ? 'sendNewer' : 'sendCert')}
              </Btn>
            )
          )}
        </Line>
        {press && open === 'coi' && !partner.coiReceived && <CoiForm today={today} onDone={() => onOpen(null)} />}

        <Line label={t('w9')}>
          <Chip tone={partner.w9 ? 'green' : 'red'}>{t(partner.w9 ? 'onFile' : 'noneOnFile')}</Chip>
          {!partner.w9 && press && (
            <Btn kind="primary" disabled={opening !== null} onClick={() => void openPaper('w9')}>
              {t('fillW9')}
            </Btn>
          )}
        </Line>
        {refusal('w9')}

        <div style={{ fontSize: '0.8rem', color: MUTED }}>{t('msaOnce')}</div>
        <div>
          <Btn kind="quiet" onClick={onPapers}>
            {t('papersLink')}
          </Btn>
        </div>
      </div>
    </PortalBlock>
  )
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ minWidth: '9.5rem' }}>{label}</span>
      {children}
    </div>
  )
}

/**
 * Its insurance certificate (P5b-2): a photo or PDF, then the day the policy runs out (a year from today to start). The
 * file goes up first (the kind `file`, for `coi`), then the kind `coi` files it as received with the file's link.
 */
function CoiForm({ today, onDone }: { today: string; onDone: () => void }) {
  const { t } = usePortalLang()
  const { busy, problem, runWithFile } = usePress()
  const [picked, setPicked] = useState<PickedFile | null>(null)
  const [expires, setExpires] = useState(aYearFrom(today))
  const ready = picked !== null && expires > today
  return (
    <PortalNote tone="paper">
      <PortalFilePick label={t('certFile')} picked={picked} onPick={setPicked} disabled={busy} />
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        {t('certExpires')}
        <input type="date" min={today} value={expires} onChange={(e) => setExpires(e.target.value)} style={{ ...input, width: '11rem' }} />
      </label>
      {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn
          kind="primary"
          disabled={!ready || busy}
          onClick={() =>
            void runWithFile(portalCoiUpload(picked), 'coi', (placed) => ({ expiresOn: expires, fileUrl: placed?.url ?? '' })).then((ok) => {
              if (ok) onDone()
            })
          }
        >
          {t('sendTo', { gc: GC })}
        </Btn>
        <Btn kind="quiet" onClick={onDone}>
          {t('notNow')}
        </Btn>
      </div>
    </PortalNote>
  )
}

/** What a company new to us tells us about itself, as it writes it. Every line is needed (`gc_trade_vetting_form`). */
function VettingForm({ onDone }: { onDone: () => void }) {
  const { t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const [license, setLicense] = useState('')
  const [insurance, setInsurance] = useState('')
  const [years, setYears] = useState('')
  const [references, setReferences] = useState('')
  const [pastJobs, setPastJobs] = useState('')
  const yearsNumber = Number(years)
  const ready = [license, insurance, references, pastJobs].every((x) => x.trim() !== '') && years.trim() !== '' && Number.isInteger(yearsNumber) && yearsNumber >= 0
  const area = { ...input, width: '100%', boxSizing: 'border-box' as const, resize: 'vertical' as const, fontFamily: 'inherit' }
  const field = { ...input, width: '100%', boxSizing: 'border-box' as const }
  return (
    <PortalNote tone="paper">
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        {t('vetLicense')}
        <input style={field} value={license} onChange={(e) => setLicense(e.target.value)} />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        {t('vetInsurance')}
        <input style={field} value={insurance} onChange={(e) => setInsurance(e.target.value)} />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        {t('vetYears')}
        <input style={{ ...input, width: '6rem' }} type="number" min={0} step={1} inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        {t('vetReferences')}
        <textarea style={area} rows={3} value={references} onChange={(e) => setReferences(e.target.value)} />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        {t('vetPastJobs')}
        <textarea style={area} rows={3} value={pastJobs} onChange={(e) => setPastJobs(e.target.value)} />
      </label>
      {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn
          kind="primary"
          disabled={!ready || busy}
          onClick={() =>
            void run('vetting_form', { license: license.trim(), insurance: insurance.trim(), years: yearsNumber, references: references.trim(), pastJobs: pastJobs.trim() }).then((ok) => {
              if (ok) onDone()
            })
          }
        >
          {t('sendTo', { gc: GC })}
        </Btn>
        <Btn kind="quiet" onClick={onDone}>
          {t('notNow')}
        </Btn>
      </div>
    </PortalNote>
  )
}

/**
 * Your papers (the spike's `GcPortalPapers.tsx`): every paper the company signed with us, its own first, then each job's,
 * newest first. Read and print only: a job's paper opens its job, and no paper's link passes to the portal.
 */
export function GcTradePortalPapersPage({
  state,
  partner,
  onHome,
  onOpenProject,
}: {
  state: GcState
  partner: Partner
  onHome: () => void
  onOpenProject: (projectId: string) => void
}) {
  const { lang, t } = usePortalLang()
  const papers = portalPapers(state, partner.id, lang)
  const none = papers.company.length === 0 && papers.jobs.length === 0
  const toJob = (p: PortalPaper): string | null => (p.open && p.open.kind !== 'msa' ? p.open.projectId : null)

  const print = () => {
    const row = (p: PortalPaper) => `<tr><td>${escapeHtml(p.title)}</td><td class="muted">${escapeHtml(p.words)}</td></tr>`
    const body =
      `<h1>${escapeHtml(t('papersTitle'))} · ${escapeHtml(partner.company)}</h1>` +
      `<div class="muted">${escapeHtml(GC_COMPANY.name)} · ${escapeHtml(t('papersPrinted', { date: pDate(lang, state.today) }))}</div>` +
      (papers.company.length > 0 ? `<h2>${escapeHtml(t('papersCompany', { gc: GC }))}</h2><table>${papers.company.map(row).join('')}</table>` : '') +
      papers.jobs.map((j) => `<h2>${escapeHtml(`${j.project.name} · ${j.trade}`)}</h2><table>${j.papers.map(row).join('')}</table>`).join('')
    printPortalHtml(`${t('papersTitle')} · ${partner.company}`, body)
  }

  return (
    <div style={{ padding: '0.9rem', display: 'grid', gap: '0.9rem' }}>
      <div>
        <button
          type="button"
          onClick={onHome}
          style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.35rem', minHeight: 32 }}
        >
          {t('backHome', { gc: GC })}
        </button>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('papersTitle')}</div>
        <div style={{ fontSize: '0.85rem', color: MUTED }}>{t('papersIntro', { gc: GC })}</div>
        {!none && (
          <div style={{ marginTop: '0.4rem' }}>
            <Btn onClick={print}>{t('papersPrint')}</Btn>
          </div>
        )}
      </div>

      {none && <div style={{ fontSize: '0.9rem' }}>{t('papersNone')}</div>}

      {papers.company.length > 0 && (
        <PortalBlock title={t('papersCompany', { gc: GC })}>
          <Rows papers={papers.company} toJob={toJob} onOpenProject={onOpenProject} />
        </PortalBlock>
      )}
      {papers.jobs.map((j) => (
        <PortalBlock key={`${j.project.id}:${j.trade}`} title={`${j.project.name} · ${j.trade}`}>
          <Rows papers={j.papers} toJob={toJob} onOpenProject={onOpenProject} />
        </PortalBlock>
      ))}
    </div>
  )
}

function Rows({ papers, toJob, onOpenProject }: { papers: PortalPaper[]; toJob: (p: PortalPaper) => string | null; onOpenProject: (projectId: string) => void }) {
  const { t } = usePortalLang()
  return (
    <div style={{ display: 'grid' }}>
      {papers.map((p, i) => {
        const job = toJob(p)
        return (
          <div
            key={p.key}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.1rem', borderTop: i === 0 ? 'none' : `1px solid ${HAIR}`, fontSize: '0.9rem' }}
          >
            <span style={{ display: 'grid', gap: '0.1rem', minWidth: 0 }}>
              <strong>{p.title}</strong>
              <span style={{ fontSize: '0.8rem', color: MUTED }}>{p.words}</span>
            </span>
            {job && (
              <Btn kind="quiet" onClick={() => onOpenProject(job)}>
                {t('paperOpen')}
              </Btn>
            )}
          </div>
        )
      })}
    </div>
  )
}

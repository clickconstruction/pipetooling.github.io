/**
 * What a GC reads about the papers a job requires (punch list #389, step 5): one block under each job's name that
 * requires a paper built from settings. It says what the paper asks in the list's own plain words, the level that
 * comes to, how many of the people who can open the job have signed, and each sub business with its day. No worker
 * is named unless the office set the job to show every signer by name, and it can set the count alone. What the
 * setting hides never reaches the page. Read only: its one press downloads a sample, and nothing a GC does changes
 * the paper. Since step 6 a GC may propose a stricter setting under it, which changes nothing until the office takes
 * it (`PortalJobPaperPropose`).
 *
 * Since step 7 a job can require the GC's own form instead, or beside a paper. Its block says so, with the same count
 * and businesses, and offers no level, sample or proposal: the form has no settings.
 *
 * The words are `lib/portal/gcJobPapers.ts`. Its title is its own: the Document builder's block on this page reads
 * *Secrecy on this job* and shows a builder the office sent, which is another thing. Light always, as their page is.
 */
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { GC_OWN_FORM_TITLE, GC_PAPER_SAMPLE, GC_PAPER_SIGNERS_HEAD, GC_PAPER_TITLE, gcOwnFormFine, gcOwnFormLead, gcPaperBusiness, gcPaperFine, gcPaperGate, gcPaperLevel, gcPaperRevisionLine, gcPaperSampleUrl, gcPaperSigned, gcPaperSigner, type GcJobPaper, type GcJobPapers, type GcOwnForm, type GcPaperBusiness, type GcPaperSigner } from '../../lib/portal/gcJobPapers'
import { CARD, HAIR, INK, MUTED, PAPER, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { Chip } from '../gc/gcUi'
import { PortalJobPaperPropose } from './PortalJobPaperPropose'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1`

/** How many have signed, the meter, each sub business with its day, and the signers when the office set the job to name them. */
function SignedCard({ signed: done, total, businesses, signers, company }: { signed: number; total: number; businesses: GcPaperBusiness[]; signers: GcPaperSigner[]; company: string }) {
  const signed = gcPaperSigned({ signed: done, total })
  return (
    <div data-portal-job-paper-signed="" style={{ border: `1px solid ${HAIR}`, padding: '0.75rem 0.9rem', display: 'grid', gap: '0.5rem' }}>
      <b style={{ fontSize: '0.95rem' }}>{signed.head}</b>
      <div aria-hidden style={{ height: 8, borderRadius: 999, background: HAIR, overflow: 'hidden' }}>
        <div style={{ width: `${signed.percent}%`, height: '100%', background: PAPER_GREEN }} />
      </div>
      <div style={{ fontSize: '0.86rem', color: MUTED }}>{gcPaperGate(company)}</div>
      {businesses.map((b) => {
        const w = gcPaperBusiness(b)
        return (
          <div key={b.name} data-portal-job-paper-business={w.done ? 'signed' : 'owed'} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.6rem', alignItems: 'center', paddingTop: '0.45rem', borderTop: `1px solid ${HAIR}`, fontSize: '0.92rem' }}>
            <b style={{ fontWeight: 600 }}>{b.name}</b>
            <Chip tone={w.done ? 'green' : 'amber'}>{w.chip}</Chip>
            {w.detail ? <span style={{ fontSize: '0.86rem', color: MUTED }}>{w.detail}</span> : null}
          </div>
        )
      })}
      {signers.length > 0 ? (
        <div data-portal-job-paper-signers="" style={{ display: 'grid', gap: 0, paddingTop: '0.45rem', borderTop: `1px solid ${HAIR}` }}>
          <b style={{ fontSize: '0.86rem' }}>{GC_PAPER_SIGNERS_HEAD}</b>
          {signers.map((g, at) => {
            const w = gcPaperSigner(g)
            return (
              // Two people can share a name, so the key is the place in the list.
              <div key={`${at}-${g.name}`} data-portal-job-paper-signer="" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.6rem', alignItems: 'center', padding: '0.35rem 0', fontSize: '0.92rem' }}>
                <span>{g.name}</span>
                <Chip tone="green">{w.chip}</Chip>
                {w.detail ? <span style={{ fontSize: '0.86rem', color: MUTED }}>{w.detail}</span> : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function PaperBlock({ paper, company, sampleUrl, token, phone }: { paper: GcJobPaper; company: string; sampleUrl: string | null; token: string; phone: string | null }) {
  const level = gcPaperLevel(paper)
  const revision = gcPaperRevisionLine(paper)
  return (
    <div data-portal-job-paper={paper.id} style={{ background: CARD, border: `1px solid ${INK}`, padding: '1rem 1.3rem', display: 'grid', gap: '0.7rem' }}>
      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center' }}>
          <b style={{ fontSize: '1rem' }}>{GC_PAPER_TITLE}</b>
          <Chip tone={paper.level ? 'blue' : 'grey'} wrap>
            {level.chip}
          </Chip>
        </div>
        <div style={{ fontSize: '0.86rem', color: MUTED }}>{paper.name}</div>
        {level.line ? <div style={{ fontSize: '0.92rem' }}>{level.line}</div> : null}
        {revision ? <div style={{ fontSize: '0.86rem', color: MUTED }}>{revision}</div> : null}
      </div>

      {paper.said.length > 0 ? (
        <div data-portal-job-paper-said="" style={{ display: 'grid', gap: 0 }}>
          {paper.said.map((s) => (
            <div key={s.label} style={{ display: 'grid', gap: '0.1rem', padding: '0.45rem 0', borderTop: `1px solid ${HAIR}`, fontSize: '0.92rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.6rem', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span>{s.label}</span>
                <b style={{ color: s.out ? MUTED : INK }}>{s.choice}</b>
              </div>
              {s.says ? <div style={{ fontSize: '0.86rem', color: MUTED }}>{s.says}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      <SignedCard signed={paper.signed} total={paper.total} businesses={paper.businesses} signers={paper.signers} company={company} />

      {sampleUrl ? (
        <div style={{ display: 'grid', gap: '0.35rem', justifyItems: 'start' }}>
          {/* A link, not a fetch: the function answers the PDF itself, and it opens in a tab of its own. A finger tall. */}
          <a
            href={sampleUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-portal-job-paper-sample=""
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, boxSizing: 'border-box', border: `1px solid ${INK}`, background: INK, color: PAPER, borderRadius: 6, padding: '10px 18px', fontSize: '0.92rem', fontWeight: 600, textDecoration: 'none' }}
          >
            {GC_PAPER_SAMPLE.press}
          </a>
          <div style={{ fontSize: '0.8rem', color: MUTED }}>{GC_PAPER_SAMPLE.fine}</div>
        </div>
      ) : null}

      <PortalJobPaperPropose paper={paper} token={token} phone={phone} />

      <div style={{ fontSize: '0.8rem', color: MUTED }}>{gcPaperFine(company)}</div>
    </div>
  )
}

/** The GC's own form on a job: whose form it is, then who has signed. It has no settings, so nothing else. */
function OwnFormBlock({ form, company }: { form: GcOwnForm; company: string }) {
  return (
    <div data-portal-job-own-form={form.id} style={{ background: CARD, border: `1px solid ${INK}`, padding: '1rem 1.3rem', display: 'grid', gap: '0.7rem' }}>
      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <b style={{ fontSize: '1rem' }}>{GC_OWN_FORM_TITLE}</b>
        <div style={{ fontSize: '0.86rem', color: MUTED }}>{form.name}</div>
        <div style={{ fontSize: '0.92rem' }}>{gcOwnFormLead(company)}</div>
      </div>
      <SignedCard signed={form.signed} total={form.total} businesses={form.businesses} signers={[]} company={company} />
      <div style={{ fontSize: '0.8rem', color: MUTED }}>{gcOwnFormFine(company)}</div>
    </div>
  )
}

/**
 * Every job's papers on the page, each under its job's name. Draws nothing for a customer whose jobs require none.
 * `token` is the page's own link: with it each paper offers its sample and a proposal. The sample statement's made-up
 * tokens offer neither. `phone` is the office's number, for a send that fails.
 */
export function PortalJobPapers({ jobs, company, token = '', phone = null }: { jobs: GcJobPapers[]; company: string; token?: string; phone?: string | null }) {
  if (jobs.length === 0) return null
  const real = token && !sampleStateFromToken(token) ? token : ''
  return (
    <div data-screen-only data-portal-job-papers="" style={{ margin: '1.4rem 0 0', display: 'grid', gap: '0.8rem' }}>
      {jobs.map((job) => (
        <div key={job.jobId} data-portal-job-papers-job={job.jobId} style={{ display: 'grid', gap: '0.4rem' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED, borderBottom: `1px solid ${HAIR}`, paddingBottom: 4 }}>{job.jobLabel || 'Job'}</div>
          {job.ownForms.map((form) => (
            <OwnFormBlock key={form.id} form={form} company={company} />
          ))}
          {job.papers.map((paper) => (
            <PaperBlock key={paper.id} paper={paper} company={company} sampleUrl={real ? gcPaperSampleUrl(FUNCTIONS_URL, real, paper.id) : null} token={real} phone={phone} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default PortalJobPapers

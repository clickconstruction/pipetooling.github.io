/**
 * What a GC reads about the papers a job requires (punch list #389, step 5): one block under each job's name that
 * requires a paper built from settings. It says what the paper asks in the list's own plain words, the level that
 * comes to, how many of the people who can open the job have signed, and each sub business with its day. No worker
 * is named. Read only: nothing here is a press, and nothing a GC does changes the paper.
 *
 * The words are `lib/portal/gcJobPapers.ts`. Its title is its own: the Document builder's block on this page reads
 * *Secrecy on this job* and shows a builder the office sent, which is another thing. Light always, as their page is.
 */
import { GC_PAPER_TITLE, gcPaperBusiness, gcPaperFine, gcPaperGate, gcPaperLevel, gcPaperRevisionLine, gcPaperSigned, type GcJobPaper, type GcJobPapers } from '../../lib/portal/gcJobPapers'
import { CARD, HAIR, INK, MUTED, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { Chip } from '../gc/gcUi'

function PaperBlock({ paper, company }: { paper: GcJobPaper; company: string }) {
  const level = gcPaperLevel(paper)
  const signed = gcPaperSigned(paper)
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

      <div data-portal-job-paper-signed="" style={{ border: `1px solid ${HAIR}`, padding: '0.75rem 0.9rem', display: 'grid', gap: '0.5rem' }}>
        <b style={{ fontSize: '0.95rem' }}>{signed.head}</b>
        <div aria-hidden style={{ height: 8, borderRadius: 999, background: HAIR, overflow: 'hidden' }}>
          <div style={{ width: `${signed.percent}%`, height: '100%', background: PAPER_GREEN }} />
        </div>
        <div style={{ fontSize: '0.86rem', color: MUTED }}>{gcPaperGate(company)}</div>
        {paper.businesses.map((b) => {
          const w = gcPaperBusiness(b)
          return (
            <div key={b.name} data-portal-job-paper-business={w.done ? 'signed' : 'owed'} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.6rem', alignItems: 'center', paddingTop: '0.45rem', borderTop: `1px solid ${HAIR}`, fontSize: '0.92rem' }}>
              <b style={{ fontWeight: 600 }}>{b.name}</b>
              <Chip tone={w.done ? 'green' : 'amber'}>{w.chip}</Chip>
              {w.detail ? <span style={{ fontSize: '0.86rem', color: MUTED }}>{w.detail}</span> : null}
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: '0.8rem', color: MUTED }}>{gcPaperFine(company)}</div>
    </div>
  )
}

/** Every job's papers on the page, each under its job's name. Draws nothing for a customer whose jobs require none. */
export function PortalJobPapers({ jobs, company }: { jobs: GcJobPapers[]; company: string }) {
  if (jobs.length === 0) return null
  return (
    <div data-screen-only data-portal-job-papers="" style={{ margin: '1.4rem 0 0', display: 'grid', gap: '0.8rem' }}>
      {jobs.map((job) => (
        <div key={job.jobId} data-portal-job-papers-job={job.jobId} style={{ display: 'grid', gap: '0.4rem' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED, borderBottom: `1px solid ${HAIR}`, paddingBottom: 4 }}>{job.jobLabel || 'Job'}</div>
          {job.papers.map((paper) => (
            <PaperBlock key={paper.id} paper={paper} company={company} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default PortalJobPapers

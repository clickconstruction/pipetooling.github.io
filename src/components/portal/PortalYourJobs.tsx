import { PORTAL_JOB_STAGES, type PortalMyJob } from '../../../supabase/functions/_shared/portalMyJobs'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER_GREEN } from '../../lib/portal/portalTheme'

/**
 * Your jobs on the customer's portal (v2.5948, punch list #185 PR 5): each of their own open jobs, and each paid one
 * they were asked to review, with where it is on the way (Booked, Working, Done, Billed, Paid) and the review: a door to
 * `/rate` while the ask is open, their stars after. The one link that is theirs then says where their job is. Screen
 * only: the printed statement is the money. The rows are `_shared/portalMyJobs.ts`'s.
 */

const WORDS = {
  en: { title: 'Your jobs', hint: 'Where each job is, and how we did.', rate: 'How did we do? Rate us with one tap', stars: (n: number) => `You gave us ${n} ${n === 1 ? 'star' : 'stars'}. Thank you.`, where: 'Where the job is' },
  es: { title: 'Sus trabajos', hint: 'Dónde va cada trabajo, y cómo lo hicimos.', rate: '¿Cómo lo hicimos? Califíquenos con un toque', stars: (n: number) => `Nos dio ${n} ${n === 1 ? 'estrella' : 'estrellas'}. Gracias.`, where: 'Dónde va el trabajo' },
} as const

const STAR_ON = '#f59e0b'

export default function PortalYourJobs({ jobs, lang = 'en' }: { jobs: readonly PortalMyJob[]; lang?: 'en' | 'es' }) {
  if (!jobs.length) return null
  const w = WORDS[lang]
  const stages = PORTAL_JOB_STAGES[lang]
  return (
    <section data-screen-only data-portal-your-jobs style={{ marginTop: '1.4rem', background: CARD, border: `1px solid ${HAIR}`, padding: '16px 20px 14px', color: INK }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: COPPER }}>{w.title}</div>
      <p style={{ margin: '6px 0 4px', fontSize: 12.5, color: MUTED }}>{w.hint}</p>
      {jobs.map((j) => (
        <div key={j.jobId} data-portal-my-job style={{ borderTop: `1px solid ${HAIR}`, padding: '10px 0 8px', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14.5 }}>{j.label}</b>
            {j.address && j.address !== j.label ? <span style={{ fontSize: 12, color: MUTED }}>{j.address}</span> : null}
          </div>
          <ol aria-label={w.where} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12.5 }}>
            {stages.map((s, i) => {
              const done = i < j.stage || (i === 4 && j.stage === 4)
              const now = i === j.stage
              return (
                <li key={s} aria-current={now ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 5, color: now ? INK : done ? PAPER_GREEN : FAINT, fontWeight: now ? 700 : 500 }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: now || done ? (now ? COPPER : PAPER_GREEN) : 'transparent', border: `1.5px solid ${now ? COPPER : done ? PAPER_GREEN : FAINT}` }} />
                  {s}
                </li>
              )
            })}
          </ol>
          {j.rateToken ? (
            <a href={`/rate?t=${encodeURIComponent(j.rateToken)}`} style={{ fontSize: 13.5, fontWeight: 600, color: COPPER, textDecoration: 'none', minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>
              {w.rate} →
            </a>
          ) : j.stars != null ? (
            <span style={{ fontSize: 13 }}>
              <span aria-hidden style={{ color: STAR_ON, letterSpacing: 1 }}>
                {'★'.repeat(j.stars)}
              </span>{' '}
              {w.stars(j.stars)}
            </span>
          ) : null}
        </div>
      ))}
    </section>
  )
}

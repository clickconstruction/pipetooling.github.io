import { useState, type Dispatch } from 'react'
import { GC_COMPANY, pDate, portalPapers, type GcAction, type GcState, type Partner, type PortalPaper, type PortalPaperOpen } from '../../lib/gcMode/gcModel'
import { Btn } from './gcUi'
import { GcBuildingPayAppWindow } from './GcBuildingPayApp'
import { GcPortalAgreement } from './GcPortalAgreement'
import { PortalBlock } from './GcPortalUi'
import { escapeHtml, printPortalHtml } from './gcPortalPrint'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: Your papers, in the trade's portal (owner, 2026-10-04). Every paper the
 * company signed with us: its own (the master agreement, its W-9 and insurance on file, its company
 * form), then each job's (the statement of work, change orders, each pay application and its
 * waivers, the final releases), newest first. One opens to read; the list prints on its own.
 */

const GC = GC_COMPANY.shortName
const RULE = '#d9d2c3'

export function GcPortalPapers({
  state,
  partner,
  dispatch,
  onHome,
  onOpenProject,
}: {
  state: GcState
  partner: Partner
  dispatch: Dispatch<GcAction>
  onHome: () => void
  onOpenProject: (projectId: string) => void
}) {
  const { lang, t } = usePortalLang()
  const papers = portalPapers(state, partner.id, lang)
  const [open, setOpen] = useState<PortalPaperOpen | null>(null)
  const none = papers.company.length === 0 && papers.jobs.length === 0

  const onOpen = (o: PortalPaperOpen) => (o.kind === 'project' ? onOpenProject(o.projectId) : setOpen(o))

  const print = () => {
    const row = (p: PortalPaper) => `<tr><td>${escapeHtml(p.title)}</td><td class="muted">${escapeHtml(p.words)}</td></tr>`
    const body =
      `<h1>${escapeHtml(t('papersTitle'))} · ${escapeHtml(partner.company)}</h1>` +
      `<div class="muted">${escapeHtml(GC_COMPANY.name)} · ${escapeHtml(t('papersPrinted', { date: pDate(lang, state.today) }))}</div>` +
      (papers.company.length > 0 ? `<h2>${escapeHtml(t('papersCompany', { gc: GC }))}</h2><table>${papers.company.map(row).join('')}</table>` : '') +
      papers.jobs.map((j) => `<h2>${escapeHtml(`${j.project.name} · ${j.trade}`)}</h2><table>${j.papers.map(row).join('')}</table>`).join('')
    printPortalHtml(`${t('papersTitle')} · ${partner.company}`, body)
  }

  const payApp = open?.kind === 'payApp' ? open : null
  const project = payApp ? state.projects.find((p) => p.id === payApp.projectId) : undefined
  const pkg = payApp ? project?.packages.find((k) => k.id === payApp.packageId) : undefined
  const draw = payApp ? pkg?.sow?.draws.find((d) => d.id === payApp.drawId) : undefined

  return (
    <div style={{ padding: '0.9rem', display: 'grid', gap: '0.9rem' }}>
      <div>
        <button
          type="button"
          onClick={onHome}
          style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.35rem' }}
        >
          {t('backHome', { gc: GC })}
        </button>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('papersTitle')}</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{t('papersIntro', { gc: GC })}</div>
        {!none && (
          <div style={{ marginTop: '0.4rem' }}>
            <Btn onClick={print}>{t('papersPrint')}</Btn>
          </div>
        )}
      </div>

      {none && <div style={{ fontSize: '0.9rem' }}>{t('papersNone')}</div>}

      {papers.company.length > 0 && (
        <PortalBlock title={t('papersCompany', { gc: GC })}>
          <Rows papers={papers.company} onOpen={onOpen} />
        </PortalBlock>
      )}
      {papers.jobs.map((j) => (
        <PortalBlock key={`${j.project.id}:${j.trade}`} title={`${j.project.name} · ${j.trade}`}>
          <Rows papers={j.papers} onOpen={onOpen} />
        </PortalBlock>
      ))}

      {open?.kind === 'msa' && <GcPortalAgreement partner={partner} onClose={() => setOpen(null)} dispatch={dispatch} />}
      {project && pkg && draw && <GcBuildingPayAppWindow project={project} pkg={pkg} partner={partner} draw={draw} viewer="trade" onClose={() => setOpen(null)} />}
    </div>
  )
}

function Rows({ papers, onOpen }: { papers: PortalPaper[]; onOpen: (o: PortalPaperOpen) => void }) {
  const { t } = usePortalLang()
  return (
    <div style={{ display: 'grid' }}>
      {papers.map((p, i) => (
        <div
          key={p.key}
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.1rem', borderTop: i === 0 ? 'none' : `1px solid ${RULE}`, fontSize: '0.9rem' }}
        >
          <span style={{ display: 'grid', gap: '0.1rem', minWidth: 0 }}>
            <strong>{p.title}</strong>
            <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>{p.words}</span>
          </span>
          {p.open && (
            <Btn kind="quiet" onClick={() => p.open && onOpen(p.open)}>
              {t('paperOpen')}
            </Btn>
          )}
        </div>
      ))}
    </div>
  )
}

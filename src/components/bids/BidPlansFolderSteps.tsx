import { useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { bidPlansFolderName, divisionBidFolderFor, findFolderWords, type FindFolderResult } from '../../lib/bids/bidPlansFolder'

/**
 * The four steps that get the plans where the robots read them (v2.4162): open the division
 * bid folder, make a folder with the name the app gives (Copy name), put the PDFs in it,
 * Find — the app looks the folder up by that name and fills the plans link in. The
 * estimator never copies a link; a link pasted by hand is the exception, under the steps.
 */
export function BidPlansFolderSteps({
  projectName,
  bidNumber,
  bidId,
  serviceTypeName,
  onFound,
}: {
  projectName: string
  bidNumber: string
  bidId: string | null
  serviceTypeName: string
  /** The found folder's link, and how many PDFs it holds. */
  onFound: (link: string, pdfs: number) => void
}) {
  const { showToast } = useToastContext()
  const [finding, setFinding] = useState(false)
  const [findLine, setFindLine] = useState<string | null>(null)
  const division = divisionBidFolderFor(serviceTypeName)
  const name = bidPlansFolderName({ project_name: projectName, bid_number: bidNumber || null, id: bidId ?? 'new' })
  const named = projectName.trim().length > 0

  async function copyName() {
    try {
      await navigator.clipboard.writeText(name)
      showToast('Folder name copied', 'success')
    } catch {
      showToast(name, 'info')
    }
  }

  async function find() {
    if (!division) return
    setFinding(true)
    setFindLine(null)
    try {
      const { data, error } = await supabase.functions.invoke<FindFolderResult & { error?: string }>('plan-fetch', {
        body: { find_folder: { parent_id: division.folderId, name } },
      })
      if (error || !data || data.error) {
        setFindLine(findFolderWords({ error: data?.error ?? error?.message ?? 'no answer' }, name))
        return
      }
      setFindLine(findFolderWords(data, name))
      if (data.found) onFound(data.link, data.pdfs)
    } catch (e) {
      setFindLine(findFolderWords({ error: e instanceof Error ? e.message : 'no answer' }, name))
    } finally {
      setFinding(false)
    }
  }

  const card: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.6rem 0.7rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', minWidth: 0 }
  const step: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-blue-700)' }
  const words: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }
  const btn: CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', alignSelf: 'flex-start' }

  return (
    <div data-testid="plans-folder-steps" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
      <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div style={card}>
          <span style={step}>1 · Open the {division ? division.label : 'division'} bid folder</span>
          {division ? (
            <>
              <span style={words}>Where every {division.label} bid’s folder lives.</span>
              <a href={division.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-link)', marginTop: 'auto' }} data-testid="open-division-folder">
                Open in Drive ↗
              </a>
            </>
          ) : (
            <span style={words}>Pick the service type first. It says which bid folder this is.</span>
          )}
        </div>
        <div style={card}>
          <span style={step}>2 · Make a folder with this name</span>
          {named ? (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', minWidth: 0 }}>
              <code data-testid="plans-folder-name" style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: 'var(--text-strong)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.25rem 0.45rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
              </code>
              <button type="button" onClick={() => void copyName()} style={btn} data-testid="copy-folder-name">
                Copy name
              </button>
            </div>
          ) : (
            <span style={words}>Type the project name first. The folder takes that name.</span>
          )}
          <span style={words}>Named the way the office names them, so it sorts with the rest.</span>
        </div>
        <div style={card}>
          <span style={step}>3 · Put the plans in it</span>
          <span style={words}>Drag the PDFs into the new folder. Every PDF in it counts as the plan set.</span>
        </div>
        <div style={card}>
          <span style={step}>4 · Find it</span>
          <span style={words}>Tap Find. The app looks the folder up by that name and fills the link in. No copying a link.</span>
          <button type="button" onClick={() => void find()} disabled={finding || !division || !named} style={{ ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff', opacity: finding || !division || !named ? 0.6 : 1 }} data-testid="find-plans-folder">
            {finding ? 'Looking…' : 'Find the folder'}
          </button>
        </div>
      </div>
      {findLine ? (
        <span role="status" data-testid="find-line" style={{ fontSize: '0.8rem', color: /^Found the folder ·/.test(findLine) ? 'var(--text-green-700)' : 'var(--text-amber-700)' }}>
          {findLine}
        </span>
      ) : null}
    </div>
  )
}

import { LIEN_WAIVER_FORM_TYPES, type LienWaiverFormType } from '../jobsDocuments/lienWaiverRelease'

/**
 * GC mode, the trade partner portal's P5a-2 (to-dos/gc-mode/mockups/portal-p5a.md): the waivers a trade signed in its
 * portal, as the PDFs `submit-gc-trade-portal` filed in the job's Drive folder. Each is a `gc_trade_files` row with
 * purpose `waiver`, its draw (`record_id`) and its form (`paper`). The office's link is labelled by the row's form,
 * never by a file name someone could rename in Drive. A draw shows the newest of each form, the conditional first.
 */
export interface WaiverFileRow {
  record_id: string | null
  paper: string | null
  drive_url: string
  uploaded_at: string
}

export interface WaiverFile {
  paper: LienWaiverFormType
  label: string
  url: string
}

/** The link's words for each form, as the Draws and Closeout windows show it. */
export const WAIVER_FILE_LABELS: Record<LienWaiverFormType, string> = {
  conditional_progress: 'Conditional waiver PDF',
  unconditional_progress: 'Unconditional waiver PDF',
  conditional_final: 'Conditional final release PDF',
  unconditional_final: 'Final release PDF',
}

const ORDER: readonly LienWaiverFormType[] = ['conditional_progress', 'conditional_final', 'unconditional_progress', 'unconditional_final']

const isForm = (p: string | null): p is LienWaiverFormType => p !== null && (LIEN_WAIVER_FORM_TYPES as readonly string[]).includes(p)

/** Each draw's signed waivers: the newest of each form, the conditional before the unconditional. */
export function waiverFilesByDraw(rows: WaiverFileRow[]): Map<string, WaiverFile[]> {
  const newest = new Map<string, Map<LienWaiverFormType, WaiverFileRow>>()
  for (const r of rows) {
    if (!r.record_id || !isForm(r.paper)) continue
    const forms = newest.get(r.record_id) ?? new Map<LienWaiverFormType, WaiverFileRow>()
    const had = forms.get(r.paper)
    if (!had || r.uploaded_at > had.uploaded_at) forms.set(r.paper, r)
    newest.set(r.record_id, forms)
  }
  const out = new Map<string, WaiverFile[]>()
  for (const [drawId, forms] of newest) {
    out.set(
      drawId,
      ORDER.flatMap((paper) => {
        const r = forms.get(paper)
        return r ? [{ paper, label: WAIVER_FILE_LABELS[paper], url: r.drive_url }] : []
      }),
    )
  }
  return out
}

/** No signed waivers read yet, or none to read. */
export const NO_WAIVER_FILES: ReadonlyMap<string, WaiverFile[]> = new Map()

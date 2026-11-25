/**
 * What the GC sees of who has signed a job's paper, as the office sets it (punch list #389, step 5). The three ways
 * and their reader live in `supabase/functions/_shared/portalJobPapers.ts`, which the GC's page reads too. This adds
 * the office's words: the choices on the settings page, and what its press says when only the page's own marks
 * moved. Pure.
 */
import {
  GC_PAPER_VIEWS,
  gcPaperViewOf,
  type GcPaperView,
} from '../../../supabase/functions/_shared/portalJobPapers'

export { GC_PAPER_VIEWS, gcPaperViewOf, type GcPaperView }

/** The control's name on the settings page. */
export const GC_VIEW_LABEL = 'What the GC sees'

/** Under the control: where it shows, and that it is no part of the paper. */
export const GC_VIEW_FINE =
  'This is who has signed, on the GC’s portal page. It changes no paper, and nobody signs again.'

const WORDS: Record<GcPaperView, string> = {
  count: 'How many have signed',
  businesses: 'How many, and each sub business with its day',
  names: 'How many, each sub business, and every signer by name',
}

/** One choice of the control, in the order the page lists them: least shown first. */
export function gcViewChoices(): Array<{ key: GcPaperView; label: string }> {
  return GC_PAPER_VIEWS.map((key) => ({ key, label: WORDS[key] }))
}

export function gcViewLabel(view: GcPaperView): string {
  return WORDS[view]
}

/**
 * The settings page's press and lines when no topic, blank or revision changed and only the page's own marks did:
 * the basis, what the GC sees, or both. Null when neither moved, and the page says what a change of settings does.
 */
export function pageMarksWords(moved: {
  basis: boolean
  gcView: boolean
}): { press: string; line: string; done: string } | null {
  if (moved.basis && moved.gcView)
    return {
      press: 'Save the basis and what the GC sees',
      line: 'Neither is part of the paper. Nobody signs again.',
      done: 'The basis is moved, and what the GC sees is set. Nobody signs again.',
    }
  if (moved.basis)
    return {
      press: 'Save the basis',
      line: 'The basis marks this page. Nobody signs again.',
      done: 'The basis is moved. Nobody signs again.',
    }
  if (moved.gcView)
    return {
      press: 'Save what the GC sees',
      line: 'This marks the GC’s page, never the paper. Nobody signs again.',
      done: 'What the GC sees is set. Nobody signs again.',
    }
  return null
}

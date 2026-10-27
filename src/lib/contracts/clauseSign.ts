/**
 * Messages, cut 4c, the sign page (v2.5294): a paper built from clauses as the signer reads it on `/contract/accept` and
 * as the office reads the signed copy. The database puts the paper together (`contract_paper_clauses`, read through
 * `supabase/functions/_shared/clausePaper.ts`); this turns it into what `ClausePaper` draws, and holds the sign page's
 * words in Spanish. The English words are the sign form's own.
 */
import { readSignedClauses, type ClausePaperJson } from '../../../supabase/functions/_shared/clausePaper'
import type { AssembledPaper } from './assemble'

/** What `ClausePaper` draws. */
export type ClausePaperView = Pick<AssembledPaper, 'title' | 'between' | 'revision' | 'lang' | 'clauses' | 'exhibit' | 'exhibitFor'>

/** The paper the page shows, under the copy's heading. */
export function clauseView(paper: ClausePaperJson, title: string): ClausePaperView {
  return { title, between: paper.between ?? '', revision: paper.revision, lang: paper.lang, clauses: paper.clauses, exhibit: paper.exhibit, exhibitFor: paper.exhibitFor }
}

/** A signed copy's frozen paper, or null when the copy was not built from clauses. */
export function signedClauseView(clauseVersions: unknown): ClausePaperView | null {
  const kept = readSignedClauses(clauseVersions)
  return kept ? clauseView(kept, kept.title) : null
}

/** What the sign page sends from the paper it shows, in `paperLang`, at `paperRevision`. */
export interface ClausePaperPayload {
  revision: number
  en: ClausePaperJson
  es: ClausePaperJson
}

/** The sign page's words around a paper built from clauses. */
export const CLAUSE_SIGN_WORDS = {
  en: { full: 'The full agreement', noun: 'this agreement', language: 'Language', changed: 'The paper changed since you opened it. Reload to read the new version.' },
  es: {
    full: 'El acuerdo completo',
    noun: 'este acuerdo',
    language: 'Idioma',
    changed: 'El documento cambió desde que lo abrió. Vuelva a cargar la página para leer la versión nueva.',
    heading: 'Firme el acuerdo',
    disclosure: 'Al firmar, usted reconoce que leyó este acuerdo y que está de acuerdo con él.',
    agree: 'Leí este acuerdo y estoy de acuerdo con él.',
    submit: 'Enviar la firma',
  },
} as const

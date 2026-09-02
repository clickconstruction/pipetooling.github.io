/**
 * The private storage bucket for lien-release artifacts (v2.2619): drawn
 * signature PNGs plus the stored mint/signed PDFs. Object paths:
 * `<release_id>/<uuid>.png`, `<release_id>/minted.pdf`, `<release_id>/signed.pdf`.
 * Created out-of-band (hr-files convention) — see
 * docs/migrations/20260902001517_lien_release_signing_foundation.md.
 * Uploads are best-effort everywhere: the job_lien_releases row (snapshot +
 * signature stamps) is the record; stored bytes are the audit copy.
 */
export const LIEN_RELEASE_DOCUMENTS_BUCKET = 'lien-release-documents'

export function lienReleaseMintedPdfPath(releaseId: string): string {
  return `${releaseId}/minted.pdf`
}

export function lienReleaseSignedPdfPath(releaseId: string): string {
  return `${releaseId}/signed.pdf`
}

/**
 * The private storage bucket for lien-release artifacts (v2.2619): drawn
 * signature PNGs plus the stored mint/signed PDFs. Object paths:
 * `<release_id>/<uuid>.png`, `<release_id>/minted.pdf`, `<release_id>/signed.pdf`, and the
 * notarized copy `<release_id>/notary-copy-<ms>.pdf` (v2.5985).
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

/**
 * The PDF that came back from the notary (v2.5985). A new name each time: the bucket has no update
 * policy, so a second file never overwrites the first; the row's notary_copy_path names the one in use.
 */
export function lienReleaseNotaryCopyPdfPath(releaseId: string, atMs: number): string {
  return `${releaseId}/notary-copy-${atMs}.pdf`
}

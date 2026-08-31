# 20260901030000_digest_reference_quality

Widens the `bid_audit_notes.digest_outcome` CHECK with a fifth bucket,
`reference_quality` (v2.2545): a blind-run/reference disagreement judged to be
the *reference's* fault (incomplete or untrustworthy historical record) digests
as reference_quality and files a repair task on the human bid, instead of
falsely teaching doctrine/books/code. Drop-and-re-add of the CHECK only;
idempotent, no table changes, appliers not required.

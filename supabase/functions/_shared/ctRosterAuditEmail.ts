/**
 * The CT↔PT roster audit email — lifted verbatim out of `ct-roster-audit/index.ts` in v2.4182
 * (punch list #60, lift 13 of 14 — the last row) so Settings → What the team sees renders it on
 * sample data. Pure: the roster diff and the two counts in, subject + HTML out (the email has no
 * text part).
 */
import type { CtRosterDiff, CtRosterRow, PtRosterRow } from './ctRosterDiff.ts'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function section(title: string, rows: string[], hint: string): string {
  if (rows.length === 0) return ''
  return `<h3 style="margin:16px 0 4px;font-size:15px">${esc(title)} (${rows.length})</h3>
<p style="margin:0 0 6px;color:#666;font-size:12px">${esc(hint)}</p>
<ul style="margin:0;padding-left:20px;font-size:13px">${rows.map((r) => `<li>${r}</li>`).join('')}</ul>`
}

export function renderCtRosterAuditEmail(diff: CtRosterDiff, ptCount: number, ctCount: number): { subject: string; html: string } {
  const issueCount =
    diff.onlyInCt.length + diff.linkedButGone.length + diff.twinFlagMismatch.length +
    diff.activeMismatch.length + diff.emailChanged.length + diff.backfillCandidates.length
  const subject = diff.clean
    ? 'CT↔PT roster audit: clean'
    : `CT↔PT roster audit: ${issueCount} item${issueCount === 1 ? '' : 's'} to look at`
  const pair = ({ pt, ct }: { pt: PtRosterRow; ct: CtRosterRow }) =>
    `${esc(pt.name || pt.email)} — PT <code>${esc(pt.email)}</code> ↔ CT <code>${esc(ct.email ?? ct.ct_user_id)}</code>`
  const html = `<div style="font-family:sans-serif;max-width:640px">
<h2 style="font-size:17px;margin:0 0 4px">CT↔PT roster audit</h2>
<p style="margin:0 0 10px;color:#444;font-size:13px">${ptCount} ClickTooling people · ${ctCount} CountTooling accounts · ${diff.clean ? 'no drift — all clear ✅' : 'drift found:'}</p>
${section('Only on CountTooling', diff.onlyInCt.map((c) => `<code>${esc(c.email ?? c.ct_user_id)}</code>${c.active ? '' : ' (banned)'}${c.is_admin ? ' — CT admin' : ''}`), 'CT accounts no PT person links to and no PT email matches. Unmanaged seats — link, archive on CT via the bridge, or leave deliberately.')}
${section('Linked but gone from CT', diff.linkedButGone.map((p) => `${esc(p.name || p.email)} — join key <code>${esc(p.counttooling_user_id ?? '')}</code>`), 'The PT join key points at a CT account that no longer exists. Clear the key or recreate the seat.')}
${section('Active mismatch', diff.activeMismatch.map(pair), 'One side is retired, the other still active — the exact offboarding hole the bridge exists to close. Usually fixed by re-running archive/restore.')}
${section('Twin flag mismatch', diff.twinFlagMismatch.map(pair), 'is_digital_twin disagrees between the apps for a linked pair.')}
${section('Email changed under a linked uuid', diff.emailChanged.map(pair), 'Same person, different emails (twin fleet domains are already normalized). Forward the change with update_email.')}
${section('Backfill candidates', diff.backfillCandidates.map(({ pt }) => `${esc(pt.name || pt.email)} — <code>${esc(pt.email)}</code>`), 'Unlinked PT people whose email exists on CT. One click of “run backfill” in Settings → Digital twins links them.')}
<p style="margin:14px 0 0;color:#999;font-size:11px">Weekly audit from the ct-roster-audit function — drift is caught, not prevented. Settings → System → Digital twins holds the bridge tools.</p>
</div>`
  return { subject, html }
}

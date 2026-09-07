#!/usr/bin/env python3
"""
One company, Phase 2 (v2.2970) — the mechanical policy sweep.

Reads every migration in order, keeps the LIVE definition of each RLS policy (CREATE POLICY
minus later DROP POLICY), and for every policy whose USING / WITH CHECK still reasons about
per-person ownership or adoption (master_user_id, master_assistants, master_shares,
assistants_share_master, can_see_sharing_master, master_shared_current_user) emits a
DROP + CREATE that wraps the expression:

    USING (public.is_office_staff() OR (<expression, verbatim>))

Nothing inside the old expression is edited, so every field / primary / superintendent /
customer-side branch keeps working exactly as before; the owner and adoption branches become
redundant for office roles and are retired for real in Phase 5. Restrictive policies are never
touched (none reference ownership today; the script refuses if one appears). The `users`
SELECT policy and the dormant `master_shares` table are skipped (Phase 1 handled the helpers
they call).

Usage (needs `pip install pglast`, Python 3.11):
    python3.11 scripts/one-company-policy-sweep.py supabase/migrations/<version>_one_company_policy_sweep.sql <version-label>
    python3.11 scripts/one-company-policy-sweep.py --rebind <out.sql> <version-label>
        Phase 5 (v2.2987): emit DROP + CREATE of every live policy that names master_assistants /
        master_shares, byte-identical (no wrapping) — run AFTER the tables are renamed and the
        same-named views exist, so the policies bind to the views instead of the retired tables.

Re-run on a fresh main after a rebase conflict — the output is disposable, the script is the
source of truth (CLAUDE.md, "mechanical sweeps merge alone").
"""
import glob, re, sys
from pglast import parser
from pglast.ast import CreatePolicyStmt, DropStmt, AlterPolicyStmt
from pglast.enums import ObjectType, RoleSpecType
from pglast.stream import RawStream

MARK = re.compile(r'master_user_id|master_assistants|master_shares|assistants_share_master|can_see_sharing_master|master_shared_current_user', re.I)
SKIP_TABLES = {'users', 'master_shares'}
WRAP = 'public.is_office_staff()'

def live_policies(out_path):
    policies = {}
    for f in sorted(glob.glob('supabase/migrations/*.sql')):
        if f == out_path:
            continue
        src = open(f).read()
        stmts = parser.parse_sql(src)
        for rs in stmts:
            st = rs.stmt
            if isinstance(st, CreatePolicyStmt):
                policies[(st.table.relname, st.policy_name)] = (f, st)
            elif isinstance(st, DropStmt) and st.removeType == ObjectType.OBJECT_POLICY:
                for obj in st.objects:
                    names = [n.sval for n in obj]
                    policies.pop((names[-2], names[-1]), None)
            elif isinstance(st, AlterPolicyStmt):
                # ALTER POLICY only replaces the parts it names; fold them into the live node.
                key = (st.table.relname, st.policy_name)
                if key in policies:
                    live = policies[key][1]
                    if st.roles is not None:
                        live.roles = st.roles
                    if st.qual is not None:
                        live.qual = st.qual
                    if st.with_check is not None:
                        live.with_check = st.with_check
    return policies

def qident(name):
    return '"' + name.replace('"', '""') + '"'

def render(st):
    table = st.table.relname
    parts = [f'CREATE POLICY {qident(st.policy_name)} ON public.{qident(table)}']
    if not st.permissive:
        raise SystemExit(f'restrictive policy {table}.{st.policy_name} references ownership — decide by hand')
    parts.append(f'FOR {(st.cmd_name or "all").upper()}')
    roles = st.roles or []
    if roles and not all(r.roletype == RoleSpecType.ROLESPEC_PUBLIC for r in roles):
        parts.append('TO ' + ', '.join(qident(r.rolename) if r.rolename else 'PUBLIC' for r in roles))
    if st.qual is not None:
        parts.append(f'USING ({WRAP} OR ({RawStream()(st.qual)}))')
    if st.with_check is not None:
        parts.append(f'WITH CHECK ({WRAP} OR ({RawStream()(st.with_check)}))')
    return '\n  '.join(parts) + ';'

GRANT_TABLES = re.compile(r'\b(master_assistants|master_shares)\b')

def render_verbatim(st):
    table = st.table.relname
    parts = [f'CREATE POLICY {qident(st.policy_name)} ON public.{qident(table)}']
    if not st.permissive:
        parts.append('AS RESTRICTIVE')
    parts.append(f'FOR {(st.cmd_name or "all").upper()}')
    roles = st.roles or []
    if roles and not all(r.roletype == RoleSpecType.ROLESPEC_PUBLIC for r in roles):
        parts.append('TO ' + ', '.join(qident(r.rolename) if r.rolename else 'PUBLIC' for r in roles))
    if st.qual is not None:
        parts.append(f'USING ({RawStream()(st.qual)})')
    if st.with_check is not None:
        parts.append(f'WITH CHECK ({RawStream()(st.with_check)})')
    return '\n  '.join(parts) + ';'

def rebind(out_path, label):
    """Phase 5: re-create, verbatim, every live policy whose expression names a grant table."""
    policies = live_policies(out_path)
    hits = []
    for (table, name), (f, st) in sorted(policies.items()):
        if table in ('master_shares', 'master_assistants'):
            continue  # the retired tables' own policies travel with them on rename
        texts = [RawStream()(x) for x in (st.qual, st.with_check) if x is not None]
        if GRANT_TABLES.search(' '.join(texts)):
            hits.append((table, name, f.split('/')[-1], st))
    lines = [
        f'-- ---- {label}: policies re-bound to the master_assistants / master_shares VIEWS ----',
        f'-- GENERATED by scripts/one-company-policy-sweep.py --rebind — {len(hits)} policies, bodies byte-identical to',
        '-- their live definitions; DROP + CREATE only so the parsed expression points at the view (a policy',
        '-- expression binds relations by OID, so a renamed table would otherwise still be read).',
        '',
    ]
    for table, name, src_file, st in hits:
        lines.append(f'-- {table}.{name}  (from {src_file})')
        lines.append(f'DROP POLICY IF EXISTS {qident(name)} ON public.{qident(table)};')
        lines.append(render_verbatim(st))
        lines.append('')
    open(out_path, 'w').write('\n'.join(lines))
    parser.parse_sql(open(out_path).read())
    print(f'wrote {out_path}: {len(hits)} policies re-bound on {len({t for t, *_ in hits})} tables')

def main():
    if sys.argv[1] == '--rebind':
        rebind(sys.argv[2], sys.argv[3])
        return
    out_path, label = sys.argv[1], sys.argv[2]
    policies = live_policies(out_path)
    swept = []
    for (table, name), (f, st) in sorted(policies.items()):
        if table in SKIP_TABLES:
            continue
        texts = [RawStream()(x) for x in (st.qual, st.with_check) if x is not None]
        if not MARK.search(' '.join(texts)):
            continue
        swept.append((table, name, f.split('/')[-1], st))
    tables = sorted({t for t, *_ in swept})
    lines = [
        "SET lock_timeout = '3s';",
        '',
        f'-- {label} — One company, Phase 2: the mechanical policy sweep.',
        '--',
        '-- GENERATED by scripts/one-company-policy-sweep.py — do not hand-edit; re-run the script.',
        f'-- {len(swept)} permissive policies on {len(tables)} tables still reasoned about per-person ownership',
        '-- (master_user_id = auth.uid()) or adoption / sharing (master_assistants, master_shares and their',
        '-- helpers) inline, so Phase 1 (20260906190000, helpers → is_office_staff()) did not reach them.',
        '-- Each is dropped and re-created with the SAME command, roles and expression, wrapped as',
        '--     USING (public.is_office_staff() OR (<old expression>))',
        '-- so office roles (dev, master/leader, assistant, controller) pass outright while every',
        '-- field / primary / superintendent / customer-side branch is byte-for-byte what it was.',
        '-- Skipped: users (Phase 1 helpers), master_shares (dormant), every restrictive policy.',
        '--',
        '-- Tables: ' + ', '.join(tables),
        '',
    ]
    for table, name, src_file, st in swept:
        lines.append(f'-- {table}.{name}  (from {src_file})')
        lines.append(f'DROP POLICY IF EXISTS {qident(name)} ON public.{qident(table)};')
        lines.append(render(st))
        lines.append('')
    open(out_path, 'w').write('\n'.join(lines))
    # self-check: the file must parse
    parser.parse_sql(open(out_path).read())
    print(f'wrote {out_path}: {len(swept)} policies on {len(tables)} tables')
    cmds = {}
    for _, _, _, st in swept:
        cmds[st.cmd_name or 'all'] = cmds.get(st.cmd_name or 'all', 0) + 1
    print('by command:', cmds)

if __name__ == '__main__':
    main()

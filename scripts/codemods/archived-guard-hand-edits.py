"""
The seven hand edits of the archived-guard sweep (punch list #256, PR 7b): the functions the codemod
scripts/codemods/archived-guard-sweep.mjs leaves alone, each with an exact anchor that must be found once, so a function
that moved on main fails loudly here and is edited by hand. Two dry-run helpers answer a boolean (an archived dev may
not dry-run); two functions make their service client only when the key is set; three read the caller in one block
and make the client in another. Run after the codemod, from the repo root:

    python3 scripts/codemods/archived-guard-hand-edits.py [supabase/functions]
"""
import sys
root = sys.argv[1] if len(sys.argv) > 1 else "supabase/functions"
IMPORT = "import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'\n"
IMPORT_IS = "import { isArchivedCaller } from '../_shared/refuseArchivedCaller.ts'\n"
def add_import(s, line):
    import re
    ms = list(re.finditer(r"^import\s[\s\S]*?['\"][^'\"\n]+['\"];?[ \t]*\n", s, re.M))
    at = ms[-1].end() if ms else 0
    return s[:at] + line + s[at:]
def edit(slug, old, new, imp=IMPORT):
    p = f"{root}/{slug}/index.ts"
    s = open(p).read()
    assert s.count(old) == 1, (slug, old[:60], s.count(old))
    s = s.replace(old, new, 1)
    if imp.split(' from ')[0] not in s: s = add_import(s, imp)
    open(p, 'w').write(s)
    print('hand:', slug)

# The two dry-run helpers answer a boolean: an archived dev may not dry-run.
for slug in ['bridge-weekly-sheet', 'messages-nudge-dispatch']:
    edit(slug,
"""  const { data: u } = await caller.auth.getUser()
  if (!u?.user) return false
""", """  const { data: u } = await caller.auth.getUser()
  if (!u?.user) return false
  if (await isArchivedCaller(admin, u.user.id)) return false
""", IMPORT_IS)

# driving-distance: the service client may be absent (no key), so the guard runs when it is there.
edit('driving-distance',
"""  const admin = serviceKey.length > 0 ? createClient(supabaseUrl, serviceKey) : null
""", """  const admin = serviceKey.length > 0 ? createClient(supabaseUrl, serviceKey) : null
  const archivedRefusal = admin ? await refuseArchivedCaller(admin, user?.id, corsHeaders) : null
  if (archivedRefusal) return archivedRefusal
""")

# notify-estimator-request: the caller is read in the signed-in branch and kept as userId; the admin client comes later.
edit('notify-estimator-request',
"""    const adminClient = createClient(supabaseUrl, serviceRoleKey)
""", """    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const archivedRefusal = await refuseArchivedCaller(adminClient, userId, corsHeaders)
    if (archivedRefusal) return archivedRefusal
""")

# send-physical-invoice-email: no service client of its own until a late best-effort log; one for the guard.
edit('send-physical-invoice-email',
"""    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
""", """    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const serviceKeyForGuard = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const archivedRefusal = serviceKeyForGuard ? await refuseArchivedCaller(createClient(supabaseUrl, serviceKeyForGuard), user.id, corsHeaders) : null
    if (archivedRefusal) return archivedRefusal
""")

# send-workflow-notification: the admin client may be absent (no key).
edit('send-workflow-notification',
"""    const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null
""", """    const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null
    const archivedRefusal = adminClient ? await refuseArchivedCaller(adminClient, user?.id, corsHeaders) : null
    if (archivedRefusal) return archivedRefusal
""")

# sync-mercury-transactions: the caller is read in the signed-in branch; the key is checked above it.
edit('sync-mercury-transactions',
"""      } = await userClient.auth.getUser(token)
      if (authErr || !user) {
        return jsonResponse({ error: 'Invalid session' }, 401)
      }
""", """      } = await userClient.auth.getUser(token)
      if (authErr || !user) {
        return jsonResponse({ error: 'Invalid session' }, 401)
      }
      const archivedRefusal = await refuseArchivedCaller(createClient(supabaseUrl, serviceKey), user.id, corsHeaders)
      if (archivedRefusal) return archivedRefusal
""")

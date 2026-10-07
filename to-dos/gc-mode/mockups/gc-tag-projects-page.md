---
name: "GC tag on the Projects page: a GC project says so there, opens on GC projects, and never gets a plumbing workflow"
rows: door-1-new-project.md, better way 3; PLAN_2026-10-07.md, Helper 6's row
branch: the plan on spike/gc-tag-plan (from origin/spike/gc-mode at ecbee8c34); the PR from origin/main after door 1 (#4852) merges, one PR, no migration at my default
status: plan 2026-10-07 by Helper 6 at the lead's ask. Nothing cut or claimed. Two calls for the lead; call B may go to the owner.
---

# GC tag on the Projects page

## Why it is more than a tag

A GC project is a `projects` row plus its `gc_projects` row (decision 1). So `/projects` lists it
beside the plumbing projects for the office: the test project is there today, and every real one
will be after door 1. Reading main shows two problems behind the missing tag:

1. **Opening it makes a plumbing workflow.** A row on `/projects`, and its name, open
   `/workflows/<id>`. On load, the Workflow page's `ensureWorkflow`
   (`src/hooks/useWorkflowStepsEngine.ts`) finds no `project_workflows` row and **inserts a draft
   one**.

   So one curious click files a GC project as a plumbing job with an empty workflow. From then on
   it shows wherever workflows are read, the Dashboard's projects and stages among them.

   About twenty components link to `/workflows/<id>`: Customer profile's project list, the
   Dashboard's projects card, the Forecast tabs, search and others. The tag alone cannot close
   that door. **The guard has to sit on the Workflow page.**
2. **Delete cascades.** The row's pencil opens Edit project, whose delete removes the `projects`
   row. `gc_projects` and everything under it go with it (`ON DELETE CASCADE`): the trades, the scope
   lines, the sets and the questions. That is fine for the test rows (call 13). A leader should
   still know what the press takes.

## What changes

**On `/projects` (`src/pages/Projects.tsx`):**

- The query embeds the GC side: `.select('*, customers(name), users!projects_master_user_id_fkey(…),
  gc_projects(project_id)')`. A row is a GC project when that embed is not null. RLS answers for
  the GC team (`gc_office_team()`, door 1). A superintendent never sees a GC project's row anyway:
  it has no master and no assignment.
- A GC project's row carries a chip after its number: **GC**, the switch's violet. Its hover says
  *A GC project. It opens on GC projects.*
- Its name and its row open `gcProjectHref(id)`, not `/workflows/<id>`. The row's hover says
  *Open on GC projects*.
- **Edit project's delete** on a GC project says what it takes, one line above the button: *This is
  a GC project. Deleting it also deletes its trades, scope lines, sets of plans and questions.*
  It is shown only when the project is a GC project. The modal reads the same embed.

**On `/workflows/<id>` (`src/hooks/useWorkflowStepsEngine.ts`, `src/pages/Workflow.tsx`):**

- `ensureWorkflow` reads `gc_projects` for the project with the workflows, in parallel, before
  it would insert. When the row is there it **inserts nothing**, returns null and sets
  `gcProjectId`.
- The page then shows one plain card in place of the stages:

  ```
  This is a GC project.
  Its plans, trades and questions are on GC projects.
  [ Open it on GC projects ]
  ```

  It covers every door into `/workflows/<id>`, not only the Projects page.
- A role that cannot read `gc_projects` gets the old path. No such role can see a GC project's
  `projects` row today, so there is nothing to guard for it.

**On `/gc` (`src/pages/GcProjects.tsx`):**

- `gcProjectHref(id)` is `/gc?focus=<id>`, in `src/lib/gc/access.ts` beside `canOpenGcProjects`.
- With `focus`, the page scrolls that project's card into view once loaded, and outlines it for two
  seconds, the way **just made** turns its chip green.
- B3-a moves the card onto a project's own page. Then it changes `gcProjectHref` and nothing else,
  so every link follows.

**Not in this PR:** the other lists that show a project (Customer profile's projects, the
Dashboard's projects card, search). They reach the Workflow page's card, which sends them on. Each
can learn the chip later from `gcProjectHref` and the same embed.

## Two calls for the lead

**A. Where a GC row goes.** *My default:* straight to `/gc?focus=<id>`. *The other way:* keep
`/workflows/<id>` and let the Workflow page's card send people on. That is one click more, but
every list behaves alike.

**B. A guard in the database too.** *My default:* no, the client guard only, and no migration. A GC
project may one day want a workflow. Decision 1 lets a job we win link to its `projects` row, and
our own crew's plumbing runs from its Pipeline job (G-51). So a hard refusal is the owner's word to
give, not mine. *The other way:* a `BEFORE INSERT` trigger on `project_workflows` that refuses a
GC project, *This is a GC project. It has no plumbing workflow.* That would be a migration in the
next day's batch. `project_workflows` is read all day, so it goes in the evening.

## Before the cut: one read on prod

Has a curious click made a workflow on the test project already? The lead runs, read only:

```sql
select w.id, w.name, w.status, w.created_at
from public.project_workflows w
join public.gc_projects g on g.project_id = w.project_id;
```

If a row comes back, it is a stray. It goes with the test rows under call 13, or alone on the
owner's word. The PR does not delete anything.

## The words

Each passes `plainWordsFailures`:

- *A GC project. It opens on GC projects.* (the chip's hover)
- *Open on GC projects* (the row's hover)
- *This is a GC project.* / *Its plans, trades and questions are on GC projects.* / **Open it on GC
  projects** (the Workflow page's card)
- *This is a GC project. Deleting it also deletes its trades, scope lines, sets of plans and
  questions.* (Edit project's delete)

## Tests

- **`src/lib/gc/access.test.ts`**: `gcProjectHref`.
- **`Workflow.render.test.tsx`**: a GC project shows the card, and `project_workflows` gets no
  insert. A plumbing project still gets its draft workflow, so the old path is pinned too.
- **`GcProjects.render.test.tsx`**: `?focus=<id>` scrolls to that card.
- **The Projects page**, a render case: a row with the embed shows **GC**, and its name links to
  `/gc?focus=<id>`.

## Docs

- `PROJECT_DOCUMENTATION.md`: §20, and the Projects section, one line.
- `GLOSSARY.md`: the *GC project* entry says it shows on Projects with a GC tag.
- The guide `start-a-gc-project` gets one line: *A GC project also shows on Projects, tagged GC.
  Press it to come back here.*
- A release note and its fragment. No `ACCESS_CONTROL.md` change, since nobody gains or loses a
  door.

**Checks before arming:**

- vitest on `src/lib/gc`, `src/pages/Projects`, `src/pages/Workflow`, `src/pages/GcProjects`,
  `src/lib/helpGuide` and `src/lib/releaseNotes`;
- eslint;
- the theme check;
- typecheck;
- the dev server on 5306:
  - `/projects` shows the test project tagged **GC**, and pressing it lands on its card on `/gc`;
  - `/workflows/<the test project's id>` shows the card. The browser's network log shows no
    `POST` to `project_workflows`.

## Is this the best we can do?

Three ways it could be better:

1. **Teach the other lists too.** Customer profile's projects and the Dashboard's projects card
   could carry the same chip and link. They would read one small hook, `useGcProjectIds()`, a
   single `gc_projects` select under RLS, so no list repeats the embed. The Workflow page's card
   already keeps them safe. This only saves a click.
2. **Say "GC" on the customer, too.** Our customer on a GC project is an ordinary customer row, and
   Customer profile cannot tell a GC customer from a plumbing one. A line, *GC projects: 1*, with
   the link, would show the office both relationships at once. It needs no new data.
3. **Make Edit project know a GC project.** Today it edits the name, the address and the customer,
   which are fine. Its other fields, such as the Housecall Pro number,
   mean nothing for a GC project. A GC row could open a smaller editor on `/gc` instead. That
   belongs with B3-a's project page, so it waits for it.

## Status

Planned 2026-10-07 by Helper 6. Read:

- `Projects.tsx`: the query, the row and its links;
- `useWorkflowStepsEngine.ts`: `ensureWorkflow` and the load that calls it;
- the links into `/workflows/<id>` across `src/components` (about twenty files);
- `gc_projects`' foreign keys in `database.ts`;
- `GcProjects.tsx`.

Waiting on the lead's calls A and B and on door 1's merge. Before the cut, the lead runs the one
read on prod.

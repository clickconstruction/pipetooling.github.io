---
name: "Intro to HVAC: built and on for everyone; the licensed read, the learner walks and one redeploy are left"
number: 419
group: close
status: built and live 2026-11-21 in six PRs (v2.8158, v2.8163, v2.8168, v2.8169, v2.8209, v2.8239); On in Settings → Training since 2026-11-22 01:43Z on Taunya's word, offered to every role and required of nobody · left: a licensed HVAC reader's read, the walks below, and the twin-mcp redeploy that waits on her go by name
summary: >
  The fourth training course, thirty five-minute lessons on how a house is cooled and heated,
  where the heat, the air and the water go, for the people who work on it or beside it. HVAC is
  the company's trade, so the lessons instruct, except that opening a refrigerant loop always
  names the carded technician. Taunya asked for it on 2026-11-20 and said to build it whole
  with no card. This card opened on 2026-11-22 at her ask to record what is left to walk.
next: >
  Walk the live course read only at 768 and 1280 px in light and dark, and at 390 px in dark,
  reading every lesson's Check yourself questions and all 47 drawings. No press is needed and no
  go is owed. Then the learner walk on a test account, below.
size: S as walks and loose ends; the reader's corrections are unsized until the read
blocker: A licensed HVAC reader, not yet named. The twin-mcp redeploy waits on Taunya's go by name.
ver: v2.8158 · 8163 · 8168 · 8169 · 8209 · 8239
opinion: your call — the course is built, checked by its tests and read live; what is left is a licensed read and walks as a learner
mockup: not required — walks and loose ends only; the course page is built and live
---

# Intro to HVAC (#419)

Taunya, 2026-11-20, after reading the plan: *HVAC is the company's trade … let's build the entire thing, testing along the way, always asking ourselves is this the best we can do*. She said to build it with no card. Then, once the four parts were merged: *it's really important to me you do a pass live to look for any discrepancies or any words or any areas where we didn't do a good enough job showing instead of telling*. On 2026-11-21 she said *switch on the course for everybody*.

## What was built

- **v2.8158** (#9203): the drawing language, Start here and Part 1 *Heat out*, and the seed row `intro-hvac`, off, offered, required of nobody, good for 120 months (migration `20261121074500`, pushed).
- **v2.8163** (#9223): Part 2 *Heat in and air*.
- **v2.8168** (#9233): Part 3 *Under conditions*, the strips.
- **v2.8169** (#9241): Part 4 *On the job*, the course whole at thirty lessons and a final bank of forty-four. The guide `take-a-training-course` names the course.
- **v2.8209** (#9266): the second pass from the live read. Seventeen more drawings for facts that were words alone, five drawings put right, and wording and discrepancy fixes. The course parser now refuses a second bold in a Numbers line, which the live page drew as raw asterisks.
- **v2.8239** (#9308): the unfilled *Read by* note taken off the first screen of this course and of Intro to electrical, and the docs that said the course stays off put right.

The course is thirty lessons and forty-seven drawings. The files are `src/content/training/intro-hvac/`, the drawings `src/components/training/figures/` with their parts in `hvacParts.tsx`. The trade words are in `COURSE_TRADE_TERMS['intro-hvac']`, and `cardWorkFailures` holds the refrigerant rule. The live pass's notes are in the fragments of v2.8209 and v2.8239.

## Left to do and to walk (2026-11-22)

### What was read live, and how

- All thirty lessons were read on clicktooling.com as the dev, a preview while the course was off. Lessons 1 to 18 were read at 19:05Z on 2026-11-21 and 19 to 25 at 20:50Z. Lessons 26 to 30 were read first on the dev page and then live once Part 4 deployed.
- After v2.8209 deployed, a script read all thirty again on the live page at 390 px. It checked every label of all 47 drawings: none leaves its drawing, no two overlap, there is no raw markup and no sideways scroll. The theme was the pane's own, not set to dark.
- Those reads covered Why it matters, Must know, Traps and Numbers. Check yourself and the final check were never read live.
- Every drawing was pictured once on a scratch page, in light at 420 px and in dark at 340 px.
- After v2.8239 deployed, both courses' first screens were read live, and neither shows *Read by*.

### Walks owed

- **The course at every width, read only.** `/training/intro-hvac`, as the dev or any account. Read it at 768 and 1280 px in light and dark, and at 390 px in dark. Every lesson, every drawing's labels and colours, and every lesson's four Check yourself questions should read whole. Not walked because only 390 px was read live, and dark only on the scratch shots.
- **The learner's walk.** As a test account in a role the course is not required of, a helper or a subcontractor, at 390 px and on a desk. The Dashboard's Training card should list *Intro to HVAC* under **Available** with **Start**. Inside, a wrong pick should say why and **Try again** should reshuffle. Four right should pass a lesson, and the rail should read *1 of 30 lessons*. The final check should draw twenty and pass at fourteen, a miss should draw twenty new, and a pass should show with no colour and no clock. Afterwards Settings → Training should read *1 took it*. Not walked because every press writes a pass for whoever is signed in. It needs a ZZ test account, or the sample account by View as with its rows deleted after.
- **Each role sees it.** The catalog row was read as the sample helper and the sample subcontractor through the dev seat, and both see it on. The Dashboard card itself was not seen as any role but the dev.
- **A real phone.** Never opened on one.

### Loose ends

- **twin-mcp is behind main.** v2.8239 regenerated `supabase/functions/twin-mcp/briefs.ts` from `docs/twins/APP_DIRECTORY.md`. The redeploy from main was refused in auto mode because Taunya's words did not name this deploy. It runs on her go by name: `bash scripts/deploy-functions.sh twin-mcp` from a checkout at origin/main.
- **No PR is open.** All six are merged and deployed.
- **On before the read.** The course went on before any licensed HVAC person read it. A correction after the read reaches no one who passed it as an offered course, because **Everyone takes it again…** leaves an offered pass alone. That is a gap in the Training mechanism, not in this course.
- **The reader.** A licensed HVAC reader is not named. The plan asked for a Texas air conditioning contractor with the environmental air endorsement who holds the EPA card. Each correction is one commit whose `from:` line names the reader. The reader's name and the code edition then go on `course.md`'s `line`, which v2.8239 left with no blank.
- **Facts not yet checked.** The `from:` lines of eighteen lessons say all or part is general trade knowledge not yet checked: lessons 1 to 6, 10, 11, 14, 16 to 21, 24, 28 and 29. They are the reader's first stops.
- **The code.** The lessons' numbers are the 2024 model code's. The book, edition and amendments of the cities the company works in are not named.
- **The company's own rules.** In lesson 27, where the line falls between the trades on the condensate drain, the gas line and the flue is for the company's master plumber and the reader to write.
- **Seen and left on purpose.** Lesson 30's first Must know repeats its Why. Lesson 29's house drawing has no line set, which lesson 6 draws. Lesson 26 draws only the three cards, since the licence classes and the endorsement are papers. Lesson 30's last three mistakes are drawn in their own lessons, 17, 9 and 24, not on lesson 30's drawing.
- **Card #120's next line** still says the reader's name and the code cycle fill a blank on Intro to electrical's line. v2.8239 took that blank off, so the name goes on as new words.

### Held to the plumbing and electrical courses' criteria

The same on: thirty lessons of five minutes in a Start here and four parts, 165 minutes; five sections a lesson; three Numbers a lesson, as electrical was cut to; four questions a lesson with a line for a right pick and a wrong one; every lesson's four right, then a final check of twenty at fourteen; good for 120 months; plain words held by test with no exemption; every trade word taught before it is used, sixty-nine of them, the rule in the test from the first PR; a drawing in every lesson; the shape, words and drawings held in CI; offered to every role and required of nobody, as electrical is; and the first page's words.

Not the same on:

- **Who checks it.** Plumbing had its read-through by the company's master plumber (v2.5619). Electrical has a named licensed reader whose read is still owed (#120). This course has no named reader.
- **What the facts stand on.** The plan asked for a code section with its edition, the textbook, or the reader on every lesson. Eighteen lessons rest in whole or part on trade knowledge not yet checked.
- **How the drawings were pictured.** Plumbing's were shot at 375, 768 and 1280 px in both themes. These were shot at 420 px in light and 340 px in dark, then read live at 390 px. The first walk above closes that.
- **The stance.** Plumbing instructs and electrical stops at *do not touch it*. This course instructs, as plumbing does, on Taunya's word that HVAC is the company's trade. One rule is held by test: work on a refrigerant loop names the carded technician.

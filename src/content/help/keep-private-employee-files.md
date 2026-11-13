---
title: keep private employee files
category: Office
roles: dev
keywords: hr, employee file, personnel, summary, narrative, raw entries, append only, people, notes
order: 46
---
People → HR keeps a private file on each person. Only devs can see this tab.

The files cover employees, helpers, subs, and office alike. Nothing in **People → HR** is ever visible to any other role.

Each person's file has three layers:

- **Summary** is the one-page read: trajectory, reliability, pay, watch items. The agent maintains it. You can edit it too.
- **Narrative** is the chronological story of their time with the company. The agent maintains it too. You can edit it as well.
- **Raw entries** are the dated facts everything else is built from. This is the only layer you write here.

## Add what happened

1. Open **People → HR** and pick the person. The dot next to each name tells you the file's state. {{chip:green|●}} means the summary is current. {{chip:yellow|●}} means entries are newer than the summary. {{chip:gray|●}} means no file yet.
2. Go to **Raw entries** and set the date it **happened**. That is not today's date, unless it happened today. Pick a source: Conversation, Payroll event, Incident, Review, Milestone, or Job event. Then write the fact.
3. Tap {{button:blue|Add entry}}.

:::example Good entry
"Sit-down about a fall raise and the path to Leader hours — agreed to revisit both at the November review." Dated the day of the conversation, source **Review**.
:::

Stick to facts with dates. If it is an impression, say whose: "my read after the call was…".

Write N§16 in an entry to point at section 16 of the narrative. On the Timeline it becomes a press that opens the narrative there. In the narrative's Jump to list, a cited section shows how many entries cite it. Press the count to see them.

## Entries can't be edited or deleted

That is deliberate. The raw log is trustworthy because nothing in it can be quietly rewritten. Made a mistake? You add a new entry that corrects the old one.

## Correct an entry

1. Find the entry on the **Timeline**.
2. Press *Correct this entry…* on its line. The entry box opens with that entry picked.
3. Leave the pick on *corrects* when the old entry is wrong. Change it to *completes* when the old entry is right and you are adding to it.
4. Write what is true. Set the day it happened.
5. Press {{button:blue|Add entry}}.

The old entry stays as it was written. Its line now shows *Corrected* with the day of the new entry. Press that chip to open the new entry. The new entry shows what it corrects.

A piece of evidence is corrected the same way. Its line carries *Correct this record…*.

Picked the wrong entry? Press ✕ beside the link on the new entry. Say why the link comes off. The link is taken off and kept on the record with your reason.

In the narrative's Jump to list, a count turns amber when an entry that cites the section was corrected since. Read the section again before you rely on it.

## See what someone signed

The strip at the top of the file counts their papers. {{chip:green|1 paper signed}} counts the papers they signed in the app. {{chip:yellow|3 papers owed}} counts the papers made for them and never sent.

1. Press {{chip:green|1 paper signed}}. The Timeline narrows to their papers.
2. Find the line that reads {{chip:gray|signed}}. The line names the paper and who signed it. Under it the line says how it was signed and when the office recorded it.
3. Press **Open the signed record ›** on the line. The signed record opens on People → Contracts with the agreement's words and the signing's facts.

Press the chip again to see the whole record. Every chip on the strip works the same way. {{chip:green|4 licenses on file}} narrows the Timeline to the licenses.

Their hours statements are on the Timeline too. Each line names the statement's number and its job. The chip says where it stands. {{chip:gray|hours statement · printed, not signed back}} means the paper went out and never came back. {{chip:gray|hours statement · signed back}} means it did. Press **Open the signed record ›** on a signed one. Press **Open the job ›** on the rest and find the sheet under Documents. {{chip:yellow|1 hours statement not signed back}} on the strip narrows the Timeline to them.

An agent reads the same list through the dev seat. The reply to get_person_file carries signed_papers with each paper, its day and its door. The reply carries hours_statements too, each with where it stands.

## Open a matter on a person

A matter is the analysis for counsel, kept apart from the record. The matter holds the narrative for the firm and the documents with what each one shows. The matter also holds the timeline of planned steps and recorded events. The Legal desk's matters stand on a customer who owes. This one stands on the person.

1. Open the person's file and go to **Matter**. Only a dev sees this view.
2. Press {{button:outline|Open a matter…}}. The matter stands on the person from then on. A {{chip:gray|Matter · Under review}} chip joins the top row of the file. Press the chip to come back here.
3. Write the narrative under **Narrative** and press {{button:blue|Save}}. Put each paper on **Evidence** with one line on what it shows. Plan a step or record what happened on **Timeline**.

Nothing on a matter reaches a law firm until the matter is released. The account tabs of the Legal desk do not appear here. There is no bill and no lien paper on a person.

## Keep a piece of evidence

A piece of evidence is a record on the person's file. The record holds the day it is about, a title, a memo on what it shows, and its files.

1. Open the person's file and go to **Evidence**. Press {{button:outline|Add evidence}}.
2. Set the day it is about. Give it a title. Write the memo: what it shows and why it matters.
3. Press {{button:outline|+ Pick files}} for a photo, a PDF, an email or a screenshot. Each file is under 10 MB. Photos shrink on the way in.
4. Press {{button:blue|Keep the evidence}}. The files are kept on the file and filed in Drive under People, the person, the day and the title.

A file over 10 MB, or one already in Drive, is linked instead. Put the file in the person's Drive folder. Then type its name under **Or a file already in Drive** and paste the Drive link. Press {{button:outline|+ Add the link}}. The link joins the list and the record counts it as in Drive. The chip reads *in Drive, linked* and opens the file.

Evidence is never edited or deleted. A mistake is corrected by a new record that says so.

Tick **Counsel-only** for a record the firm alone should hold. The record stays in the app only. The record is never filed in Drive. Devs can read it, and so can the dev seat their agents use. The HR agent's key cannot read it. The record wears a lock chip, and the Evidence tab gains a Counsel-only filter.

## Name a theme to look for

A long record is read by pattern, not by date. A theme is a plain name for one pattern. Dishonesty is a theme. Interference with the business is a theme.

Open Settings and pick People & teams. Find Themes on the record. Press {{button:outline|+ Add a theme}}. Give the theme a name. Write one line on what counts. Add counsel's words when the firm has some. Press {{button:blue|Add the theme}}.

Each theme shows how many things carry it. The line under it says how each mark proves the theme. A mark proves it by a document, by their own words, firsthand or relayed.

Press Edit to change the words in place. Press Retire when a theme is no longer useful. A retired theme keeps every mark made under it. Press Bring back to use it again.

:::example A theme the office keeps

Dishonesty. What counts: a statement the record shows to be untrue. Counsel's words: breach of the duty of loyalty.

:::

## Mark a theme on the record

A mark says one entry or one piece of evidence shows a theme. Every composer on the file has the same Themes strip. Press a theme to pick it. Say why it fits in a few words. Press how it proves the theme. The four grades are a document, their own words, a firsthand account and a relayed account.

Open Timeline. Press {{button:outline|+ theme}} under a line to mark one that stands already. Tick several lines to mark them at once. The bar at the bottom names the count. Press {{button:blue|Mark 3 lines}} and every ticked line carries the theme.

The Themes row above the line shows each theme with its count. Press a theme and the line shows only what carries it. Press ✕ on a mark to take it off. Give the reason. The mark stays on the record with that reason.

The agent can propose a mark. A proposed mark is drawn dashed. Press Keep to make it yours.

A matter carries the same strip. Record what happened and a paper waiting to be saved both show it. The marks read as chips on the matter's Timeline and Evidence.

:::example A mark on an entry

Entry: a trip taken after three refusals by phone that week. Theme: company money without say-so. Why it fits: refused three times, went anyway. Proves it by: a firsthand account.

:::

## Read the record by theme

A large record is worked one theme at a time. Open the By theme view beside Timeline, Evidence and Documents. Press a theme. The page holds only the items that carry it, oldest first. The counts at the top are what you tell counsel. Press strongest first to read the documents before the accounts. Press a grade under Show to narrow the list.

Press any item to open it in a window over the list. The window shows the whole entry or memo, its files and every theme on it. Press Next to move through the theme. Press Escape to close. The list is where you left it.

Press {{button:outline|Print this theme}} for paper. Press {{button:outline|Copy as a list for counsel}} to put the same words on the clipboard. The theme you picked sits in the address. Send the link and it opens the same view.

A matter reads by theme too. Open **By theme** on the Legal desk or on the person's **Matter** view. The items are the matter's papers and events. Press a paper in the window to open it. Press {{button:outline|Open on the matter ›}} to land on its row.

## Edit the summary or the narrative

The agent writes these two documents. You can change them too.

1. Open the person's file and go to **Documents**. The summary sits above the narrative. From the People list, the ⋯ menu on a person has **Open their HR file**.
2. Press {{button:outline|Edit the summary}} or {{button:outline|Edit the narrative}}. The text opens in a box, in markdown.
3. Change the words. The line under the box says what Save will do. Open **How it will read** to see it drawn.
4. Press {{button:blue|Save the narrative}} or {{button:blue|Save the summary}}. The prior version stays in the file's history.

Save is refused when someone saved the document after you opened it. The agent can do that from its seat. Copy your words, press {{button:outline|Cancel}}, open it again and bring them over.

A file with no summary yet shows {{button:outline|Write the summary}} instead. The agent can still build one from the line.

## Keep a named document

A file can hold other documents beside the summary and the narrative. A long account, a memo for counsel, a guide. Each has a title and its own history of prior versions.

1. Open the person's file and go to **Documents**. The named documents sit under the two the agent keeps.
2. Press {{button:outline|Write it}} to type one. Press {{button:outline|From a file (.md or .txt)}} to pick a file off your desk. Press {{button:outline|Paste text}} to paste one in.
3. Give it a title. From a file proposes one from the file's name. Tick **Counsel-only** for a document that never leaves the circle.
4. Press {{button:blue|Add the document}}. It opens on the file.

Press {{button:outline|Open}} on a document to read it. Long ones have a **Jump to** list of their sections. Press {{button:outline|Edit the document}} to change it. Save works as it does for the summary. Press {{button:outline|Copy as text}} to put the whole text on the clipboard. A counsel-only document has no copy press.

A file picked off your desk is read in your browser. Nothing leaves it until you press Add. The agent can change a named document too, one section at a time.

A transcript can name the recording it transcribes. Open the document and press {{button:outline|Transcribes…}}. Pick the evidence record from the list. The header then shows the record's title, its day and the start of its file's hash. Press it to open the record. The audio's chip sits beside it. The record's row on **Evidence** and its line on the **Timeline** show {{chip:gray|Transcript on file ›}}. Press it to open the document. A counsel-only record's transcript must be counsel-only too. The app says so and ties nothing.

## Keeping the summary fresh

When you add entries, the summary falls behind. The person's dot turns amber. The Documents view shows how many entries it has not covered. You ask the agent to bring the file current. It rewrites the summary and extends the narrative from the raw entries.

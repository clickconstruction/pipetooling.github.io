---
title: send an hr report about someone
category: Office
roles: master_technician, dev
keywords: hr report, report someone, pending reports, hr file, record, write up, observation, oldest first, age chip, needs you
---
Saw something worth remembering about a person, good or bad? Write it down while it is fresh.

Your Dashboard has an **HR Report** card. It sits near the bottom, just above **My Team**. It sends what you saw to HR, where it gets filed on that person's record. The same card also sits at the bottom of **Dispatch Mode**'s Dashboard tab, right below the Job Pipeline.

## Writing a report

Open the **HR Report** card and answer three questions:

1. **Who is this about?** Pick the person.
2. **When did it happen?** Give the date of the thing itself, not today. This is the date it will carry on their record.
3. **What happened?** Use plain words. Facts and dates hold up later. *"missed Tuesday and Thursday, third time this month"* beats *"unreliable."* If it is your read rather than a fact, say so.

Then hit {{button:blue|Send to HR}}.

:::example What a good report looks like
"No-show at Kingsbury this morning — crew waited 45 min, called 3 times, no callback. Robert covered the panel rough-in himself."
:::

Good news counts too. A line like "stayed late to finish the trim-out so inspection could happen Friday" belongs on a record. It belongs there just as much as a no-show.

## What happens after you send it

Your report waits in a **Pending reports** queue that only devs see. During review, it gets filed onto that person's HR record as a dated entry with your name on it. It is dated the day it happened, not the day it was filed.

:::example How the queue reads to the dev
The queue lists the **oldest report first**, and each one carries an age chip — {{chip:gray|today}} while it's fresh, {{chip:yellow|3 days waiting}} from day 3, {{chip:red|11 days waiting}} from day 7. Once the oldest report is 3+ days old, the dev's Dashboard **Needs You** card adds an **HR reports** item that says how old it is and opens the queue with {{button:blue|Open pending reports}} — so a report can't quietly sit under newer ones.
:::

Under the card, **Your recent reports** shows each report you have written with its status. {{chip:yellow|pending}} means it is waiting. {{chip:green|filed}} means it is on their record. {{chip:gray|closed}} means a dev set it aside with a reason. Nothing is deleted.

You only ever see your own reports. You do not see anyone else's, and you do not see the queue.

# sick-o-scope

A playful tracker for how sick a family has been, built for retrospective questions like "When was I last actually healthy?" and "Who had the roughest winter?". It records symptoms, not diagnoses.

## People

**Family**:
A group of people whose health data belongs together and is invisible to everyone outside it.
_Avoid_: Household, tenant, group

**Member**:
A person whose health is tracked, whether or not they ever sign in (for example a child). An archived Member is no longer offered for new Check-ins but keeps their history, which can still be corrected. (The German UI says "Familienmitglied", which reads naturally there.)
_Avoid_: Patient, person, tracked person, family member

**User**:
Someone who can sign in and log Check-ins for any Member of their Family.
_Avoid_: Account, login, member (as a role)

**Device**:
A phone or browser where a User is signed in. A User can have several, and each can be signed out on its own.
_Avoid_: Session, client

**Reminder**:
A daily notification on one Device, at a time of day chosen for that Device, sent only while an active Member still has a Gap on that day. Each Device has at most one. (The German UI says "Erinnerung".)
_Avoid_: Alarm, notification (as the setting)

**Sign-in link**:
A one-time link, created by a User and shared directly, that signs in a new Device: either for an existing User or for a new User joining the Family.
_Avoid_: Invite, magic link, login link

## Daily record

**Check-in**:
One Member's record for one calendar date, either Healthy or Sick.
_Avoid_: Daily entry, entry, log, record

**Healthy**:
A Check-in stating the Member felt fine that day. It is an explicit statement, never assumed. Healthy has no Severity; "almost well" (Severity 0) is still Sick.
_Avoid_: Severity 0 (as a word for Healthy)

**Sick**:
A Check-in with a Severity, zero or more Symptoms and zero or more Medications. Any Check-in that isn't Healthy is Sick, including "Meh" and "almost well" days.
_Avoid_: Ill, unwell

**Severity**:
How bad a Sick day was overall, on a rough scale from 0 (Almost well, such as a leftover runny nose) to 5 (Total disaster). It applies to the whole day, never to a single Symptom.
_Avoid_: Intensity, score

**Symptom**:
One complaint from a fixed, compact list (for example runny nose or fever), noted as part of a Sick Check-in.
_Avoid_: Diagnosis, illness, condition

**Medication**:
One remedy from a fixed, compact list (for example Ibuprofen or Nasenspray), noted as taken on a Sick Check-in. It records that a Member took it that day, never how much or how often; not ticked means not taken. (The German UI says "Medikament".)
_Avoid_: Medicine, drug, treatment, Medikation

**Badge**:
The picture that stands for a Symptom or a Medication.
_Avoid_: Icon, sticker

**Bug**:
One illness of one Member: their Sick days from the day it starts to its last Sick day, Gaps in between included (they stay unknown, never Sick). A Bug starts on a Sick day whose previous Check-in, skipping Gaps, wasn't Sick, or on a Sick day marked as a new Bug; a Healthy day always ends it. A Member has at most one Bug at a time, and a Bug always belongs to one Member alone. It counts for the Season it started in. (The German UI says "Infekt".)
_Avoid_: Illness, infection, episode, Käfer

**Gap**:
A Member and date with no Check-in. A Gap is unknown, never Healthy.
_Avoid_: Missing entry, blank, healthy-by-default

## Derived views

**Streak**:
A run of consecutive days with the same status: Healthy or Sick for one Member, or everyone Healthy for the Family. A Gap ends a Streak.
_Avoid_: Episode, spell, run

**Logging Streak**:
A run of consecutive days on which every active Member of the Family has a Check-in, whatever its status. It rewards honest logging, not health. (The German UI says "Lückenlos".)
_Avoid_: Check-in streak, completeness

**Milestone**:
A length of the everyone-Healthy Streak or the Logging Streak worth celebrating, like 7 or 30 days. Each Device celebrates it once, while it's still news.
_Avoid_: Achievement, goal

**Family wave**:
A time when Bugs of at least two Members overlap or follow closely on each other, with at most 5 days between one Bug's last Sick day and the next one's start. It says when and who, never who passed a Bug to whom. (The German UI says "Welle".)
_Avoid_: Outbreak, epidemic, infection chain, patient zero

**Award**:
A playful title a Member earns in a Season from its Check-ins, shown live during the Season and final afterwards. Every Member with Check-ins in a Season earns at least one, and none is framed as losing. (The German UI says "Auszeichnung".)
_Avoid_: Badge, trophy, achievement, ranking

**Season**:
The year from 1 September to 31 August, labelled like "2026/27". Every day belongs to exactly one Season.
_Avoid_: Winter, cold season (as data terms)

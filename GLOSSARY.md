# sick-o-scope

A playful tracker for how sick a family has been, built for retrospective questions like "When was I last actually healthy?" and "Who had the roughest winter?". It records symptoms, not diagnoses.

## People

**Family**:
A group of people whose health data belongs together and is invisible to everyone outside it.
_Avoid_: Household, tenant, group

**Member**:
A person whose health is tracked, whether or not they ever sign in (for example a child). An archived Member no longer gets Check-ins but keeps their history.
_Avoid_: Patient, person, tracked person, family member

**User**:
Someone who can sign in and log Check-ins for any Member of their Family.
_Avoid_: Account, login, member (as a role)

**Device**:
A phone or browser where a User is signed in. A User can have several, and each can be signed out on its own.
_Avoid_: Session, client

**Sign-in link**:
A one-time link, created by a User and shared directly, that signs in a new Device: either for an existing User or for a new User joining the Family.
_Avoid_: Invite, magic link, login link

## Daily record

**Check-in**:
One Member's record for one calendar date, either Healthy or Sick.
_Avoid_: Daily entry, entry, log, record

**Healthy**:
A Check-in stating the Member felt fine that day. It is an explicit statement, never assumed.
_Avoid_: Severity 0

**Sick**:
A Check-in with a Severity and zero or more Symptoms. Any Check-in that isn't Healthy is Sick, including "Meh" days.
_Avoid_: Ill, unwell

**Severity**:
How bad a Sick day was overall, on a rough scale from 1 (Meh) to 5 (Total disaster). It applies to the whole day, never to a single Symptom.
_Avoid_: Intensity, score

**Symptom**:
One complaint from a fixed, compact list (for example runny nose or fever), noted as part of a Sick Check-in.
_Avoid_: Diagnosis, illness, condition

**Badge**:
The picture that stands for a Symptom.
_Avoid_: Icon, sticker

**Gap**:
A Member and date with no Check-in. A Gap is unknown, never Healthy.
_Avoid_: Missing entry, blank, healthy-by-default

## Derived views

**Streak**:
A run of consecutive days with the same status: Healthy or Sick for one Member, or everyone Healthy for the Family. A Gap ends a Streak.
_Avoid_: Episode, spell, run

**Season**:
The year from 1 September to 31 August, labelled like "2026/27". Every day belongs to exactly one Season.
_Avoid_: Winter, cold season (as data terms)

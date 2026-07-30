# Rental billing — how the money is worked out

Read this against your own numbers. Anything marked ⚠️ is a place I had to assume
something; correct those and I will adjust before any code is written.

Everything below is per country, in that country's currency (Thailand = THB).
USDT only appears at the moment someone pays or withdraws.

---

## 1. Who is who

| | Pays or is paid | Signs in | Wallet |
|---|---|---|---|
| **Owner** | We pay them rent | Mobile app | THB, withdraws to their bank |
| **Agent** | We pay them rent | Back office | USDT withdrawal |
| **Customer** | Pays us rent | Back office | Tops up in USDT |
| **White label** | Takes 50% of the profit, funds half of each company | Back office (reports only) | THB |

Owner and agent are paid **separately**, never one through the other, so recovering
money from an agent can never touch an owner's rent.

---

## 2. Contracts

One table, three kinds (`customer` / `agent` / `owner`), because the fields overlap.

**On the contract (the header)**

| Field | Customer | Agent | Owner |
|---|---|---|---|
| Minimum term (months) | ✓ | ✓ | ✓ |
| Renewal minimum (months, default 3) | ✓ | ✓ | ✓ |
| Renewal window (days before expiry) | ✓ | ✓ | ✓ |
| Deposit (written, never collected) | ✓ | ✓ | — |
| Theft liability window (months) | — | ✓ | — |
| Start date | 1st of the month after binding | 1st after (account active + 14d) | same as agent |

**On each account line** — every account has its own terms, and they can change:

| Field | Customer | Agent | Owner |
|---|---|---|---|
| Base rent / month | ✓ | ✓ (may be zero) | ✓ |
| Turnover rate % | ✓ | ✓ (may be none) | — |
| Setup fee (one-off) | ✓ | — | — |
| White-label asking price | — used as the settlement basis — | | |

**Terms never change in place.** Editing a line writes a new version with an
effective date; old invoices keep pointing at the version that produced them.
⚠️ I am assuming a change takes effect from the **1st of the following month**.

---

## 3. The monthly run

Runs on the 1st, in the country's timezone. Two things happen.

**a) Base rent, billed in advance**

For every live account line: this month's base rent. A part-month is prorated by
days: `base × days_in_period ÷ days_in_month`.

**b) Turnover top-up, billed in arrears**

Once last month's turnover is submitted by the customer and approved by us:

```
charge = max(base_for_that_period, turnover × rate)
top-up = charge − base_already_invoiced      (only if positive)
```

So the base is a floor, and the turnover only ever adds. No turnover rate on a
line means no step (b) at all.

**Re-running is safe.** Each line is keyed by (contract line, period, kind), so a
second run adds nothing. A wrong price is fixed by cancelling the line and
re-running, which leaves both documents on the record.

⚠️ For the first few months the run produces a **draft** you approve before
anything reaches a customer.

---

## 4. Your two examples, month by month

Account: Kasikornbank ···1234. Went **active 10 March**.
Owner rent 30,000. Agent base 10,000 + 0.05%. Customer base 130,000 + 0.30%.
White-label asking price 80,000. Setup fee 20,000. March has 31 days.

Owner and agent both start on **account active + 14 days = 24 March** either way,
because that clock does not care about the customer.

### Example A — assigned 20 March, customer confirms the same day

Customer starts **21 March**. Term runs 1 April – 30 June (3 months).

**Invoice to the customer, raised 1 April**

| Line | Working | Amount |
|---|---|---|
| Setup fee | one-off | 20,000.00 |
| Rent 21–31 Mar (11 days, arrears) | 130,000 × 11/31 | 46,129.03 |
| Rent April (full month, advance) | | 130,000.00 |
| | | **196,129.03** |

**Owner and agent, raised 1 April**

| | Working | Amount |
|---|---|---|
| Owner 24–31 Mar (8 days) | 30,000 × 8/31 | 7,741.94 |
| Owner April | | 30,000.00 |
| Agent 24–31 Mar (8 days) | 10,000 × 8/31 | 2,580.65 |
| Agent April | | 10,000.00 |

Their stubs appear in the **April** run, not May, because a fixed amount needs no
turnover to be known — which is what you described.

**Turnover for the 21–31 March stub**, submitted and approved early April, say
12,000,000: `12,000,000 × 0.30% = 36,000`, below the 46,129.03 already billed, so
**no top-up**.

**April turnover** 50,000,000: `× 0.30% = 150,000` against 130,000 billed →
**top-up 20,000**, raised 1 May.
The agent's April turnover share: `50,000,000 × 0.05% = 25,000` against 10,000 →
**top-up 15,000** to the agent, same run.

### Example B — assigned 20 March, posted, so the standard 14 days applies

Customer starts **3 April**. Term runs 1 May – 31 July.

| When | Customer | Owner / Agent |
|---|---|---|
| 1 Apr | — | Owner 24–31 Mar 7,741.94 + April 30,000 · Agent 2,580.65 + 10,000 |
| 1 May | Setup fee 20,000 + rent 3–30 Apr (28/30 × 130,000 = 121,333.33) + May 130,000 | May full |
| 1 Jun | June + any April/May top-up | June full |

The customer's April stub only appears on 1 May, exactly as you said, while owner
and agent were already paid in April.

---

## 5. One account, one month, four ways

April, using the numbers above. The customer is one we brought in, so we charge
130,000 while the white label settles on their 80,000 asking price.

| | Amount | Note |
|---|---|---|
| Customer pays | 130,000 | |
| − Owner | 30,000 | cost |
| − Agent | 10,000 | cost |
| Profit on the asking price | 80,000 − 30,000 − 10,000 = **40,000** | settlement basis |
| **We take 50%** | **20,000** | our dividend |
| **White label takes** | **20,000** | |
| Markup above the asking price | 130,000 − 80,000 = **50,000** | entirely ours |
| **Our total** | **70,000** | 20,000 + 50,000 |

If the white label had placed the customer themselves at 80,000, the same 50/50
on 40,000 applies and there is no markup. If the white label uses the account
themselves, we instead take the fixed figure from their settings.

**Setup fee** 20,000 is profit and splits on the same 50% — 10,000 each.

We take a dividend, so **losses are not ours**: a bad debt or a compensation on
one of their customers comes off their side. Our own customers are our own risk.

---

## 6. Companies

No cost is stored on a company. Two independent records:

- **What the white label put in** — a wallet debit, taken when the company reaches
  **Registered**, referencing that company. Half the figure we quote them (quote
  60,000 → debit 30,000). Immutable, so changing the quote later rewrites nothing.
- **What we actually spent** — one or more expense entries (registration, lawyer,
  stamp duty) tagged to the same company, entered when paid.

Profit on a company is therefore always derived: `their contribution − our expenses`.

A white label must keep a minimum prepaid balance (set in the back office, e.g. 10
companies' worth). Below it, their agents cannot register new companies.

---

## 7. Tickets, and when the money stops

```
Customer reports a problem on an account
        ↓
CS triages and assigns to: Owner · Phone CS · Customer
        ↓
Assignee acts within the window (default 14 days, configurable)
and uploads evidence — a call recording, a document, a photo
        ↓
CS reviews → "Handled (still unusable)" or "Resolved"
```

- **Acted in time** → everyone is billed and paid as normal, even if the account
  is still not working. It was not the owner's fault, so the customer has nothing
  to complain about.
- **Not acted in time** → from the deadline, that account stops billing: the
  customer is not charged, the owner and agent are not paid. We absorb it.
  Rent already collected is **not refunded**; the stop takes effect **from the
  following month**. The contract term keeps running.
- The freeze is applied **automatically** by the nightly check, and CS can lift or
  apply one by hand.

**Every ticket is chargeable**, priced per country × white label, with different
prices for a phone call and for sending the owner to the bank. The charge is
raised automatically when the ticket closes; CS can waive it. Charges collect
onto an invoice that can carry several lines.

If the balance on the account is above the escort threshold (set per white label
× country), the ticket cannot be assigned to the owner alone — an admin has to
name someone to go with them.

A case the customer cannot resolve within 30 days passes to us by force; what it
costs us is recorded and invoiced to them.

---

## 8. Theft — a worked example

Owner takes 500,000 from the account. Customer deposit 100,000, agent deposit
200,000, agent's liability window 6 months, company registered 2 months ago.

| | Working | Amount |
|---|---|---|
| We compensate the customer | capped at **their own** deposit | 100,000 |
| — paid by | offsetting their next invoices; if there is nothing to offset, transferred | |
| Agent owes us | capped at **their own** deposit | 200,000 |
| Agent also owes (inside the window) | company contribution + rent already paid to owner and agent, prorated | |
| — turnover-based rent | **not** prorated | |
| Recovered by | deducting from the agent's future rent; short of that, negotiated | |
| Owner's rent | **never touched** | |

Then every account under that company is **suspended and blacklisted**. Other
customers renting those accounts are innocent, so their lines are terminated with
unused rent refunded pro rata; a setup fee past its 30-day window is not refunded.

⚠️ The 500,000 itself is not recoverable through the system — only the capped
amounts above are. I have assumed you do not want the shortfall tracked as a
receivable against the owner.

---

## 9. Expenses

One ledger, because staff claims, devices and company costs all end up in the
same place:

- Category, amount, date, note, receipt attachment
- Tagged to any of: country · company · staff member · device · white label
- Staff claims are expenses that need approving before they count
- Devices have their own price list (model + our price, editable, new models can
  be added). Staff buys one and claims it; we charge the customer our price. The
  gap is profit.

---

## 10. What I would build first

Only enough to bill one real account for one month:

1. Customers, with a sign-in that shows them their accounts
2. Contracts with per-account lines and versioned terms
3. The monthly run, base rent only, with prorated first periods
4. Invoices the customer can see

**Not yet**: turnover declarations, wallets, USDT, tickets, claims, settlement.

Then run it against one real account for two or three months before layering the
rest on. The arithmetic in section 4 goes in as automated tests, so anything that
later breaks the maths fails loudly instead of quietly.

---

## 11. Every screen and every button

Grouped by who is looking at it. Existing pages are marked *(exists)* — the rest
are new.

### Us — the platform back office

**Customers** (new module)

| Screen | What is on it | Buttons |
|---|---|---|
| Customers list | ref · name · white label · accounts rented · live contract · owed · status. Filters: white label, status, belongs to | `+ New Customer` · ⚙ open |
| New Customer | White label **first**, then name, company name, contact, deposit, belongs to (their brand / us) | `Create Customer` |
| Customer detail | Profile, plus sections: Contracts · Accounts · Invoices · Tickets · Wallet | `Save` · `Issue Sign-in` · `Reset to 123456` · `Suspend` · `Delete` |

**Contracts** (new module, one list for all three kinds)

| Screen | What is on it | Buttons |
|---|---|---|
| Contracts list | ref · party · kind · term · start · end · accounts · monthly total · status. Filters: kind, white label, status, **expiring soon** | `+ New Contract` · ⚙ open |
| Contract detail — header | Party, minimum term, renewal minimum (3), renewal window days, deposit, theft window (agents) | `Save` · `Activate` · **`Start Early`** · `Renew` · `Admin Renew` · `Terminate` |
| Contract detail — account lines | One row per account: account · base rent · turnover % · setup fee · asking price · effective from | `+ Add Account` · ✎ (writes a new version) · `Remove Account` |
| Contract detail — history | Every version of every line, with dates and who changed it | — |
| Contract detail — invoices | Everything ever billed under it | ⚙ open |

`Start Early` is the button you described: the customer confirmed on the day, so
the clock moves off the default 14 days. `Admin Renew` only appears once the
renewal window has closed.

**Billing**

| Screen | What is on it | Buttons |
|---|---|---|
| Monthly Run | Pick the month. Draft table of every line for every party, with warnings (turnover missing, account frozen, wallet short) | `Generate Draft` · `Recalculate` · **`Approve & Issue`** · `Discard Draft` |
| Invoices | Filters: party, month, paid / unpaid / overdue | ⚙ open · `Export CSV` |
| Invoice detail | The stored snapshot — every number as it was, THB total, USDT total with the locked rate | `Mark Paid` · `Send Reminder` · `Cancel & Reissue` |
| Payouts (owner / agent) | What we owe out this month | `Approve` · `Export CSV` |
| Turnover Submissions | month · account · customer · declared · statement · status | `View Statement` · `Approve` · `Reject` (reason required) |

**CS console**

| Screen | What is on it | Buttons |
|---|---|---|
| Tickets | ref · account · customer · type · assigned to · deadline · **overdue** · status | ⚙ open |
| Ticket detail | Timeline of messages and evidence, account balance and last transaction as the customer filed them | `Assign to Owner` · `Assign to Phone CS` · `Assign to Customer` · `Upload Evidence` · `Mark Handled (still unusable)` · `Mark Resolved` · `Waive Charge` · `Freeze Account` · `Unfreeze` · `Needs Escort` |
| Ticket Types (settings) | name · default assignee · window days · phone price · visit price, per country × white label | `+ Add Type` · ✎ · 🗑 |

**Compensation** (theft — the word "claim" belongs to expense claims only)

| Screen | What is on it | Buttons |
|---|---|---|
| Compensation list | ref · account · company · amount · recovered · status | `+ Record Theft` · ⚙ |
| Claim detail | The compensation table from section 8, computed and shown before anything is committed | `Confirm Compensation` · `Blacklist Company` · `Recover from Agent` · `Close` |

**White labels** — added to the existing page

| Section | Fields | Buttons |
|---|---|---|
| Settlement settings | profit share % · own-use fixed fee · company quote · minimum prepaid companies · escort threshold | `Save` |
| Service prices | phone price · visit price, per country | `Save` |
| Wallet | balance, transactions | `Record Top-Up` · `Withdraw` |
| Settlements | monthly statement per country | ⚙ open · `Approve & Pay` |

**Expenses**

| Screen | What is on it | Buttons |
|---|---|---|
| Expenses | category · date · amount · tagged to (country/company/staff/device) · receipt · approved | `+ New Expense` · `Approve` · ⚙ · 🗑 |
| Device Models | model · our price | `+ Add Model` · ✎ · 🗑 |

**Owner withdrawals** *(exists)* — the staff account you mentioned uses this page:
the queue, tick several, `Mark Paid`, and `Export CSV` for the bank.

### White label — their own back office

| Screen | They can | They must never see |
|---|---|---|
| Dashboard | accounts, this month's earnings | — |
| Agents | `+ New Agent`, issue sign-in | — |
| Customers | `+ New Customer`, issue sign-in | pricing, invoices |
| Settlements | monthly statement on **their asking price** | our actual selling price |
| Wallet | balance, top up, company debits | our expenses, our real company cost |

The last column is enforced in the data layer, not by hiding fields — their pages
query a view that does not contain those columns at all.

### Customer — restricted sign-in

| Screen | What is on it | Buttons |
|---|---|---|
| My Accounts | every rented account, status, balance they last filed | `Report a Problem` |
| My Contracts | terms, dates, what is due | `Renew` (only inside the window) |
| Monthly Turnover | from the 1st, one row per account: amount + statement | `Submit` |
| Invoices | THB and USDT, due date | `Top Up Wallet` · view |
| Support | their tickets and replies | `+ New Ticket` · `Upload` · `Reply` |

### Owner — the mobile app

| Screen | What is on it | Buttons |
|---|---|---|
| My Company / My Accounts (new) | their company, every account, status | `Submit New Account` *(exists)* |
| My Contract (new) | read only, no signing | — |
| Tasks (new) | tickets assigned to them, with the deadline showing | `Upload Evidence` · `Mark Done` |
| Wallet *(exists)* | rent arrives here | `Withdraw` |

---

## 12. The whole thing, start to finish

**A new account comes on stream**

1. Owner submits the account in the app → we review and activate it *(exists)*.
2. An admin fills the white label's **asking price** on the account.
3. Owner and agent contracts are created; both start **14 days after activation**,
   so they are paid whether or not a customer is found. Nobody rents it yet, and
   we carry that cost — which is the pressure to place it quickly.

**A customer takes it**

4. `+ New Customer` → white label, name, deposit, whose customer it is.
   `Issue Sign-in` gives them a login.
5. `+ New Contract`, kind = customer → term, renewal rules, deposit → `+ Add Account`
   with the base rent, turnover % and setup fee for that account.
6. Default start is 14 days out. If the customer confirms on the day and the test
   is clean, press **`Start Early`** and pick the date.

**The 1st of the month**

7. `Generate Draft` → every line for every party, with warnings.
8. You read it, `Recalculate` if you changed a price, then `Approve & Issue`.
   Invoices go out with the USDT rate locked; owner and agent payouts are queued.
9. The customer sees the invoice and `Top Up Wallet`; the invoice settles from
   their balance.
10. Owners are paid from the withdrawals queue in THB; the staff account exports
    the batch for the bank. Agents withdraw in USDT.

**Something goes wrong with an account**

11. Customer presses `Report a Problem`, picks the type, describes it, and files
    **the current balance and last transaction** with a screenshot.
12. CS reads it and assigns — owner, phone, or back to the customer for documents.
    Above the escort threshold, `Needs Escort` and an admin names who goes along.
13. The assignee has the window (default 14 days) and must upload evidence — a
    call recording, a document, a photo.
14. CS marks `Mark Handled (still unusable)` or `Mark Resolved`. Either way, rent
    keeps running.
15. If the window passes with the owner not having acted, the nightly check freezes
    that account on its own. From the **following month** nobody is charged and
    nobody is paid; what is already collected stays. The term keeps counting.
16. Closing the ticket raises the service charge automatically — phone price or
    visit price — unless CS presses `Waive Charge`. It lands on the next invoice
    alongside anything else.

**Money goes missing**

17. `+ Record Theft` on the account with the amount and evidence.
18. The claim shows the whole calculation before you commit: capped at the
    customer's deposit for what we pay them, capped at the agent's deposit for what
    they owe us, plus — inside the agent's window — the company contribution and
    the rent already paid, prorated except for anything turnover-based.
19. `Confirm Compensation` posts it: credits against the customer's invoices,
    deductions against the agent's future rent. Owner rent is untouched.
20. `Blacklist Company` suspends every account under it. Innocent customers on
    those accounts have their lines terminated with unused rent refunded pro rata;
    a setup fee past 30 days is not refunded.

**Month end, upstream**

21. Customers file turnover with statements; we `Approve` each, and top-ups appear
    on the next run.
22. Each white label gets a settlement on their asking-price basis: 50% of the
    profit per account, less anything charged back for their own customers, less
    company contributions taken. `Approve & Pay`.
23. Our real spending sits in Expenses, so the true margin on a company — and on
    a device we sold on — is always the difference, never a stored guess.

---

## 13. What I still need from you

**The three assumptions marked ⚠️ above**

1. A change to an account's terms takes effect from the **1st of the following
   month** (§2). Anything else means part-months at two different prices.
2. The monthly run produces a **draft you approve** for the first few months,
   then goes automatic once it has proved itself (§3).
3. A theft above the caps is **written off**, not carried as a debt against the
   owner (§8).

**Two areas still thin — later batches, but worth deciding early**

4. **Devices.** A staff member buys one and claims it; we charge the customer our
   list price. Does that charge land on the customer's normal monthly invoice as
   another line, or on its own invoice? And is it tied to an account, or just to
   the customer?
5. **Staff claims.** Who approves them — anyone with the expenses permission, or a
   named approver? Does a claim need to be approved before it counts towards a
   company's real cost?

---

## 14. Build order

| Batch | Contents | Why in this order |
|---|---|---|
| **1** | Customers · contracts with versioned per-account lines · monthly run (base rent + prorate) · invoices · customer sign-in | The floor everything else stands on. Verified against one real account for two or three months. |
| **2** | Turnover declarations + approval · top-ups · wallets for all four parties · USDT rate with per-country markup | Money movement, once the arithmetic is trusted. |
| **3** | Tickets · service charges · auto-freeze · the owner's account / contract / task pages in the app | Operations. |
| **4** | Theft claims · recovery · blacklist cascade · white-label settlement · expenses · staff claims · device price list | Everything that only matters once real money is flowing. |

Section 4's arithmetic goes in as automated tests in batch 1, so later changes
that break the maths fail loudly rather than quietly.

## §15 Contract policy rework (2026-07-30, batch 6)

The owner and agent sides no longer use hand-written contracts.

**Owner terms hang on the owner.** The agent enters them when creating the
owner — rent per account, contract months, renewal months — and every account
the owner opens runs on them. The white label's Contract Policy bounds what an
agent may enter (rent min–max, minimum contract and renewal months); without a
policy, agents cannot enter terms at all. Changes are allowed at any time
(even for approved owners, via the Contract card) but cut in on the 1st of the
next month; months already billed never move. Platform staff are not bound.

**Agent conditions are a bank × channel table, per agent.** The white label
keeps a default template on /m/contract-policy; creating an agent copies it
onto them, and each agent's copy may then diverge (their page → Their
Conditions). A row: mode (rent only / turnover only / rent + turnover / rent
or turnover whichever higher), rent, turnover %, contract months (none for
pure turnover), renewal months, deposit. Liability window = contract months;
pure turnover has no contract, so the window stays open for as long as the
account is in use.

**Activation wires everything.** Approving a bank account (or creating one in
the back office) automatically: joins it to the owner's single billing
contract at the owner's current terms; and freezes the agent's matching row —
exact bank+channel first, else the bank's default row — into a per-account
agent contract with the row stored as a snapshot. No owner terms, or no
matching agent row → the approval is refused with the reason. Once an account
runs, its conditions never change; the only exit is terminating the contract.

**Engine modes.** rent = base only; turnover = share only, nothing billed in
advance; rent_plus_turnover = base in advance plus the whole share;
max = the customer model (base as floor). Turnover money is never prorated.

Manual contract creation remains for customers only.

## §16 Customer assignment, confirmation and renewals (2026-07-30, batch 7)

**Assignment.** The flow starts from an active account: assigning it to a
customer prices from the customer's own condition table — a copy of the
platform's Customer Defaults made at customer creation, negotiable per
customer, same bank × channel × mode shape as the agent table plus a setup
fee. The form has no price field. The matched row and the current T&C version
freeze onto the assignment (TH-ASG refs).

**Confirmation gate.** A customer with any unconfirmed agreement cannot enter
the portal: they read the conditions and the full fixed text, tick acceptance,
and the timestamp is recorded against that exact T&C version. The T&C is
versioned and immutable per country (white-label override reserved);
publishing is adding a version. Every agreement downloads as a PDF (Noto
fonts, Thai-capable) and old versions stay readable forever.

**Confirmation is not activation.** The delivery fork is set at assignment
(changeable until live): mail collects an address into the customer's reusable
address book; direct binding auto-opens a free ticket of the binding type
(ticket_types.is_binding). Billing starts the day after the account is marked
bound & working — and on day 14 after assignment regardless, confirmed or
not, applied by the sweep before every billing draft.

**Renewals.** Customers renew only by hand, in the portal, inside the window,
re-accepting the current T&C — recorded in contract_renewals. Outside the
window it is by agreement (admin). Owner and agent renewal is per white
label: auto (the sweep extends by the renewal months and records it) or
manual — meaning the platform confirms; until then an expired contract stops
billing. Owner/agent contracts now carry real end dates from activation
(pure-turnover agent deals have none).

**Termination.** An owner asks out from the app; the admin negotiates the
agent's compensation and must record it to approve — then every contract line
on the account ends today, single-party contracts terminate, the account
closes, and any open assignment is cancelled.

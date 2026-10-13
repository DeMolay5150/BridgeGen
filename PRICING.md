# BridgeGen — Go-to-Market Pricing & Value Positioning Strategy

> **Status:** Strategy draft, v1 (2026-10-12). Price points are recommendations to validate with customers, not final list prices.
> **Owner:** Founder / GTM lead.
> **Source of truth for product capabilities:** [`goal.md`](goal.md) and [`tasks/todo.md`](tasks/todo.md).

---

## 1. Executive Summary

BridgeGen is a **Private Company Decision Simulator**: *"See the systemic consequences before you make the decision."* It turns the hardest conversations in a family or founder-led business into something a room can see on one screen and test before committing. Those conversations cover debt, succession, control, governance, and what happens when things go wrong.

**Positioning in one line:**
> BridgeGen is the decision lab advisors use to show a private-company owner, in one meeting, what a capital or succession decision does to value, to the family, and to the business's ability to survive a shock.

**Go-to-market model: Trojan Horse.**
1. **Front door.** The interactive simulator wins the meeting. It's free to try as a public demo, with no login.
2. **System of record.** Saved client companies, confidential stakeholder rooms and repeat scenario work turn a demo into a recurring workflow, and that workflow is what customers pay for.

**Recommended pricing (launch list prices):**

| Tier | Who | Recommended launch price | Range |
|---|---|---|---|
| **Solo** | Independent advisors, fractional CFOs, estate planners | **$249 / month** ($2,490 / year) | $199–$299 / month |
| **Firm** | Boutique M&A banks, family offices, advisory practices (2–10 people) | **$699 / month** for 5 seats ($6,990 / year) | $499–$899 / month |
| **Enterprise / White-Label** | Private banks, multi-family offices, accounting networks, platforms | **From $24,000 / year** (typical deal) | $15,000–$35,000 / year |

**Why these numbers hold up:** a single middle-market advisory engagement is typically worth far more than a year of the Solo plan. The demo company alone surfaces **$22.5M of governance value at risk** and **$21.2M of avoidable loss** from one founder-incapacitation scenario. BridgeGen is priced as a small fraction of the value of **one** engagement it helps win, retain or expand.

---

## 2. Product Architecture → Value Map

Every module is live in the product today. Each one maps to a buyer outcome and to a proof point the advisor can show in a meeting. All figures are BridgeGen's own output for the built-in demo company: $40M revenue, $12M EBITDA, 8.0x multiple, $6M debt, a founder holding 80%, and a governance debt score of 78/100.

| Module | What it does | Buyer value (advisor) | Client "aha" moment (demo figure) |
|---|---|---|---|
| **Capital Allocation Flight Simulator** (`/simulator`) | Live levers for debt leverage, equity transfer to the next generation, valuation sensitivity, and an outside CEO, with instant enterprise value, equity, recap cash, coverage and risk signals. | Replaces the spreadsheet build before every meeting; makes the trade-offs physical. | A 3.0x dividend recap pays shareholders **$30.0M** today, but equity falls by the same **$30.0M** and interest coverage drops from **25.0x to 4.2x**. |
| **Economics vs. Alignment Dual-Matrix** | Plots each strategy by financial value (x-axis) against stakeholder consensus (y-axis), with support scores for Founder, Heir, Board and Lender. | Gives the advisor language for "good deal, bad family outcome", the reason most transitions fail. | Today the company sits in **"Value at odds"**: economics 54, alignment 30 with its current governance debt. Once governance gaps are closed, a gradual transition becomes the only preset in the aligned zone (70 / 51). |
| **Governance Debt Calculator** (`/governance`) | Nine weighted governance checks produce a 0–100 score, priced as a valuation discount (up to 30% of EV), with recoverable value per gap. | Converts "you should formalise your governance" into a dollar figure an owner acts on, which opens a recurring governance engagement. | Score **78/100**: **$22.5M** of value at risk. Documenting delegation of authority recovers **$3.5M** on its own. |
| **"Fork the Future" Timelines** (`/fork`) | Two branches side by side over 1, 3, 5 and 10 years: debt paydown, dividends, compounding governance-crisis risk, and shareholder value. | Shows that today's attractive option can be tomorrow's mistake, and justifies a multi-year advisory relationship. | Fixing governance is worth **+$20.3M by year 10**; a dividend recap trails "do nothing" by **$12.4M**. |
| **Multi-stakeholder Decision Room** (`/room`) | Per-stakeholder lenses and priorities, plus a private questionnaire answered through **confidential invite links**. The advisor sees only disagreements and misperceptions, never anyone's answers. | Surfaces what families won't say in the room, which is the highest-trust, highest-value moment of an engagement and hard to replicate with any other tool. | The founder assumes the heir wants to lead; the heir would welcome an outside CEO. **2 critical misperceptions and 3 deep disagreements** appear without anyone being named. |
| **Red Team Mode** (`/red-team`) | Stress-tests the decision against founder incapacitation, successor exit, a downturn, and all three combined. Finds the exact breaking points for coverage, leverage and equity. | Moves the advisor from cheerleader to fiduciary; creates urgency for protective work (governance, buy-sell agreements, key-person planning). | Founder incapacitation destroys **$30.5M**, of which **$21.2M** is avoidable with documented authority and succession. |
| **"Explain This Decision" (cross-cutting)** | Every headline number has an "Explain" card: the cause-and-effect chain with real figures, plus which lever drove it. Explanations come from fixed rules (no AI), so they are reproducible. | The advisor can defend every number to a client, a lender or compliance, which builds trust and protects the advisor's reputation. | "Debt is 3.0x × $12.0M EBITDA = $36.0M → $96.0M − $36.0M = $60.0M equity → Debt leverage 3.0x: −$30.0M." |
| **Saved companies and accounts** | Advisor sign-in; client companies saved with autosave; the public demo for anyone. | Turns a one-off demo into a system of record, which is the reason to keep paying. | Reopen any client's model where you left it, before the next meeting. |

**Product principle to sell on:** *glass-box, not black-box.* Every number is traceable, every assumption is visible, and confidential answers never reach the advisor's screen.

---

## 3. Target Audience

### 3.1 Segments and personas

| Persona | Typical firm | Core pain | What they buy BridgeGen for | Trigger events | Best-fit tier |
|---|---|---|---|---|---|
| **Middle-market business advisor** | Independent or small practice advising $10M–$250M revenue owners | Owners procrastinate on succession and capital decisions; discussions stay abstract | A meeting tool that makes the decision concrete and creates the next engagement | Owner approaching 60, a sibling dispute, a lender covenant review, an unsolicited offer | Solo → Firm |
| **Boutique M&A investment banker** | 2–15 person sell-side or capital-raise boutique | Deals die or re-trade late because of family misalignment and governance gaps found in diligence | Pre-mandate readiness work: governance debt, alignment and Red Team findings before going to market | Pitching for a mandate; a pre-sale readiness phase; a recap versus sale decision | Firm |
| **Family office director** | Single- or multi-family office ($100M–$1B+ AUM) | Next-generation engagement, control transitions, and governance between branches of the family | Confidential Decision Rooms across generations; long-horizon "fork" comparisons for the family operating company | Patriarch or matriarch health event, a generational transfer, family council formation | Firm → Enterprise |
| **Estate planner / estate attorney** | Estate and trust practice | Plans are legally sound but the operating business and family dynamics aren't modelled | Showing what equity transfers do to control, value and family consensus before documents are drafted | Gifting window, trust funding, buy-sell drafting | Solo |
| **Fractional CFO** | Independent, serving 3–8 portfolio companies | Board and owner conversations about leverage, distributions and resilience need fast, defensible analysis | Flight Simulator, Red Team breaking points and "Explain" cards for board packs | Refinancing, a distribution policy debate, a board meeting | Solo |

### 3.2 Ideal Customer Profile (first 12 months)
- **Firm size:** 1–10 advisors (Solo and Firm tiers), plus 2–3 lighthouse Enterprise partners.
- **Client base:** founder-led or family-owned companies, roughly $5M–$50M EBITDA.
- **Behaviour:** already charges for advice through retainers, project fees or success fees, and runs at least one owner-level strategy meeting per month.
- **Disqualifiers:** advisors who only sell products (no advisory fee); enterprises needing on-premise deployment today; buyers who expect formal valuation reports. BridgeGen is a decision simulator, not a valuation opinion.

---

## 4. Pricing Philosophy

1. **Price on value, anchor on one engagement.** Advisors don't buy software by the hour saved; they buy what wins, keeps or expands a client. Every price is presented next to the value of a single engagement (Section 7).
2. **The free public demo is the top of the funnel, not a free tier.** Anyone can use every module with the demo company, unsaved. Paying unlocks *your clients*: saving, confidential rooms and repeat work. This keeps the Trojan Horse intact without giving away the system of record.
3. **Value metric: active client companies plus seats.** Seats are what buyers expect to pay for. Active companies follow value delivered and grow naturally with success. Avoid charging per scenario or per click, which discourages exactly the experimentation that creates the "aha".
4. **Confidential Decision Rooms are the premium moment.** They're the hardest feature to copy and the highest-trust use. Include them in every paid tier but cap concurrent rooms on Solo, so heavy users move up.
5. **Simple, public prices for Solo and Firm; "from" pricing for Enterprise.** Self-serve below about $10k a year; sales-led above.
6. **Annual plans get two months free** (about 17% off). Annual billing improves cash flow and cuts churn in a relationship-driven category.

---

## 5. Pricing Tiers

### 5.1 Tier summary

| | **Solo** | **Firm** | **Enterprise / White-Label** |
|---|---|---|---|
| **For** | Solo advisors, fractional CFOs, estate planners | Boutique M&A banks, family offices, advisory teams | Private banks, multi-family offices, accounting networks, platforms |
| **Range** | $199–$299 / month | $499–$899 / month | $15,000–$35,000 / year |
| **Recommended list** | **$249 / month** or **$2,490 / year** | **$699 / month** or **$6,990 / year** (5 seats) | **From $24,000 / year** |
| **Seats** | 1 | 5 included (+$99 / seat / month) | 15+ (negotiated) |
| **Active client companies** | 15 | 75 | Unlimited (fair use) |
| **Concurrent confidential Decision Rooms** | 3 | 25 | Unlimited |
| **All six modules + Explain cards** | ✓ | ✓ | ✓ |
| **Saved companies with autosave** | ✓ | ✓ | ✓ |
| **Shared firm workspace (team access to companies)** | — | ✓ | ✓ |
| **Branded client exports (PDF meeting pack)** | — | ✓ | ✓ (white-labelled) |
| **White-label (your logo, colours, domain)** | — | — | ✓ |
| **SSO / SAML, audit log, data-residency options** | — | — | ✓ |
| **Calibration workshop (tune model assumptions to your practice)** | — | Add-on | ✓ |
| **Support** | Email, 2 business days | Priority email + quarterly success review | Named success manager, SLA |
| **Onboarding** | Self-serve + recorded demo script | 60-minute team onboarding | Implementation project and train-the-trainer |

### 5.2 Product readiness by tier (be honest in sales)

Some tier features **are not built yet**. Never sell a roadmap item as available; sell it as "included when released" with a date only once engineering commits to one.

| Capability | Status today | Needed for |
|---|---|---|
| Six modules, Explain cards, public demo | ✅ Available | All tiers |
| Advisor accounts, saved companies, autosave | ✅ Available | All tiers |
| Confidential Decision Room invite links (stakeholder answers never shown to the advisor) | ✅ Available | All tiers |
| Plan limits (companies, rooms, seats) and billing (e.g. Stripe subscriptions) | ⛔ Not built | **Launch blocker for paid self-serve** |
| Multi-seat firm workspace (roles, shared companies) | ⛔ Not built | Firm, Enterprise |
| Branded PDF meeting pack export | ⛔ Not built | Firm, Enterprise |
| White-label theming and custom domain | ⛔ Not built | Enterprise |
| SSO / SAML, audit log | ⛔ Not built | Enterprise |
| Production email (custom SMTP, confirmation on) | ⛔ Configuration pending | All tiers (launch blocker) |

**Implication:** launch with a **founding-customer programme** (Section 6.4). Sell Solo (fully deliverable today, once billing exists) and pre-sell Firm and Enterprise as design partners at a discount, with the missing capabilities written in as delivery milestones.

### 5.3 Tier rationale

**Solo, $249 per month.** Sits under the mental threshold for a monthly "expense, not a decision" for an advisor billing $300–$600 an hour, while staying well above commodity planning tools. Fifteen companies covers a solo practice's active owner relationships. Three concurrent rooms is enough to run real engagements but nudges multi-family or high-volume users to Firm.

**Firm, $699 per month for five seats.** That's $140 per seat, a team discount against Solo that rewards consolidation. The upgrade triggers are shared workspaces and branded exports, which are what firms need to standardise a client experience. Additional seats at $99 a month keep growth frictionless.

**Enterprise / White-Label, from $24,000 per year.** Priced for the platform value: the bank or network puts BridgeGen in front of hundreds of clients under its own brand. The range flexes with seat count, white-label depth, SSO and compliance needs, and implementation.
- $15k: entry white-label for a single office.
- $24k: typical, with 15–30 seats and SSO.
- $35k: multi-office, data-residency and calibration work.
- Above $35k: custom quote.

---

## 6. Packaging Details

### 6.1 Add-ons
| Add-on | Price | Notes |
|---|---|---|
| Additional Firm seat | $99 / seat / month | Same features as the Firm plan |
| Extra active companies (Solo) | $49 / month per 10 | Most heavy users should upgrade to Firm instead |
| Calibration workshop | $2,500 one-time | Tune governance weights, shock calibration and stakeholder priorities to the firm's methodology |
| Done-with-you first engagement | $1,500 one-time | A BridgeGen specialist co-runs the first client Decision Room |

### 6.2 Trials and the free experience
- **Public demo (free, forever):** every module, demo company only, nothing saved. This is the marketing engine; link it from every piece of content.
- **14-day Solo trial:** full Solo features, no card required. Convert at the moment of value: when the advisor tries to save a second client company or send a third stakeholder link.

### 6.3 Discounts and guardrails
- **Annual billing:** two months free.
- **Non-profit, academic and family-business associations:** 25% off Solo.
- **No ad-hoc discounting on monthly plans.** Enterprise discounts are traded for something (a multi-year term, a case study, a logo, or a reference call).

### 6.4 Founding-customer programme (first 50 firms)
- **Solo:** $199 per month locked for 24 months, in exchange for a feedback call and permission to cite anonymised usage.
- **Firm design partners (up to 10):** $499 per month locked for 24 months, plus early access to the firm workspace and branded exports.
- **Enterprise lighthouse partners (up to 3):** $15,000 in year one, with white-label delivered as a joint milestone plan; then list price.

---

## 7. ROI Anchoring

Always anchor in this order: **(1) value at stake for the client → (2) revenue for the advisor → (3) time saved.** Lead with the client's money, because that's what the advisor sells.

### 7.1 Lens 1: value at stake for the client (from BridgeGen's own output)
These figures come straight from the product for the demo company. In a live sale, replace them with the prospect's own client figures in the simulator.

| Finding | Value | Module |
|---|---|---|
| Governance value at risk (score 78/100) | **$22.5M** | Governance Debt |
| Loss from founder incapacitation | **$30.5M**, of which **$21.2M** avoidable | Red Team |
| Ten-year value of fixing governance | **+$20.3M** | Fork the Future |
| Ten-year cost of a 3.0x dividend recap versus doing nothing | **−$12.4M** | Fork the Future |
| Equity effect of the recap, shown on day one | **−$30.0M** equity, matched by $30.0M paid out | Flight Simulator |

**Talk track:** "BridgeGen doesn't create this value, your advice does. BridgeGen makes it visible enough that your client acts on it."

### 7.2 Lens 2: revenue for the advisor (illustrative; validate per prospect)
The assumptions below are **placeholders for a discovery conversation**, not market data. Fill them in with the prospect's own numbers.

| Input (ask in discovery) | Example placeholder |
|---|---|
| Average fee per owner engagement (governance, succession, recap or sale prep) | $25,000 |
| Owner meetings per month | 4 |
| Extra engagements won or expanded per year because owners act on what they see | 1 |
| Clients retained per year who would otherwise have stalled | 1 |

**Payback maths (Solo at $2,490 a year):**
- **One** extra $25,000 engagement a year → about **10× return** on the annual Solo price.
- Break-even is roughly a **$2,500 engagement**, about 4–8 billable hours for most advisors.

**Payback maths (Firm at $6,990 a year):**
- One extra $25,000 engagement → about **3.6×**. Two → about **7×**.
- Break-even is under one-third of a typical engagement.

**Payback maths (Enterprise at $24,000 a year):**
- Break-even is roughly **one** additional or retained family relationship at a private bank or multi-family office, where the annual relationship value usually exceeds the subscription. Confirm with the partner's own revenue-per-relationship figure.

### 7.3 Lens 3: time saved (secondary; never lead with it)
- **Meeting prep:** replaces the bespoke spreadsheet model built before each owner meeting. Ask the prospect how many hours that takes them today.
- **Defensibility:** "Explain" cards remove the after-meeting rework of justifying numbers to clients, lenders and compliance.
- **Confidential discovery:** Decision Room links replace separate one-to-one interviews with each family member.

### 7.4 One-page ROI worksheet (for proposals)
```
Client value at stake (from BridgeGen):        $__________   (e.g. governance value at risk)
Your fee per engagement:                       $__________
Extra engagements / retained clients per year:  ____
Annual advisor upside = fee × engagements:      $__________
BridgeGen annual price:                         $__________
Return multiple = upside ÷ price:               ____×
Break-even = price ÷ fee:                       ____ engagements
```

---

## 8. Sales Pitch Framework

### 8.1 Motion overview
| Stage | Goal | Asset |
|---|---|---|
| **Attract** | Get advisors to try the public demo | Content: "The $22.5M governance gap hiding in a typical family business" |
| **Engage** | A live, 20-minute demo on the advisor's own client situation | Demo script (8.3) |
| **Prove** | 14-day trial, with one real client company saved and one Decision Room sent | Trial success checklist |
| **Close** | Annual plan, anchored to one engagement | ROI worksheet (7.4) |
| **Expand** | Solo → Firm (seats, shared workspace), Firm → Enterprise (white-label) | Usage review |

### 8.2 Discovery questions
1. "Which owner decision are your clients putting off right now: succession, a recap, bringing in a CEO, or selling?"
2. "When a family disagrees, how do you find out what each person actually thinks?"
3. "How do you show an owner what happens to the business if *they* are suddenly out of the picture?"
4. "How long does it take you to build the model before an owner meeting? Who checks it?"
5. "What's a typical engagement worth to you, and how many owner conversations stall before they become one?"

### 8.3 Twenty-minute demo script (the Trojan Horse)
1. **Hook (2 minutes), Flight Simulator.** Load the demo company. Drag leverage to 3.0x. *"Your client gets $30M today. Watch equity fall by exactly $30M, and coverage drop from 25x to 4.2x."* Click **Explain** to show the maths.
2. **The family (4 minutes), Economics vs. Alignment.** *"Good economics, divided family: 'value at odds'."* Load "Gradual transition": the dot moves toward consensus but stops short. *"The last step is governance."* That sets up step 3.
3. **The hidden liability (3 minutes), Governance Debt.** *"78 out of 100: $22.5M at risk. Documenting who can sign and spend is worth $3.5M on its own."*
4. **The future (3 minutes), Fork the Future.** Today versus Today with governance fixed: *"+$20.3M by year 10."* Then the recap: *"−$12.4M."*
5. **The shock (3 minutes), Red Team.** Founder incapacitation: *"$30.5M destroyed, $21.2M of it avoidable."*
6. **The moment nobody else can create (4 minutes), Decision Room.** Create a private link, answer it on a phone in front of them, open the Facilitator tab: *"The founder thinks the heir wants to run the company. The heir doesn't. You learn that without anyone being named."*
7. **Close (1 minute).** *"Which client would you run this with first?"* Then go to the trial.

### 8.4 Persona talk tracks
- **Middle-market advisor:** "Turn the meeting your client keeps postponing into the engagement you've been waiting for."
- **Boutique M&A banker:** "Find the governance and family risks before the buyer's diligence does, and price your readiness work accordingly."
- **Family office director:** "Give every generation a private voice, and the family a shared picture of the next ten years."
- **Estate planner:** "Before you draft the transfer, show the family what it does to control, value and agreement."
- **Fractional CFO:** "Board-ready breaking points: exactly how far EBITDA can fall before the covenants bite."

### 8.5 Objection handling
| Objection | Response |
|---|---|
| "I already do this in Excel." | "Keep Excel for the detailed model. BridgeGen is what you put in front of the owner: live, explainable, and including the family and governance dimensions a spreadsheet doesn't capture." |
| "Is this a valuation?" | "No. It's a decision simulator. It shows direction and magnitude using transparent rules you can adjust and explain. Formal valuations stay with your valuation partners." |
| "My clients won't share sensitive views in software." | "That's why answers go through private links, are stored server-side, and are never shown to you. You only see where views diverge, never who said what." |
| "Where do the numbers come from?" | "Click **Explain** on any number. Every result traces to a stated rule and your inputs: no black box and no AI-generated figures." |
| "It's another subscription." | "One engagement it helps you win pays for roughly ten years of Solo. Try it on one live client for 14 days." |
| "We need it under our brand." | "That's the Enterprise / White-Label tier. Let's scope it as a lighthouse partnership." |

---

## 9. Competitive Positioning

BridgeGen doesn't replace an advisor's existing stack; it fills the gap between **numbers** and **people**.

| Alternative the buyer uses today | What it does well | Where BridgeGen wins |
|---|---|---|
| Spreadsheets and bespoke models | Unlimited flexibility | Live in the meeting, explainable to non-financial family members, and includes alignment, governance and stress tests |
| Financial planning or wealth software | Personal balance sheets, cash flow, estate projections | Models the **operating company** and the family dynamics around it, not just personal wealth |
| Valuation reports | A formal, defensible point estimate | Scenario-driven and interactive; shows *consequences of decisions*, not a single number |
| Governance or family-business consultants | Deep facilitation expertise | A repeatable tool that scales their method, with confidential stakeholder input and dollar-quantified governance gaps |
| Survey and interview tools | Collecting opinions | Built-in perception-gap detection linked to the financial model, with privacy by design |

**Positioning statement:**
> For advisors to founder-led and family-owned businesses who need owners to act on hard decisions, BridgeGen is a private-company decision simulator that shows the financial, family and governance consequences of a decision in one meeting. Unlike spreadsheets or planning software, BridgeGen combines live scenario modelling, confidential stakeholder input and glass-box explanations, so every number can be defended and every voice is heard.

---

## 10. Recommended Website Copy: `/pricing`

> Copy follows the Quiet Luxury voice: calm, precise, numerate. No exclamation marks, no hype words.

### 10.1 Hero
**Headline:** Pricing for advisors who change what owners decide.
**Subhead:** Every module, every explanation, and confidential Decision Rooms, priced at a fraction of one engagement.
**Primary CTA:** Start a 14-day trial
**Secondary CTA:** Explore the live demo, no sign-up needed

### 10.2 Plan cards
**Solo: $249 / month** (or $2,490 / year, two months free)
*For independent advisors, fractional CFOs and estate planners.*
- All six decision modules with Explain cards
- 15 saved client companies
- 3 confidential Decision Rooms at a time
- Email support
**CTA:** Start Solo trial

**Firm: $699 / month for 5 seats** (or $6,990 / year)
*For boutique M&A banks, family offices and advisory teams.*
- Everything in Solo
- Shared firm workspace *(coming soon for founding firms)*
- 75 client companies · 25 Decision Rooms at a time
- Branded client meeting packs *(coming soon)*
- Priority support and quarterly success reviews
- Additional seats $99 / month
**CTA:** Talk to us about Firm · **Badge:** Most popular

**Enterprise / White-Label: from $24,000 / year**
*For private banks, multi-family offices and advisory networks.*
- Your brand, your domain *(delivered as a partnership milestone)*
- SSO, audit log and data-residency options
- Calibration to your methodology
- Named success manager and SLA
**CTA:** Book a partnership call

> Keep the "coming soon" labels until each capability ships (see Section 5.2). Remove them in the same release.

### 10.3 "What one engagement is worth" (ROI section)
**Headline:** The arithmetic is simple.
**Body:** If BridgeGen helps you win or keep one owner engagement a year, Solo pays for itself about ten times over. In our demo company, one stress test reveals $21.2M of avoidable loss. Your clients' numbers will differ; the conversation it starts won't.
**Interactive element (future):** a three-field calculator (fee per engagement, extra engagements per year, plan) that outputs the return multiple and break-even.

### 10.4 Comparison table
Show the Section 5.1 table, collapsed by default on mobile, with three columns and one row per capability. Mark roadmap items "Coming soon".

### 10.5 Confidentiality and trust
**Headline:** Built for conversations families don't have out loud.
- Stakeholders answer through private links, with no account needed.
- Their answers are stored server-side and never shown to the advisor; you see only where views diverge.
- Every number has an **Explain** card: traceable rules, no AI-generated figures.
- Your client companies are visible only to your account, enforced by row-level security in the database.

### 10.6 FAQ
- **Can I try it without signing up?** Yes. Every module works with our demo company in the live demo. Sign up to save your own clients.
- **Is BridgeGen a valuation tool?** No. It's a decision simulator that shows the direction and magnitude of consequences using transparent, adjustable rules. It doesn't provide valuation, legal, tax or investment advice.
- **Can my clients see each other's answers?** No. Answers are private to each stakeholder and never shown to you either. The Decision Room only shows disagreements and misperceptions.
- **What counts as an active client company?** A saved company you're working on. Archive companies you're not using to free up a slot *(archiving coming soon)*.
- **Can I change plans?** Yes. Upgrades take effect immediately and are prorated; downgrades apply at the next renewal.
- **Do you offer annual billing?** Yes: two months free on Solo and Firm.
- **Do you white-label?** Yes, on the Enterprise / White-Label plan.

### 10.7 Closing CTA band
**Headline:** Show your next client the consequences before they decide.
**Buttons:** Start a 14-day trial · Explore the live demo

### 10.8 Footer disclaimer
*BridgeGen is a decision-support and illustration tool. Outputs are scenario estimates based on user inputs and stated assumptions; they are not valuations, guarantees, or legal, tax or investment advice. Projections are undiscounted and illustrative.*

---

## 11. Validation Plan and Metrics

### 11.1 Before publishing prices
1. **Willingness-to-pay interviews (15–20 advisors across the five personas):** use Van Westendorp price-sensitivity questions for Solo and Firm, and the Gabor-Granger method for the Firm seat add-on.
2. **Founding-customer offers to 10 warm prospects** at the Section 6.4 terms. A close rate below 20% signals a value-communication problem before it signals a price problem.
3. **Test the value metric:** confirm advisors think in "active clients" rather than seats or rooms. Adjust the limits, not the price, first.

### 11.2 Launch metrics
| Metric | Target (first 6 months) |
|---|---|
| Public demo → trial sign-up | ≥ 4% |
| Trial → paid | ≥ 20% |
| Trials that save at least one company and send at least one Decision Room link | ≥ 60% (leading indicator of conversion) |
| Solo → Firm expansion within 12 months | ≥ 10% of Solo accounts in multi-advisor firms |
| Logo churn, monthly (Solo) | ≤ 3% |
| Annual plan share | ≥ 40% of new paid accounts |

### 11.3 Pricing review triggers
- Trial-to-paid above 35%: test the top of the range ($299 Solo, $899 Firm).
- Trial-to-paid below 10% with strong activation: test $199 Solo or a lower Firm seat count.
- More than 30% of Solo accounts hitting the company cap: introduce a "Solo Plus" tier or raise the cap.

---

## 12. Risks and Guardrails

| Risk | Mitigation |
|---|---|
| **Over-promising roadmap features** (firm workspace, exports, white-label, SSO) | Section 5.2 is the single source of truth; "coming soon" labels in all copy; design-partner contracts list milestones. |
| **Model outputs read as advice or valuation** | Footer disclaimer, the in-product glass-box Explain cards, and the "not a valuation" objection script. Calibration notes: governance weights, shock sizes and stakeholder priorities are stated assumptions, adjustable per firm. |
| **Undiscounted projections overstate long horizons** | Disclose in copy and FAQ; add a discount-rate option to Fork the Future on the roadmap before relying on 10-year figures in enterprise sales. |
| **Confidentiality claims must stay true** | Claims are backed by the live security suite (`pnpm test:rls`). Rerun it before every release and before any security questionnaire. |
| **Launch blockers** | Billing and plan limits, production email (custom SMTP with email confirmation on), and `NEXT_PUBLIC_SITE_URL` set for invite links. |
| **Price anchoring to the demo company** | Always re-anchor on the prospect's own client figures in the live demo; label demo figures as illustrative. |

---

## 13. Next Steps

1. **Validate:** run the 15–20 willingness-to-pay interviews; recruit 10 founding customers.
2. **Build the paid foundation:** billing and plan limits, production email, then the firm workspace (unlocks Firm), then branded exports.
3. **Ship `/pricing`:** implement Section 10 in the app using the Quiet Luxury design system, with the free demo as the secondary CTA on every page.
4. **Review pricing after 90 days** against the Section 11.2 metrics.

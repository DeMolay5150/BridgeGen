# BridgeGen Walkthrough — Video Script

**Audience:** boutique M&A bankers and fractional CFOs advising founder-led and family companies.
**Length:** ~3 minutes · 1920×1080 · 30 fps · calm VO, product on screen throughout.
**Promise:** *See the systemic consequences before you make the decision.*
**Rule for every number on screen:** it comes from the demo company (Revenue $40M, EBITDA $12M, 8.0x, $6M debt). Nothing is mocked or AI-generated.

---

## 0. Cold open (0:00–0:12)
**On screen:** Dark slate. "BRIDGEGEN" wordmark in cyan. Tagline fades in.
**VO:** "Every recap, transfer and succession plan looks fine in a spreadsheet. The trouble starts when the family, the lender and the board react. BridgeGen shows you that before the client signs."

## 1. Workflow one: Scenario Simulator (0:12–1:00)
**Shot 1 — /simulator, demo company at Today.** KPI cards show $96.0M EV, $90.0M equity, 25.0x coverage, "No change vs. Today".
**VO:** "Start with the client's numbers, or paste them straight from Excel."
**Shot 2 — drag Debt leverage to 4x.** Equity drops to $48.0M (−$42.0M vs. Today, rose badge); $42.0M recap payout; coverage 3.1x.
**VO:** "A four-times dividend recap pays the family forty-two million today. Watch what it costs."
**Shot 3 — scroll to Three-statement model.** Cash-flow tab; revolver draw row highlighted amber in years 1–3. Monte Carlo card: breach probability, P10/P50/P90.
**VO:** "Linked statements show free cash flow trailing scheduled repayments for three years, and a thousand simulated paths put a probability on breaching covenants."
**Shot 4 — click "Present".** Full-screen client session, four plain-language levers.
**VO:** "In the meeting, switch to client mode: four levers, outcomes in plain English, nothing internal on screen."

## 2. Workflow two: Decision Room & Red Team (1:00–2:05)
**Shot 5 — /room, Facilitator tab with demo answers.** Disagreements and misperceptions; "The founder misreads the next-gen heir".
**VO:** "Each stakeholder answers privately through their own link. You never see who said what — only where the family disagrees, and who has misread whom."
**Shot 6 — Map tab.** Drag the founder's transfer slider; ownership cascade reprices. Switch to Governance; click "Delegated authority" — score 78 → 66.
**VO:** "Ownership and authority, as a map you can move."
**Shot 7 — /red-team.** Executive summary: "The structure fails 2 of 4 stress cases…". Liquidity card: base vs. downturn, Today vs. your scenario.
**VO:** "Red Team mode attacks the plan: founder incapacity, a successor walking away, a downturn. It flags the liquidity crunch and names the cheapest hedge — here, $21.2M preserved by documenting authority and succession."

## 3. Workflow three: One-click IC deck (2:05–2:45)
**Shot 8 — Simulator header → "IC deck".** Choose watermark "Client copy", click PowerPoint.
**VO:** "When it's time to take it to committee, one click builds the deck."
**Shot 9 — the deck, slide by slide (2s each).** Bottom line · Decision vs. Today · Ten-year summary · Range of outcomes · Liquidity & covenants · Stress scenarios · Recommended actions.
**VO:** "Eleven slides, every figure traceable to the model, in PowerPoint, PDF or Marp. The Decision Room adds the alignment slide — never anyone's answers."

## 4. Close (2:45–3:00)
**On screen:** Three workflow tiles; URL `bridgegen.io/walkthrough`; "Book a partnership call".
**VO:** "Model it. Stress it. Present it. BridgeGen."

---

### Production notes
- Capture at 1920×1080 with the demo company; reset between takes ("Back to today").
- Planned automation: a Remotion project in `video/` that imports the real engines (`lib/simulator`, `lib/statements`, `lib/redteam`) so animated figures match the app, rendering to `public/walkthrough.mp4` for a `/walkthrough` page. Not built yet. Remotion requires a paid company licence for organisations with more than three people; check before using it commercially.

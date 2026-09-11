# FIRE Planner Calculation Decisions

This file records the financial-model decisions used by the web app. Update it whenever the calculation changes.

## Time horizon

- Current age is the start of the projection.
- Life expectancy is age **90**.
- The estimated retirement age is the earliest age at which the projected corpus remains non-negative through age 90.
- If no retirement age is sustainable through age 90, the app returns an undetermined state rather than using age 90 as a fallback. The UI shows a warning and adjustable recovery metrics.
- A user with zero monthly income is tested as already retired at their current age. Retirement withdrawals start immediately. If the corpus cannot last through age 90, the result is undetermined.
- The retirement-age slider remains available in this state for what-if planning. Selecting a future age creates a hypothetical plan, and the metrics card shows the monthly investment and salary required to support that target. Resetting the slider returns to the actual zero-income, retired-now projection.

## Before retirement

- Monthly investible surplus is:

  `monthly income - monthly expenditure - mutual-fund SIP - dependent costs - loan EMI`

- If income does not cover living costs, dependents, and loan EMI during a working year, the deficit is withdrawn from assets using the same documented withdrawal order.
- The requested SIP is capped at the cash remaining after those costs; the model never creates an unaffordable contribution.
- The explicit monthly SIP is contributed to the mutual-fund bucket and earns the configured mutual-fund rate.
- Any positive cash remaining after expenditure, SIP, dependent costs, and loan EMI goes into the separate savings bucket and earns the configured savings rate.
- Monthly expenditure is therefore already removed before calculating new savings. It must not also be deducted from the corpus during the same pre-retirement year.
- Existing mutual funds grow at **10% annually**.
- Existing fixed deposits grow at **6% annually**.
- Existing real estate grows at **8% annually**.
- Bank savings start as an editable asset balance (default **₹1 lakh**) and grow at **4% annually**.
- New monthly salary surplus is added to the same bank-savings bucket each year and subsequently grows at **4% annually**.
- Dependent cost is entered as an annual cost per dependent. The model uses `number of dependents × annual cost per dependent`, converted to a monthly cost for cash-flow calculations.
- When dependent support or a loan ends, that released monthly amount is added to subsequent investments.
- Contributions and living/dependent costs grow at the **6% inflation rate**. Loan EMI remains nominal until the loan ends.

## At and after retirement

- Mutual funds, stocks, fixed deposits, real estate, and savings remain separate buckets and continue to earn their configured annual rates year on year, including after retirement.
- Real estate is assumed to be available to fund retirement, including through sale or monetisation.
- Retirement expenses are withdrawn in this fixed order: **savings → fixed deposits → mutual funds → stocks → real estate**. A bucket is exhausted before withdrawals move to the next bucket.
- Living expenses grow at **6% annually**.
- Any dependent costs and loan EMI that remain after retirement are included in annual retirement costs until their configured end dates.
- For every retirement year—including age 90—the app first applies the annual portfolio return and then deducts that year's full annual expenses.
- If available cash is less than the annual expense, the graph caps the displayed paid expense at available cash and sets remaining corpus to zero. It does not show spending funded by nonexistent cash.

## Retirement-age test

The app simulates every year rather than using a fixed 25× expense shortcut. A candidate retirement age passes only when all annual retirement costs can be funded without the corpus becoming negative before age 90.

## Result and graph states

- When a retirement age is found, its chart period is selected automatically and its cash/expense tooltip is visible by default.
- When no sustainable retirement age is found, the result shows an explicit warning instead of a fallback age, plus adjustable recovery metrics.
- Once the corpus is depleted, subsequent cash bars remain at zero and the graph continues with a dashed zero line through age 90.
- Selecting a depleted year reports `Cash at hand: 0` and `Expenses: more than cash`. Expenses are not drawn as if they were paid after available cash reaches zero.
- Cash and expense bars use one shared monetary scale, so their lengths are directly comparable.

## Assumptions requiring product confirmation

- Real estate is treated as available retirement wealth at retirement.

## Confirmed September 2026 flow decisions

- Editing a field updates the visualization immediately, but it does not calculate or reveal a retirement age.
- A retirement age is calculated and the results page opens only after **Find my retirement age** is selected.
- The details popover pushes the visualization through three states:
  - **Minimized:** while the user interacts with the details.
  - **Slightly expanded:** when the user selects the visualization while the details popover is open.
  - **Fully expanded:** only on the results page after calculation.
- **Edit details** reopens the same details popover with edit-specific copy.
- A retirement age selected in the what-if popover is temporary and is not carried back to the main results screen.
- The retirement-age tooltip behavior remains unchanged.
- The **Historical** rates view remains an under-construction state for now.
- “Investments” in the retirement-age recommendation means monthly mutual-fund SIPs.
- Custom rate changes and the **Apply rates** interaction are deferred from the current release.
- **Download plan** inside the retirement-age popover exports the temporary hypothetical scenario shown in that popover, even though the selected age is not carried back to the main results screen.
- Export generates a CSV containing every input, applied rate, annual projection value, and intermediate/final number used by the calculation and visualization.

## Rate research and simulation outlook

The current release will not expose custom rate editing. It will generate one set of simulated outcomes from the documented model assumptions and let the user change only the projection outlook:

- **Cautious:** the 20th-percentile projection.
- **Typical:** the median (50th-percentile) projection.
- **Optimistic:** the 80th-percentile projection.

The outlook is a viewing lens over the same simulation results; it is not an investment-risk questionnaire and does not change the underlying input assumptions.
Changing the outlook updates only the chart path and its tooltip values. It does not change the calculated retirement age, which remains based on a fixed simulation-success threshold.

- The retirement age is the earliest candidate age for which the corpus lasts through age 90 in at least **85% of 1,000 simulated futures**.

### Evidence used

- The RBI's inflation framework targets 4% CPI with a ±2 percentage-point tolerance band. For a long retirement projection, 6% remains a useful cautious baseline rather than assuming the target will always be met: [RBI inflation framework](https://www.rbi.org.in/commonperson/English/Scripts/speeches.aspx?Id=3161).
- RBI's June 2026 published ranges show savings deposits around 2.5% and term deposits above one year around 6.0–6.6%: [RBI current rates](https://m.rbi.org.in/scripts/BS_ViewForms.aspx?FCId=13).
- Nifty Indices' long-history analysis shows large year-to-year equity variation and long-horizon rolling outcomes spread across several return bands. This supports scenario ranges rather than one guaranteed equity return: [Nifty 50 research paper](https://www.niftyindices.com/docs/default-source/indices/nifty-50/nifty-50-whitepaper_2026.pdf?sfvrsn=dd206335_4).
- NHB RESIDEX shows materially different house-price changes by city, including negative and strongly positive one-year results. A national planner should therefore use a restrained central assumption and a wide editable range: [NHB RESIDEX report](https://www.nhb.org.in/wp-content/uploads/2026/02/NHB-TP-Report-2024-25-Bilingual.pdf).

### Researched internal modelling bounds

| Rate | Slider range | Reasonable central value |
| --- | ---: | ---: |
| Inflation | 2–10% | 6% |
| Savings/new savings | 0–8% | 4% |
| Mutual funds | 0–18% | 10% |
| Stocks | 0–20% | 10% |
| Fixed deposits | 0–10% | 6% |
| Real estate | 0–15% | 8% |

These bounds remain internal research references for constructing and validating distributions. They are not user-facing controls in the current release.

### Implemented simulation model

- The client generates **1,000 deterministic, seeded futures** in a Web Worker. Moving a slider does not regenerate unrelated randomness.
- The model uses annual nominal returns centred on the documented rates: inflation 6%, savings 4%, mutual funds 10%, stocks 10%, fixed deposits 6%, and real estate 8%.
- Equity mutual funds and stocks share a market factor so their returns are correlated rather than independently random. Each also has its own idiosyncratic variation.
- Real estate has a smaller exposure to the same market factor plus independent variation. Inflation, savings, and fixed-deposit variations are generated separately.
- Annual values are bounded to prevent impossible mathematical tails while retaining negative equity and property years.
- The same seed and model version must produce the same result. The CSV includes the seed, inputs, rates, success probability, selected outlook, recommendations, and annual chart values.
- Simulations are educational scenario analysis, not forecasts or financial advice.

### Possible-outcomes explanation

- The standard chart shows the projection selected by the outlook control, with **Typical** intended as the default.
- **See possible outcomes** opens a dedicated page containing the projection, plain-language explanation, and controls for switching between Cautious, Typical, and Optimistic outlooks.
- The explanation visualization overlays a representative sample of approximately 100 low-opacity paths while calculations continue to use all 1,000 simulated paths.
- The selected outlook path remains visually prominent above the faint paths.
- Supporting copy explains that every faint projection is one possible future and denser areas represent outcomes that occurred more frequently.
- Custom assumptions and custom return-rate controls are out of scope for the current release.

## Confirmed “changes needed” calculation

The current heuristic subtracts an arbitrary expense amount per year of earlier retirement and adds a fixed salary buffer. It should be removed.

Calculate three transparent, independent alternatives for the retirement age selected in the popover, holding all other inputs and rates constant:

1. **Monthly SIP alternative:** binary-search the minimum monthly SIP that makes the corpus last through age 90.
2. **Salary alternative:** calculate the minimum monthly salary required to cover expenditure, active dependent costs, loan EMI, and that required SIP.
3. **Expenditure alternative:** binary-search the maximum monthly expenditure that remains sustainable using the user's current income and SIP.

Each row shows the resulting rupee value and percentage change from the user's current value. The UI labels them as alternatives (“or”), because applying all three changes simultaneously would double-count the improvement.

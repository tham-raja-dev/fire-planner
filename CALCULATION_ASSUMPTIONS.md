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

  `monthly income - monthly expenditure - dependent costs - loan EMI`

- A negative surplus is treated as zero for users who still report income. Withdrawing a working-years cash-flow deficit from assets remains a model limitation.
- Monthly expenditure is therefore already removed before calculating new investments. It must not also be deducted from the corpus during the same pre-retirement year.
- Existing mutual funds grow at **10% annually**.
- Existing fixed deposits grow at **6% annually**.
- Existing real estate grows at **8% annually**.
- Bank savings start as an editable asset balance (default **₹1 lakh**) and grow at **4% annually**.
- New monthly salary surplus is added to the same bank-savings bucket each year and subsequently grows at **4% annually**.
- Dependent cost is entered as an annual cost per dependent. The model uses `number of dependents × annual cost per dependent`, converted to a monthly cost for cash-flow calculations.
- When dependent support or a loan ends, that released monthly amount is added to subsequent investments.
- Contributions and living/dependent costs grow at the **6% inflation rate**. Loan EMI remains nominal until the loan ends.

## At and after retirement

- Mutual funds, fixed deposits, and real estate are combined into the retirement corpus. This assumes the real-estate value is available to fund retirement, including through sale or monetisation.
- The combined retirement corpus grows at **7% annually**.
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
- The post-retirement portfolio uses one blended 7% return instead of retaining the three pre-retirement asset-specific rates.

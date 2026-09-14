# UI flow invariants

These rules are regression constraints for the details-entry flow.

1. The details flow never renders the result-page tabs (“Retirement estimate” and “Your details”), including when its chart is expanded.
2. The primary action stays fixed to the bottom of the viewport while the details form scrolls.
3. Do not apply `transform`, `filter`, `perspective`, `contain: paint`, `contain: layout`, or `contain: content` to `.details-screen` or another ancestor of `.sticky-footer`. These properties can make a fixed descendant behave like it is attached to the scrolling container.
4. Scrolling down keeps the details chart minimized. Scrolling upward while deep in the form must not expand it and shift the fields. Automatic expansion happens only after returning to the top; tapping the chart remains an explicit way to expand it.
   The collapse transition must be guarded: reducing the chart height clamps `scrollTop` and emits synthetic upward scroll events, which must not reopen the chart.
5. Only one top-level flow screen is rendered at a time. Root containers remain viewport-locked so overscroll cannot expose another screen.
6. The details popover uses six horizontally scrollable chips in this order: age, investments, income, expenditure, loans, dependencies. Loans and dependencies open their existing editors and do not alter defaults.
7. Investments, Income, and Expenditure use the supplied 32px SVG artwork. The details content uses 16px horizontal gutters, while the fixed primary CTA retains its existing 12px outer gutter.

Before shipping a scrolling change, verify at mobile width that the footer's `getBoundingClientRect().bottom` remains equal to `window.innerHeight` before and after scrolling the details container.

## Documentation requirement

1. Documentation is part of the definition of done for every change.
2. Update `CALCULATION_ASSUMPTIONS.md` whenever formulas, rates, distributions, thresholds, projections, exports, or financial behaviour change.
3. Update this file whenever screen states, navigation, sticky elements, labels, component behaviour, or regression constraints change.
4. Documentation and implementation must be updated in the same working change and verified before any commit is proposed.

## Results and scenarios

1. The results page defaults to the Cautious outlook. The median outlook is labelled “Moderate” in the UI, while the internal calculation key remains `typical`.
2. The results hierarchy is: chart, Retirement age, confidence sentence, Change age, scenario controls, scenario description, More details, and the fixed two-button footer.
3. Edit details and Export have equal widths. Export uses the primary green fill with dark text; Edit details uses the raised dark treatment with green text.
4. Change age opens at 117px from the top of a 412×918 viewport. It shows the active outlook and calculated age, the hypothetical-age slider, independently achievable alternatives separated by “or,” and Download plan. Set retirement age uses the same sentence-style alternative layout but omits the calculated-age copy.
5. Expenditure recommendations show their actual signed decrease (for example, `−8%`) and use the coral comparison color.
6. More details opens the Scenario simulations sheet over the results screen. Its default All view superimposes exactly 100 sampled corpus paths and their corresponding expense paths. Cautious, Moderate, and Optimistic switch to their individual percentile projections. Extreme sample outliers are excluded only from the display scale so a single compounded result cannot flatten the other 99 visible paths.
7. The Scenario simulations sheet includes the complete designed structure: graph card, 2×2 scenario selector, selected-scenario explanation, Monte Carlo explanation, Know more, and Got it.
8. In the Scenario simulations overview only, corpus and expenses use fixed 280px and 107px plotting regions with independent scales so both sets of 100 paths remain visible. The main retirement chart continues to use one shared rupee-to-pixel scale.
9. The undetermined result uses the “Retirement age is beyond reach” copy and opens a sheet titled “Set retirement age.” Its expanded chart selects the current age so the standard numeric tooltip remains visible; do not replace it with the old warning banner. Unavailable suggestions are hidden; if all three monthly levers are unavailable, show the required-current-corpus fallback.
10. Moving the retirement-age slider previews the hypothetical projection in the chart behind the sheet. It must not change the retirement-age result or copy behind the sheet, and closing the sheet restores the calculated plan unchanged.
11. Final results and the Scenario simulations sheet show the six model rates in a two-column, three-row grid: inflation, mutual funds, stocks, fixed deposits, real estate, and savings. All shows central assumptions; individual outlooks show the realized annual average for their coherent path.
12. Calculation uses a dedicated 412×917 loading screen. At 412px wide it has 16px outer gutters, a 380×524 chart beginning 16px from the top at 20% opacity, status content beginning at 556px, 16px between status and rate grid, and three 45px rate rows with a 16px column gutter.
13. Change age initializes both the value and chart selection to the app's calculated retirement age. Set age may initialize to the existing fallback target because no calculated age exists.
14. The final result follows Figma frames `137:4563` and `127:1343`: a 456px top visualization, 16px result gutters, a three-stop Cautious/Moderate/Optimistic range control labelled only at its endpoints, horizontally scrolling rate cards using actual simulated ranges, and the existing two-button sticky footer. On shorter screens the result container scrolls, naturally reducing the visible top-chart area as it moves above the viewport.
15. The Scenario simulations sheet follows frame `137:4764`: it begins 101px below the viewport top, always superimposes the 100 corpus and expense paths, places both explanatory paragraphs after the graph, shows horizontally scrolling actual-rate range cards, and has no scenario-selector grid.
16. Rate-card titles on both the final result and Scenario simulations sheet use an explicit 14px font size and 20px line height; do not rely on the browser's default `<small>` sizing.

## Intro and processing motion

1. The intro matches Figma frame `127:650`: the chart is 397×421 at x=7/y=153 on a 412×917 viewport, while the 212px content panel begins at y=705 with 16px insets.
2. Intro copy is “When can you retire?” followed by “See your finances run across multiple scenarios to determine the best age to retire”. It has no secondary “What’s this?” action.
3. Exactly three intro projections remain superimposed at a constant reduced opacity, and they must not share one animation. Projection 1 travels right-to-left over 4.33s; projection 2 travels left-to-right between 20% and 80% height over 5.33s; projection 3 travels right-to-left over 8.33s. Per-column delays use the corresponding slowed timing. Green and red bars share direction and timing within their projection. Projection layers must never crossfade. Do not use CSS multiplication such as `calc(var(--height) * var(--scale))`: it resolves to invalid zero-height bars in unsupported browsers.
4. The loading chart retains five computed projections, derived from the current Cautious, Moderate, and Optimistic paths plus two interpolated paths. Its 2.2-second loop is intentionally faster to signal processing. The calculation screen remains visible for at least 4.2 seconds, and each changing status message remains visible for 1.2 seconds so it can be read comfortably.
5. Reduced-motion mode disables both loops and leaves all five projections statically superimposed.
6. When calculation completes, the existing five loading projections remain mounted while their cash and expense bars interpolate to the final Cautious values. During the same 900ms interval, their inset card expands to the full-width result geometry, the Cautious layer becomes fully opaque, the other four layers fade away, and loading copy/rates fade. Do not render a second handoff chart. The tooltip and result content appear only after this morph completes, and the result screen must not run another entrance animation.
7. Loading projections use normal chart opacity; do not dim the entire chart component.

### Intro-motion learnings and acceptance

1. A changing CSS property is not proof that the intended animation is working. Checking one bar's transform or height only proves technical activity; it does not prove that a user can perceive a wave in the five-layer composite.
2. Do not approve intro motion from isolated screenshots or numeric style samples. Review a real-time recording at the actual 412×917 viewport for at least two complete loops.
3. Overlapping projections can visually conceal bar-height movement even when every bar is animating. Give every layer a distinct direction, amplitude, duration, easing, or phase so the composite remains visibly active; the visible outer silhouette—not a covered internal bar—must clearly rise and fall.
4. Layer opacity must be sampled throughout the loop and remain constant. Changes in overlap density must not create an opacity-like pulse that can be mistaken for the requested wave.
5. Avoid slow or low-amplitude motion that is technically present but perceptually static. Wave direction, duration, amplitude, wavelength, and whether all five projections move together are product specifications and must be confirmed before another implementation attempt.
6. Browser compatibility is part of visual acceptance. Avoid typed CSS arithmetic for bar heights; unsupported browsers can resolve the entire chart to zero height.

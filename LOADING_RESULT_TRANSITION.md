# Loading-to-result chart transition

## Intended motion

The processing chart and the result chart must read as one continuous visualization.
The loading chart does not crossfade to a separately rendered result chart.

1. Processing begins with five superimposed projections inside the 16px inset chart card.
2. When calculation finishes, the inset card expands to the full result-chart bounds over 900ms using a standard material ease rather than a front-loaded curve.
3. During that same 900ms interval, every cash and expense bar interpolates from its loading height to the calculated Cautious height.
4. The five projections therefore visibly converge: the Cautious layer becomes fully opaque while the other four fade away as their bars approach the same final values.
5. Loading copy and rates fade while the chart expands.
6. The result tooltip and content appear only after the morph finishes.

## Visual invariants

- There is only one visible chart during the handoff; no duplicate final-chart overlay.
- Bar order, age-to-column mapping, and the zero line remain unchanged.
- The bars use the same 415px internal coordinate system throughout. The revised final screen exposes them inside a 456px visualization region, matching Figma frame `137:4563`; the larger loading card centers that coordinate system instead of recalculating it.
- The result chart must not run a second entrance animation or visibly change bar heights after the handoff.
- Reduced-motion mode completes the same state change without prolonged motion.

## Root-cause log

### Attempt 1: duplicate handoff chart

- **Problem:** A separately rendered final chart was placed above the loading chart.
- **Why it failed:** The overlay had different dimensions, scale, tooltip layout, and mount timing. The handoff read as a crossfade and layout jump rather than one chart changing state.
- **Constraint:** Never introduce a second chart for the loading-to-result handoff.

### Attempt 2: five persistent layers with independent chart scales

- **Problem:** The same five loading layers were updated to the final path, but every `ProjectionChart` normalized its values independently.
- **Why it failed:** Equal values did not occupy equal pixel heights across layers, so the scenarios looked unaligned and inconsistent. The loading container was also replaced by the result container after 600ms, leaving a visible final discontinuity.
- **Constraint:** All five loading paths and the final Cautious path must share one corpus maximum, one expense maximum, one plot height, and one age-column layout. The chart DOM must remain mounted after loading completes.

### Attempt 3: correct interpolation with a front-loaded 600ms easing curve

- **Problem:** Geometry and bar interpolation were technically continuous, but most visible movement completed near the beginning of the interval.
- **Why it failed:** The motion still felt like a snap, and the result reveal arrived too close to the apparent end of the zoom.
- **Constraint:** Use a 900ms `cubic-bezier(.4, 0, .2, 1)` morph. Result content is revealed only after the full interval.

## Current implementation solution

1. Build one shared chart domain from the calculated Cautious path (or its preview equivalent before calculation returns). All five loading layers use this same domain. Loading-only path values are proportionally fitted within that domain; they must never enlarge it and flatten the final result.
2. Pass that shared domain to every scenario layer so a rupee maps to the same number of pixels in every layer.
3. Render the visualization in a persistent output-stage component used for both `loading` and `result` phases.
4. Keep the same chart layer nodes mounted while their data, opacity, and outer bounds transition.
5. Mount the tooltip from the beginning in a reserved 49px row, but keep it visually hidden and inaccessible until the convergence finishes. This prevents its appearance from moving the plot.
6. Reveal the result content with a short opacity/translate transition after the chart has settled; do not replace the chart at that boundary.

The five processing paths are decorative previews of the computed outlook shapes. Before rendering, each is proportionally fitted inside 96% of the Cautious-owned corpus and expense domain. This fit changes only loading-state pixels—not simulation data, rates, retirement age, exports, or the final chart. It prevents optimistic paths from clipping while preserving one shared pixel scale for every visible layer.

## Acceptance measurements

- For a given age and value, all loading layers produce the same pixel height when fed the same value.
- The chart element has the same React identity and DOM node before, during, and after the transition.
- Its zero-line screen coordinate changes only as part of the documented outer-card expansion—never because scale or tooltip geometry was recalculated.
- The last transition frame and the first interactive result frame have identical chart bounds and bar rectangles.
- At 200–400ms, at least two scenario layers remain visible and their bars are measurably between their loading and final heights.

## Verification

- Capture the beginning, midpoint, end, and first settled-result frames at 412x917.
- At midpoint, the card must be wider than its loading state, the bars must be between their loading and final heights, and more than one projection must still be visible.
- The final handoff frame and first result frame must have matching bar geometry.
- Run lint, build, and the details-flow regression tests before considering the change complete.

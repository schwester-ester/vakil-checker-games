# Vakil Checker Games

A self-contained TypeScript web application implementing the checker-game formulation of Ravi Vakil's geometric Littlewood–Richardson rule.

## Features

- Choose `n` and `k`.
- Place white checkers directly or enter the two `k`-subsets `A` and `B`.
- Validate the exact initial-position and happiness conditions.
- Generate every checker-game path without deduplicating equal terminal outputs.
- Inspect the prescribed black-checker specialization, critical row and diagonal, exact Table 2 case, blockers, Phase 1, and Phase 2.
- Pan, zoom, and collapse the full branching tree.
- Play any selected root-to-leaf game step by step.
- View terminal subsets with multiplicities and the Section 2.6 tableau attached to each individual game.
- Click a tableau entry to return to the distinguished checker move that created it.
- Enter a Young tableau's row lengths and entries to find every starting position on the smallest possible board and view all of their sibling tableaux.
- Compare multiple shapes using complete ladder diagrams of all semistandard fillings up to a shared maximum entry, with minimum-board games and clickable recording events under each tableau.
- Group tableaux by their minimal checker-game starting positions using exactly the requested `k` white checkers; table rows can have different board sizes.

The sticky **Show checker move arrows (all boards)** toggle beside **Only white checkers** overlays white-checker moves. Purple marks swaps, including Phase 2 cleanup joined with a rounded elbow; orange marks west slides; blue marks north slides that record tableau entries. Intermediate boards show their incoming move, while terminal boards show exactly one continuous route per white checker, following its complete game history. Small circles mark the starting squares, including stationary checkers. Initial boards and the inspector’s before board have no arrows.

**Show initial positions** adds light gray outlines of the initial white checkers to every final game board. **Show critical squares** gives each tableau-recording move's descending black checker square a bolder border and labels it with the recorded tableau entry. Final boards show the complete recording history; intermediate boards show only entries already recorded. Both toggles work independently of the move arrows and remain active when exploring other games.

**Show final white checkers** is on by default. Turn it off to hide the white checkers on the main diagonal of final game boards, while still showing any enabled initial outlines, move arrows, and critical-square labels. This applies to all final boards, including those in the three tableau panels.

## Start from a tableau

Use **Start from a Young tableau** below the checker input. Enter weakly decreasing row lengths (for example `2, 1`), then fill the cells with positive integers. Rows must weakly increase and columns must strictly increase. These are straight semistandard tableaux in the same convention as Final Results, not skew tableaux.

Click **Find checker game & siblings**. The final boards of all matching games appear in the input section, grouped by their minimal starting positions. All five board display toggles apply. Final Results groups every sibling game by its starting position and marks every game corresponding to your input. Each start has a **Trace the input tableau’s game** button; **Explore this starting position** opens its full flow tree. You can also click individual tableau entries to inspect their recording moves.

A tableau without the Schubert input partitions need not specify a unique starting position. The search exhausts the smallest matching board size `n` and returns every matching start, ordered by `k` and lexicographic `A`. Each start keeps its own full sibling tree; games from different starts are not merged even if their tableaux agree. Minimum boards can be smaller than the paper's examples. Blank row lengths represent the empty tableau, whose smallest positive board is `1 × 1`, with two possible starts: `k=0` and `k=1`.

The inverse uses exhaustive forward generation, rather than an unproved inverse formula. Shape fixes `B`, so only `A` and `k` need enumeration. Search limits are adjustable: by default it searches through `n=10`, with 500,000 total generated states and 12,000 states per candidate tree. Progress and cancellation are available. If any limit interrupts the search, no partial list is presented as complete and no candidate is silently skipped. Large inputs may require increasing the limits and can be expensive; a failed bounded search does not prove nonexistence.

The mathematical engine is pure TypeScript and is independent of the user interface.

## Compare tableau ladders

Open **Tableau ladders & checker games** (or use **Compare tableau ladders** at the top). Enter row lengths, such as `2, 1`, and a shared maximum entry. No filling is needed. **Generate tableaux & games** creates every semistandard filling and all ladder moves that increase one box by exactly 1. The layered diagram shows each tableau once, including paths that join. Edge labels `+1 (r,c)` identify the changed box; levels count increments from the minimum filling.

Use **+ Add another shape** and **Remove shape** to compare diagrams side by side with the same entry bound. Each diagram runs left to right from its root, scrolls independently, and has zoom, fit-width, and fit-height controls. Shape `(2,1)` with maximum entry `3`, for example, has eight tableaux. A column taller than the entry bound has no valid fillings; the empty shape has one empty tableau.

Under each tableau, the app displays all checker games recording that filling on its minimum board, with their final checkerboards and initial subsets. All five board display toggles apply. Click a game to open its final position and trace its path. Click a tableau entry to inspect its actual recording move. If there are multiple games, select which game supplies the entry events. Final Results retains all minimal starting positions and their siblings for the selected tableau. Your comparison diagrams and scroll positions remain available while inspecting a game.

Games populate progressively. **Cancel analysis** keeps completed searches; generating again reuses them and retries pending or failed searches. **Analysis limits** controls tableaux per shape (default 200), maximum searched board (default 10), and generated states per tableau (default 500,000). The individual game-tree limit comes from the filled-tableau section. A diagram exceeding its tableau limit is rejected rather than truncated. A checker search that hits a limit is labeled on that tableau; other tableaux still complete, and no incomplete search is presented as a minimum-board result.

## Equivalent tableaux

See [the inverse investigation](INVERSE_RESEARCH.md) for an explicit minimum-start formula, its proof using tableau dominance, an equivalent-tableaux signature, and a tested conjectural rule for selecting the game directly. The implementation and regression checks are in `src/math/directTableauInverse.ts` and `test/direct-inverse.test.mjs`.

Open **Equivalent tableaux**, enter row lengths and an entry bound `k`, then click **Generate equivalence table**. Every game in this section uses exactly `k` white checkers, even if its tableau does not contain the entry `k`. Entries range from `1` through `k`; rows weakly increase and columns strictly increase.

Enable **Only rows with multiple equivalent tableaux** to hide starts with just one distinct tableau. The toggle filters the existing results immediately without repeating the search; multiple games for the same tableau count as one tableau.

Each tableau is displayed beside its own game's final board. All five sticky board display toggles apply here, in the filled-tableau and ladder panels, in move inspection, and in Final Results.

For every filling, the search establishes its own smallest possible board using exactly `k` checkers, then groups fillings that share the same minimal starting position `(n,A,B)`. Rows can have different board sizes, and each board is minimal for every tableau listed in its row. All starts on each tableau's smallest board are retained. Copies occurring on larger boards do not enter the equivalence table.

Each table row shows its minimum board size and initial subsets `A` and `B`, with final checkerboards beside the corresponding tableaux. Click **Explore starting position** to open the root, **Trace this game** to open a terminal path, or an entry to inspect its Section 2.6 recording event. Final Results retains the complete sibling tree for exploration, including siblings that may have smaller boards elsewhere; those siblings are excluded from this equivalence row. A tableau can appear in several rows when it admits several minimal starts.

For shape `(2,1)` and `k=3`, the table has seven minimal starting positions covering all eight fillings: five rows on `n=5` and two on `n=6`. The `n=5, A={2,4,5}, B={1,3,5}` row groups `[[1,2],[3]]` with `[[1,2],[2]]`. The paper's `n=6, A=B={2,4,6}` start is excluded because all four of its tableaux already occur on smaller boards.

Limits cover the entire equivalence analysis: by default 500 tableaux, boards through `n=10`, 2,000,000 generated states, and the individual-game-tree limit set above. If a search hits a limit or is cancelled, no incomplete table is displayed as complete and no unverified board is called minimal.

## Public website

The GitHub Pages address for this repository is:
https://schwester-ester.github.io/vakil-checker-games/

The `Publish website` workflow in `.github/workflows/pages.yml` rebuilds and tests
the app, then publishes it whenever changes are pushed to `main`. It can also be
run manually from GitHub's **Actions** tab. In the repository's **Settings → Pages**,
the publishing source must be **GitHub Actions**.

Only `index.html`, `styles.css`, and the compiled `dist/` files are deployed.
All calculations run in the visitor's browser, so the website does not need a
backend server and remains available when your computer is off.

## Run locally

The compiled `dist/` directory is included. From the project directory, serve the files with any static HTTP server, for example:

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Rebuild and test

With Node.js and npm installed:

```bash
npm install
npm test
npm run serve
```

The test suite checks the prescribed specialization words, all nine Table 2 positions, blocker detection, happiness, Phase 2 cleanup in both directions, invalid inputs, subset-to-partition conventions, and the exact Figure 6 and Figure 7 outputs and tableaux. Inverse tests verify round trips, preservation of siblings, cancellation and limit handling, and minimality against an independently enumerated database of every game through `n=5`.

Ladder tests compare every vertex and edge with independent filling enumeration, verify paths that join, reject truncated diagrams, and round-trip every tableau of shape `(2,1)` with entry bound `3` through the checker-game search.

## Source layout

```text
src/math/                 Pure checker-game engine
src/components/           SVG and DOM user-interface components
src/main.ts               Application state and interactions
MATHEMATICS.md            Exact executable rule specification
test/math.test.mjs        Mathematical regression tests
```

## Reference

Ravi Vakil, *A Geometric Littlewood–Richardson Rule*, arXiv:math/0302294, especially §§2.2–2.6, Figures 1–7, and Table 2.

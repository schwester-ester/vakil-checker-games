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

## Start from a tableau

Use **Start from a Young tableau** below the checker input. Enter weakly decreasing row lengths (for example `2, 1`), then fill the cells with positive integers. Rows must weakly increase and columns must strictly increase. These are straight semistandard tableaux in the same convention as Final Results, not skew tableaux.

Click **Find checker game & siblings**. All recovered initial checker positions appear in the input section. Final Results groups every sibling game by its starting position and marks every game corresponding to your input. Each start has a **Trace the input tableau’s game** button; **Explore this starting position** opens its full flow tree. You can also click individual tableau entries to inspect their recording moves.

A tableau without the Schubert input partitions need not specify a unique starting position. The search exhausts the smallest matching board size `n` and returns every matching start, ordered by `k` and lexicographic `A`. Each start keeps its own full sibling tree; games from different starts are not merged even if their tableaux agree. Minimum boards can be smaller than the paper's examples. Blank row lengths represent the empty tableau, whose smallest positive board is `1 × 1`, with two possible starts: `k=0` and `k=1`.

The inverse uses exhaustive forward generation, rather than an unproved inverse formula. Shape fixes `B`, so only `A` and `k` need enumeration. Search limits are adjustable: by default it searches through `n=10`, with 500,000 total generated states and 12,000 states per candidate tree. Progress and cancellation are available. If any limit interrupts the search, no partial list is presented as complete and no candidate is silently skipped. Large inputs may require increasing the limits and can be expensive; a failed bounded search does not prove nonexistence.

The mathematical engine is pure TypeScript and is independent of the user interface.

## Run

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

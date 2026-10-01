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

The test suite checks the prescribed specialization words, all nine Table 2 positions, blocker detection, happiness, Phase 2 cleanup in both directions, invalid inputs, subset-to-partition conventions, and the exact Figure 6 and Figure 7 outputs and tableaux.

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

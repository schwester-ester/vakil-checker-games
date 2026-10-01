# Executable specification of Vakil's checker rule

This note records the conventions implemented in `src/math/`. It follows Section 2 of Ravi Vakil's *A Geometric Littlewood–Richardson Rule*.

## Board and black-checker specialization

Rows are numbered `1,…,n` from top to bottom and columns `1,…,n` from left to right. A black configuration has exactly one checker in each row and column.

The initial black checkers are

```text
(1,n), (2,n-1), …, (n,1),
```

and the final black checkers are `(1,1),…,(n,n)`. The prescribed simple-reflection sequence is

```text
[n-1], [n-2,n-1], …, [1,2,…,n-1].
```

At a reflection `e_j`, the black checker in row `j` descends one square and the checker in row `j+1` rises one square. If their columns are `d` and `q`, respectively, then `q<d`. The critical row is row `j`, and the critical diagonal is

```text
(j+1,q), (j+2,q+1), …, (j+d-q,d-1).
```

## White checkers and happiness

A white configuration has at most one checker in each row and column. A white checker at `(r,c)` is happy precisely when

```text
(row of the black checker in column c) ≤ r
and
(column of the black checker in row r) ≤ c.
```

For `A={a_1<⋯<a_k}` and `B={b_1<⋯<b_k}`, the initial white checkers are

```text
(a_1,b_k), (a_2,b_{k-1}), …, (a_k,b_1).
```

If an initial white checker is unhappy, there are no checker games for that input.

## Phase 1: exact Table 2 cases

Let the critical-row status be:

- `α`: the white checker in the critical row is on the descending black checker;
- `β`: the critical row contains a white checker elsewhere;
- `γ`: the critical row contains no white checker.

Let the critical-diagonal status be:

- `A`: the top white checker on the critical diagonal is on the rising black checker;
- `B`: the top white checker lies farther southeast on the critical diagonal;
- `C`: the critical diagonal contains no white checker.

The implementation encodes the following table literally:

|                     | α: on descending | β: elsewhere in critical row | γ: none in critical row |
|---------------------|------------------|-------------------------------|-------------------------|
| A: on rising        | swap             | swap                          | stay †                  |
| B: diagonal elsewhere | swap           | stay, and also swap iff there is no blocker | stay |
| C: no diagonal white | stay            | stay                          | stay                    |

A blocker is a white checker lying strictly inside the rectangle whose opposite corners are the critical-row white checker and the top critical-diagonal white checker.

A **swap** exchanges the columns of those two distinguished white checkers. A **stay** leaves all white checkers fixed in Phase 1.

## Phase 2

After the black move, every unhappy white checker is slid either left in its row or up in its column to restore happiness while preserving distinct rows and columns. On every legal checker-game state the destination is unique. The engine searches all legal left/up destinations and asserts this uniqueness; a failure therefore becomes an explicit invariant error rather than a silent choice.

## Branches and terminal output

Each allowed Phase-1 action creates a separate child node. Paths are never merged, even when they later reach the same state or terminal subset. At the final diagonal black position, every white checker lies on a black checker. Their row indices form the terminal `k`-subset `S`.

## Tableaux

In the distinguished `A-γ` move marked `†`, let the rising white checker be the `r`-th white checker in top-to-bottom row order and the `c`-th white checker in left-to-right column order, computed in the current pre-move state. Record the entry `r` in tableau row `c`.

The events occur from right to left within a tableau row, so each new entry is prepended. The engine stores the event and its checker step on the branch itself; the tableau is not inferred from the terminal subset.

## Regression checks

The test suite verifies:

- the prescribed words for `n=2,3,4`;
- all nine Table 2 positions and the blocker exception;
- happiness and both cleanup directions;
- invalid and zero initial inputs;
- dynamic row/column ranks for tableau events;
- Figure 6: outputs `{2,3}` and `{1,4}`, with one-cell tableaux `2` and `1`;
- Figure 7: `{2,3,4}+2{1,3,5}+{1,2,6}`, with four distinct paths;
- every valid pair of initial subsets through `n=6` (622 generated games of inputs) satisfies the executable invariants.

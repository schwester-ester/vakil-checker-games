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

## Exhaustive tableau-to-game search and minimality

The input is a straight semistandard tableau `T` of shape `beta`. Trailing empty rows are ignored. A tableau alone does not specify the other Schubert input `alpha`, so there can be multiple starts with the same recorded tableau. We return all such starts on the minimum board, including all possible values of `k`.

Every tableau entry is a row rank in `{1,...,k}`. Thus `k >= max(number of nonempty rows, largest entry)`. Its shape fits inside the `k × (n-k)` rectangle, so `n >= k + beta_1`. These bounds exclude all smaller boards without generating them. The empty tableau is handled on the smallest positive board, `n=1`, where the specialization word is empty.

For each remaining `n` in increasing order, enumerate every `k` from that lower bound through `n-beta_1`. The existing shape invariant says that the recorded tableau has shape `partitionFromSubset(n,k,B)`, so the unique possible second subset is

```text
B_i = n-k+i-beta_i   (i=1,...,k; pad beta with zeros).
```

This is an increasing `k`-subset: adjacent differences are `1+beta_i-beta_(i+1) >= 1`, and the rectangle bound places it in `{1,...,n}`. Enumerate every `A` in lexicographic order, discard exactly the initially unhappy configurations (which have no games), and run `generateGameTree` on every remaining start. Compare the input to each leaf's actual Section 2.6 event tableau, including its shape and all entries. After finding a match, finish enumerating that entire board size. Return every matching start's full tree and all matching leaf IDs, retaining every sibling path. The empty tableau on `n=1` has both `k=0` and `k=1` starts.

**Minimality and completeness proof.** Any game recording `T` satisfies the bounds above, and its `B` is the subset just derived. Thus the enumeration includes every possible game recording `T` on every smaller positive board and on the first matching board. Exhausting all smaller sizes proves minimality; exhausting every candidate on the matching size proves that the returned set of starts is complete. Results are ordered by increasing `k`, lexicographic `A`, and existing leaf order. This proof uses the forward map and shape invariant, not a conjectural direct inverse. Node limits and cancellation abort the entire search, even if some matches have already been found; skipping an oversized candidate or presenting a partial set as complete is forbidden.

The database for regression testing independently enumerates all pairs `(A,B)` through `n=5`, records each tableau's smallest board and every matching start and leaf on that board, and compares those complete results with the inverse search. No persistent database or network service is needed for the website.

## Complete ladder diagrams

For a fixed straight shape `beta` and entry bound `m`, the ladder vertices are all semistandard fillings with entries in `{1,...,m}`. An edge `T -> U` increases exactly one cell by 1 and preserves semistandardness. The diagram is a directed acyclic graph: different legal increment sequences may meet at the same filling. We retain every edge and show each filling once, instead of duplicating it along different paths in a tree.

The componentwise minimum filling places `r` in every box of row `r` (rows numbered from 1). It exists iff the shape has at most `m` rows. The empty shape has one empty filling. For any nonminimal filling, choose the first cell in top-to-bottom, left-to-right order whose entry exceeds its minimum. Its left neighbor, if present, has the row's minimum, and its upper neighbor has the preceding row's minimum. Decreasing that cell by 1 preserves the weak row and strict column inequalities; the right and lower inequalities also remain true. Iterating reaches the minimum filling. Reversing those decrements proves that exploring every legal single-cell increment from the minimum reaches every valid filling.

The implementation uses a breadth-first traversal, keyed by the full tableau shape and entries. Every vertex has level `sum(T[r,c] - r)`; every edge raises the level by exactly 1. All legal increments are recorded even when their destination was previously visited. A tableau-count limit rejects the whole diagram rather than silently omitting vertices or edges.

Each vertex independently uses the exhaustive minimum-board inverse above. All matching checker-game paths on all minimal starting positions are shown under that tableau. The chosen game's stored Section 2.6 events supply the tableau-cell interactions, so a click always traces an actual recording move. Every matching start's full sibling tree remains available in the common checker-game explorer. Completed correspondences may be shared between identical tableaux in different comparison panels; failed or interrupted searches remain explicitly labeled.

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

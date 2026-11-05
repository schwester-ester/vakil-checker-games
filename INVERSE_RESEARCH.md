# A minimal starting position from a tableau

This note separates a consequence of the established tableau characterization from an experimentally verified local inverse rule. The functions are in `src/math/directTableauInverse.ts`, with independent forward-engine checks in `test/direct-inverse.test.mjs`. The website still uses its existing exhaustive algorithms.

## Conventions and the established correspondence

Fix a straight semistandard tableau `T` of shape `beta`, and **exactly** `k` white checkers, where `k >= max(T)`. Pad partitions with zero rows through row `k`. Use the project's coordinates: rows increase downward; columns increase rightward; initial black checkers occupy `(r,n+1-r)`.

The largest recorded entry is a row rank, so it only gives a lower bound on the white count in an arbitrary game. Taking `k=max(T)` selects the smallest permitted count for a nonempty tableau. The website's equivalence section instead uses its chosen alphabet bound as the exact count, even for tableaux not containing that bound.

Section 2.6 of [Vakil's paper](https://arxiv.org/pdf/math/0302294) records the row rank in the tableau row given by column rank at each dagger move. Theorem 4.2 identifies this map with the tableaux bijection. For fixed input partitions `alpha,beta`, its target is the usual `alpha`-dominant tableaux of shape `beta`; the output partition is `gamma=alpha+wt(T)`.

The dominance characterization is also given in [van Leeuwen, *Schur functions and alternating sums*, Section 5, equations (51) and (53)](https://www.combinatorics.org/ojs/index.php/eljc/article/download/v11i2a5/pdf/). In reverse row-word conventions it requires `alpha + content(prefix)` to be a partition for every prefix. These existing results are the inputs to the minimality proof below, rather than conclusions drawn from finite tests.

## Prefix deficits

Read the rows of `T` from top to bottom, each row from **right to left**. Let `C_j(p)` count letters `j` in the first `p` letters, including the empty prefix `p=0`. Define

```text
d_j = max_p (C_(j+1)(p) - C_j(p)),       j=1,...,k-1.
w_j = total number of entries j.
```

All `d_j` are nonnegative because the empty prefix is included. They are the initial reserves needed to keep the running counts weakly decreasing.

An equivalent formula makes the extension of the user's one-row counts explicit. If `n_(r,j)` is the number of entries `j` in tableau row `r`, then

```text
d_j = max(0, max_r [sum_(s<=r) n_(s,j+1) - sum_(s<r) n_(s,j)]).
```

In a weakly increasing row, reverse reading consumes every `j+1` before any `j`; that is where the deficit reaches its maximum within that row. Thus the formula considers each successive row, rather than only the total content of the tableau.

## The minimal starting position: a theorem

Define

```text
alpha*_k = 0,
alpha*_i = d_i + ... + d_(k-1),
gamma*_i = alpha*_i + w_i,
L = gamma*_1 = w_1 + d_1 + ... + d_(k-1),
n* = k + L.
```

Then the unique minimum-board starting position for `T` with exactly `k` whites is

```text
A_i = L + i - alpha*_i = i + w_1 + sum_(j<i) d_j,
B_i = L + i - beta_i,                   i=1,...,k.
```

Place the whites at `(A_i, B_(k+1-i))`. Its corresponding game ends on diagonal squares `(S_i,S_i)` with

```text
S_i = L + i - gamma*_i = A_i - w_i.
```

### Proof

The dominance condition is equivalent to the separate inequalities

```text
alpha_i - alpha_(i+1) >= d_i,           i=1,...,k-1,
alpha_k >= 0.
```

Their unique smallest solution is `alpha*`. For any admissible `alpha`, its first part is at least `D=sum d_i`; if any gap inequality is strict, or `alpha_k>0`, its first part is strictly larger than `D`.

The output partition has first part `gamma_1=alpha_1+w_1`. It must fit inside the `k by (n-k)` rectangle. Consequently every game recording `T` has

```text
n >= k + gamma_1 >= k + D + w_1 = n*.
```

The second input shape also fits at `n*`. If `t_j` counts entries `j` in the top tableau row, its reverse reading gives `d_j >= t_(j+1)`. Therefore

```text
L = w_1 + sum d_j >= t_1 + ... + t_k = beta_1.
```

The dominance inequalities ensure `gamma*` is a partition, and both `gamma*` and `beta` fit the rectangle of width `L`. The established bijection supplies a game for this dominant tableau with input `alpha*,beta` and output `gamma*`. This attains the lower bound.

On a board of size `n*`, the inequalities force `alpha_1=D`, hence every gap is exactly `d_i` and `alpha_k=0`. This proves the starting position is unique. The tableaux bijection for these fixed boundary partitions also makes the matching game unique, though its starting position can have other sibling games recording different tableaux.

This is a proof using the established dominance characterization and Vakil's bijection. It does not depend on proving the experimental local branch rule below.

### What minimality means in checker coordinates

For the particular recorded tableau `T`, a game is minimal precisely when

```text
A_1 = w_1 + 1,
A_(i+1) - A_i = d_i + 1,
A_k = n,
B_i = n-k+i-beta_i.
```

The `j`-th gap between occupied starting rows has exactly `d_j` unused rows. There are exactly `w_1` unused rows above the topmost white, and none below the bottommost white. These are the smallest reserves that allow `T`.

Having a white on the bottom board row and a terminal white at `(1,1)` is necessary, but insufficient. For example, on `n=6`, `A=B={2,4,6}` records `T=[[1,2],[3]]` on one branch and its output contains `1`. That tableau already occurs on `n=5`, `A={2,4,5}`, `B={1,3,5}`: the larger start has an unnecessary row gap.

Minimality belongs to a game/tableau pair. A starting tree may contain both minimal and nonminimal sibling leaves, as the equivalence section already accounts for.

For a nonempty tableau, increasing the white count beyond its largest entry simply appends zero deficits and zero content to these formulas. It increases `n*` by the same amount. Thus the unrestricted minimum also occurs uniquely at `k=max(T)`. The empty tableau needs a separate count convention: with fixed positive `k`, its minimum is `n=k`.

## Generalizing the diagonal-drop pattern

Number the initial whites from northeast to southwest, so white `i` has row `A_i` and column `B_(k+1-i)`. Its initial black checker in that column has row

```text
R_i^0 = n+1-B_(k+1-i) = i + beta_(k+1-i).
```

The minimum-board white is obtained by dropping this diagonal white by

```text
Delta_i = w_1 + sum_(j<i) d_j - beta_(k+1-i).
```

These drops are nonnegative. When `n*` exceeds the top tableau's board `k+beta_1`, translate its checker columns to the right by `n*-(k+beta_1)` before applying the drops. The diagonal row formula stays the same under this translation. Enlarging the board is sometimes essential.

For one row with `n_j` copies of `j`, `d_j=n_(j+1)`, so

```text
A_i = i + n_1 + ... + n_i,
n* = k + beta_1.
```

For `i<k`, the diagonal row is `i`, giving exactly the user's cumulative drop. For `i=k`, the diagonal row is already `k+beta_1`, giving zero drop. When `k=max(T)`, the northeasternmost whites relevant to entries `j<k` are shifted by these cumulative counts; the southwesternmost one already lies at the bottom of the board.

This last endpoint is a small correction to applying the cumulative-drop expression literally to every checker: the southwesternmost checker must remain on its diagonal square, rather than be dropped by another whole row length.

## Consequence for equivalent tableaux

For the same shape and exact white count, two tableaux share a minimal starting position **if and only if** their signatures

```text
(w_1, d_1, ..., d_(k-1))
```

are identical. The entries themselves can differ; the minimal reserves are what matter.

For shape `(2,1)` and `k=3`:

| Tableau rows | `w_1` | `(d_1,d_2)` | Minimum `n` | `A` | `B` |
| --- | --- | --- | --- | --- | --- |
| `[[1,2],[2]]` | 1 | (1,0) | 5 | {2,4,5} | {1,3,5} |
| `[[1,2],[3]]` | 1 | (1,0) | 5 | {2,4,5} | {1,3,5} |
| `[[1,3],[3]]` | 1 | (0,2) | 6 | {2,3,6} | {2,4,6} |

The first two are equivalent. The last requires a larger board even though the shape and maximum entry are unchanged. For fixed `k`, each tableau belongs to one minimum-start group; the exhaustive implementation's earlier allowance for overlapping minimum-start groups is unnecessary under this theorem.

## An explicit inverse with established correctness

`tableauGameFromMinimalStart(T,k)` performs the following:

1. Compute the prefix deficits and the starting position above.
2. Run the existing forward engine at that single position, generating its siblings.
3. Select the unique leaf whose Section 2.6 recording is `T`.

This is a complete inverse supported by the minimality proof and established bijection. It searches neither other starting positions nor larger boards. A resource limit throws rather than returning incomplete output.

## A stronger local inverse: conjectural, tested

`directTableauGame(T,k)` avoids generating siblings as well. Maintain a pointer to the **rightmost unconsumed entry in each tableau row**. Play the prescribed black schedule, applying the project's usual forced moves and Phase 2 cleanup.

At the only optional move, an unblocked `B-beta` case:

- Let `Q` be the top white on the critical diagonal.
- Let `q` be its current top-to-bottom white rank and `c` its current left-to-right white rank.
- Let `t` be the next unconsumed entry of tableau row `c`.
- **Swap if `t<q`; otherwise stay.** An absent `t` also selects stay.

At a dagger move, the actual recorded entry must equal that tableau row's next entry; consume it. Check at the end that every box was consumed and the terminal subset equals the formula for `S`.

The intuition is that a swap allows the checker occupying the smaller column to pass into a smaller white row rank; the target entry tells whether that crossing is needed. A general proof must show that this current crossing is necessary exactly when `t<q`, and that the remaining tableau stays realizable afterward, including states with blockers and intermediate white ranks. A finite test suite does not establish those claims.

For the equivalent pair in the table above, the decisive optional move has `c=2`, `q=3`. The next entry is `2` for the first tableau, so it swaps; it is `3` for the second, so it stays. Thus the inverse uses the tableau to distinguish sibling paths even though their minimum start agrees.

## Computation and reproducibility

The new regression test enumerates **every happy pair of initial subsets** for `1<=n<=8`, `1<=k<=min(5,n)`. It checks both directions of the dominance/rectangle characterization against actual forward leaves; independently records each tableau's first board; checks unique minimal starts; and compares the direct inverse's entire state sequence and actions against the existing forward path.

Results:

- 6,505 starting positions;
- 11,293 complete checker games;
- 3,048 distinct `(k,T)` pairs;
- 12,188 optional branch decisions along those paths, counting a shared decision once per complete path containing it;
- no formula, minimal-start, admissibility, branch-choice, or state-sequence mismatches.

A separate test checks all 465 tableaux in the three families `(shape,k)=((3,2,1),5), ((4,2,1),4), ((2,2,1,1),5)` against their complete sibling trees at the formula's starts. These reach larger boards than the exhaustive bound, but their minimum sizes are certified by the proof, not by an exhaustive larger-board database.

Run with the project's Node installation:

```sh
npm run build
node --test test/direct-inverse.test.mjs
```

The forward engine and the inverse reuse the same Table 2/cleanup primitives. This is strong evidence that the proposed inverse matches **the project's forward map**, rather than an independent verification of every convention in the original paper. The mathematical starting-position proof rests on the cited established bijection and dominance rule; the local branch rule remains a conjecture.

import test from "node:test";
import assert from "node:assert/strict";
import { generateTableauLadder } from "../dist/math/tableauLadder.js";
import { filledTableauKey, validateFilledTableau } from "../dist/math/inverseTableau.js";
import { minimalTableauStart } from "../dist/math/directTableauInverse.js";
import { generateGameTree } from "../dist/math/generateGames.js";
import { tableauFromEvents, tableauValues } from "../dist/math/tableau.js";
import { initialWhiteConfiguration, validateInitialWhite } from "../dist/math/validation.js";

// The note's d_1,...,d_k, including d_1; compute directly from its word.
function deficits(rows, k) {
  const counts = Array(k + 1).fill(0), d = Array(k).fill(0);
  for (const row of rows) for (const value of [...row].reverse()) {
    counts[value]++;
    for (let j = 1; j <= k; j++) d[j - 1] = Math.max(d[j - 1], counts[j] - counts[j - 1]);
  }
  return d;
}
const sum = xs => xs.reduce((a, b) => a + b, 0);
const cumulative = xs => xs.map((_, i) => sum(xs.slice(0, i + 1)));
function extremes(shape, k) {
  const bottom = shape.map((length, r) => Array(length).fill(r + 1));
  const top = shape.map((length, r) => Array.from({ length }, (_, c) =>
    k - shape.filter(length => length > c).length + r + 1));
  return { bottom, top };
}
function* shapes(size, bound = size, prefix = []) {
  if (!size) { yield prefix; return; }
  for (let part = Math.min(size, bound); part >= 1; part--) yield* shapes(size - part, part, [...prefix, part]);
}

// Independent exhaustive filling enumeration, without ladder edges.
function enumerate(shape, k) {
  const rows = shape.map(length => Array(length).fill(0)), result = [];
  const cells = shape.flatMap((length, r) => Array.from({ length }, (_, c) => [r, c]));
  function fill(index) {
    if (index === cells.length) { result.push(rows.map(row => [...row])); return; }
    const [r, c] = cells[index];
    const lo = Math.max(1, c ? rows[r][c - 1] : 1, r ? rows[r - 1][c] + 1 : 1);
    for (let value = lo; value <= k; value++) { rows[r][c] = value; fill(index + 1); }
  }
  fill(0);
  return result;
}

function lowerToward(rows, target) {
  const next = rows.map(row => [...row]);
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
    if (rows[r][c] > target[r][c]) { next[r][c]--; return next; }
  }
  return null;
}

test("proof lemmas: extremal tableaux, saturated paths, prefix maxima and all cover changes", () => {
  let families = 0, tableaux = 0, covers = 0, pathSteps = 0, checkerSteps = 0;
  for (let k = 1; k <= 4; k++) for (let size = 0; size <= 7; size++) for (const shape of shapes(size)) {
    if (shape.length > k) continue;
    families++;
    const ladder = generateTableauLadder(shape, k, 100000);
    const independent = enumerate(shape, k);
    assert.deepEqual(ladder.nodes.map(n => n.id).sort(), independent.map(filledTableauKey).sort());
    const keys = new Set(ladder.nodes.map(n => n.id));
    const { bottom, top } = extremes(shape, k);
    const lambda = Array.from({ length: k }, (_, i) => shape[k - 1 - i] ?? 0);
    assert.deepEqual(deficits(top, k), lambda.map((x, i) => x - (lambda[i - 1] ?? 0)));
    assert.deepEqual(deficits(bottom, k), [shape[0] ?? 0, ...Array(k - 1).fill(0)]);
    for (const { rows } of ladder.nodes) {
      tableaux++;
      const d = deficits(rows, k), start = minimalTableauStart(rows, k);
      assert.deepEqual(d, [start.content[0], ...start.deficits]);
      assert.equal(start.n, k + sum(d));
      const D = cumulative(d);
      assert.deepEqual(start.A, D.map((x, i) => x + i + 1));
      assert.ok(D.every((x, i) => x >= lambda[i]));
      assert.ok(sum(d) >= (shape[0] ?? 0));
      // A different order exists for initial checker configurations on a common
      // board. Its intermediate gap vectors need not come from tableaux.
      const A = lambda.map((x, i) => x + i + 1);
      assert.ok(validateInitialWhite(start.n, k, initialWhiteConfiguration(A, start.B)).valid);
      while (A.some((x, i) => x < start.A[i])) {
        let i = k - 1;
        while (A[i] === start.A[i]) i--;
        const beforeD = A.map((x, j) => x - j - 1);
        const beforeGaps = beforeD.map((x, j) => x - (beforeD[j - 1] ?? 0));
        A[i]++;
        const afterD = A.map((x, j) => x - j - 1);
        const afterGaps = afterD.map((x, j) => x - (afterD[j - 1] ?? 0));
        assert.deepEqual(afterGaps, beforeGaps.map((x, j) => x + (j === i ? 1 : j === i + 1 ? -1 : 0)));
        assert.ok(validateInitialWhite(start.n, k, initialWhiteConfiguration(A, start.B)).valid);
        checkerSteps++;
      }
      assert.deepEqual(A, start.A);
      // Reach any target from the top, then reach the bottom from that target.
      for (const [source, target] of [[top, rows], [rows, bottom]]) {
        let current = source;
        while (true) {
          const next = lowerToward(current, target);
          if (!next) break;
          assert.deepEqual(validateFilledTableau(next), []);
          assert.ok(keys.has(filledTableauKey(next)));
          assert.equal(sum(current.flat()) - sum(next.flat()), 1);
          current = next; pathSteps++;
        }
        assert.deepEqual(current, target);
      }
    }
    const nodes = new Map(ladder.nodes.map(n => [n.id, n.rows]));
    for (const edge of ladder.edges) {
      covers++;
      const before = nodes.get(edge.to), after = nodes.get(edge.from);
      const q = before[edge.row][edge.col]; // q -> q-1 in the descending direction.
      const word = before.flatMap(row => [...row].reverse());
      const m = sum(before.slice(0, edge.row).map(row => row.length)) + before[edge.row].length - edge.col;
      const counts = Array(k + 1).fill(0), A = Array(k).fill(0), B = Array(k).fill(-Infinity);
      for (let p = 0; p <= word.length; p++) {
        if (p) counts[word[p - 1]]++;
        for (let j = 1; j <= k; j++) {
          const v = counts[j] - counts[j - 1];
          if (p < m) A[j - 1] = Math.max(A[j - 1], v);
          else B[j - 1] = Math.max(B[j - 1], v);
        }
      }
      const actual = deficits(after, k), old = deficits(before, k);
      for (let j = 1; j <= k; j++) {
        const epsilon = j === q - 1 || j === q + 1 ? 1 : j === q ? -2 : 0;
        assert.equal(actual[j - 1], Math.max(A[j - 1], B[j - 1] + epsilon));
      }
      // A lone deficit decrease is impossible on every edge out of the top.
      if (edge.to === filledTableauKey(top)) {
        assert.ok(!actual.every((x, i) => x <= old[i]) || actual.every((x, i) => x === old[i]));
      }
    }
  }
  console.log("Proof-order exhaustive checks: " + JSON.stringify({ families, tableaux, covers, pathSteps, checkerSteps }));
});

test("the one-box obstruction is realized by the actual forward checker engine", () => {
  for (const [rows, expectedD, expectedA] of [
    [[[2]], [0, 1], [1, 3]],
    [[[1]], [1, 0], [2, 3]],
  ]) {
    const start = minimalTableauStart(rows, 2);
    assert.deepEqual(deficits(rows, 2), expectedD);
    assert.deepEqual(start.A, expectedA);
    assert.deepEqual(start.B, [1, 3]);
    assert.equal(start.n, 3);
    const tree = generateGameTree(start.n, start.A, start.B);
    assert.equal(tree.leaves.length, 1);
    assert.deepEqual(tableauValues(tableauFromEvents(tree.leaves[0].state.tableauEvents, 2)).filter(row => row.length), rows);
  }
});

test("even a forced one-cell chain need not move one checker south", () => {
  const chain = [[[2], [3]], [[1], [3]], [[1], [2]]];
  assert.deepEqual(generateTableauLadder([1, 1], 3).nodes.map(n => n.rows).reverse(), chain);
  assert.deepEqual(chain.map(rows => deficits(rows, 3)), [[0, 1, 0], [1, 0, 1], [1, 0, 0]]);
  assert.deepEqual(chain.map(rows => minimalTableauStart(rows, 3).A), [[1, 3, 4], [2, 3, 5], [2, 3, 4]]);
  // All three recordings occur uniquely at their formula's starts.
  for (const rows of chain) {
    const s = minimalTableauStart(rows, 3), tree = generateGameTree(s.n, s.A, s.B);
    const matches = tree.leaves.filter(leaf => filledTableauKey(tableauValues(tableauFromEvents(leaf.state.tableauEvents, 3))) === filledTableauKey(rows));
    assert.equal(matches.length, 1);
  }
  // Distinct tableaux can even have identical deficits and starts.
  assert.deepEqual(deficits([[1, 2], [3]], 3), deficits([[1, 2], [2]], 3));
  // A single descending chain cannot visit all six two-box tableaux over {1,2,3}.
  const ladder = generateTableauLadder([2], 3);
  assert.equal(ladder.nodes.length, 6);
  assert.equal(Math.max(...ladder.nodes.map(n => n.level)) + 1, 5);
});

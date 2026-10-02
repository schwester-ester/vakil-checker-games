import test from "node:test";
import assert from "node:assert/strict";
import { findMinimalTableauGames, filledTableauKey, validateFilledTableau } from "../dist/math/inverseTableau.js";
import { BranchLimitError, generateGameTree } from "../dist/math/generateGames.js";
import { initialWhiteConfiguration, validateInitialWhite } from "../dist/math/validation.js";
import { tableauFromEvents, tableauValues } from "../dist/math/tableau.js";

const values = (tree, leaf) => tableauValues(tableauFromEvents(leaf.state.tableauEvents, tree.k));

test("filled tableau validation rejects malformed diagrams and fillings", () => {
  for (const rows of [[[1], [2, 3]], [[2, 1]], [[1], [1]], [[0]], [[1.5]], [[NaN]], [[], [2]]]) {
    assert.ok(validateFilledTableau(rows).length > 0, JSON.stringify(rows));
  }
  assert.deepEqual(validateFilledTableau([[1, 3], [2]]), []);
  assert.equal(filledTableauKey([[1], [], []]), filledTableauKey([[1]]));
  assert.notEqual(filledTableauKey([[1, 2]]), filledTableauKey([[1], [2]]));
});

test("paper tableaux round-trip on minimal boards and retain all siblings", async () => {
  for (const [rows, n] of [
    [[[1]], 2], [[[2]], 3], [[[2, 3], [3]], 5],
    [[[1, 3], [2]], 5], [[[1, 2], [3]], 5], [[[1, 2], [2]], 4],
  ]) {
    const result = await findMinimalTableauGames(rows);
    assert.equal(result.n, n);
    for (const { tree, leafIds } of result.matches) {
      for (const leafId of leafIds) assert.equal(filledTableauKey(values(tree, tree.nodesById.get(leafId))), filledTableauKey(rows));
      const siblings = generateGameTree(tree.n, tree.A, tree.B);
      assert.deepEqual(tree.leaves.map((leaf) => values(tree, leaf)), siblings.leaves.map((leaf) => values(siblings, leaf)));
    }
  }
});

test("empty tableau has the minimal positive board with no white checkers", async () => {
  const result = await findMinimalTableauGames([[], []]);
  assert.equal(result.n, 1);
  assert.deepEqual(result.matches.map(({ tree }) => tree.k), [0, 1]);
  for (const match of result.matches) assert.equal(match.tree.schedule.length, 0);
});

test("all minimal starts and matching leaves agree with every game through n=5", async () => {
  // Enumerate all B as well as all A and k, independently of the inverse's shape pruning.
  const minima = new Map();
  for (let n = 1; n <= 5; n++) {
    for (let k = 0; k <= n; k++) {
      const choices = [];
      for (let mask = 0; mask < 2 ** n; mask++) {
        const subset = Array.from({ length: n }, (_, i) => i + 1).filter((_, i) => mask & (1 << i));
        if (subset.length === k) choices.push(subset);
      }
      for (const A of choices) for (const B of choices) {
        if (!validateInitialWhite(n, k, initialWhiteConfiguration(A, B)).valid) continue;
        const tree = generateGameTree(n, A, B);
        for (const leaf of tree.leaves) {
          const rows = values(tree, leaf);
          const key = filledTableauKey(rows);
          if (!minima.has(key)) minima.set(key, { rows, n, starts: new Map() });
          const record = minima.get(key);
          if (record.n === n) {
            const start = JSON.stringify([k, A, B]);
            if (!record.starts.has(start)) record.starts.set(start, []);
            record.starts.get(start).push(leaf.id);
          }
        }
      }
    }
  }
  assert.ok(minima.size > 20);
  for (const { rows, n, starts } of minima.values()) {
    const result = await findMinimalTableauGames(rows, { maxBoardSize: 5 });
    assert.equal(result.n, n, filledTableauKey(rows));
    const actual = new Map(result.matches.map(({ tree, leafIds }) => [JSON.stringify([tree.k, tree.A, tree.B]), [...leafIds]]));
    assert.deepEqual(actual, starts, filledTableauKey(rows));
  }
});

test("limits and cancellation never silently skip candidates", async () => {
  await assert.rejects(findMinimalTableauGames([[2]], { maxBoardSize: 2 }), /No matching game/);
  await assert.rejects(findMinimalTableauGames([[2, 1]]), /weakly increase/);
  await assert.rejects(findMinimalTableauGames([[1]], { maxTotalNodes: 1 }), BranchLimitError);
  await assert.rejects(findMinimalTableauGames([[1]], { maxNodesPerTree: 1 }), BranchLimitError);
  await assert.rejects(findMinimalTableauGames([[1]], { maxBoardSize: NaN }), /positive integers/);
  // A match exists after the first tree, but a limit before the second must discard it.
  await assert.rejects(findMinimalTableauGames([], { maxTotalNodes: 1 }), /complete set/);
  const controller = new AbortController();
  await assert.rejects(findMinimalTableauGames([[2]], {
    signal: controller.signal,
    onProgress: () => controller.abort(),
  }), /cancelled/);
});

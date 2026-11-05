import test from "node:test";
import assert from "node:assert/strict";
import { generateEquivalenceTable } from "../dist/math/tableauEquivalence.js";
import { generateGameTree } from "../dist/math/generateGames.js";
import { initialWhiteConfiguration, validateInitialWhite, partitionFromSubset } from "../dist/math/validation.js";
import { filledTableauKey } from "../dist/math/inverseTableau.js";
import { tableauFromEvents, tableauValues } from "../dist/math/tableau.js";

function subsets(n, k) {
  const choices = [];
  for (let mask = 0; mask < 2 ** n; mask++) {
    const subset = Array.from({ length: n }, (_, i) => i + 1).filter((_, i) => mask & (1 << i));
    if (subset.length === k) choices.push(subset);
  }
  return choices;
}

test("equivalence fixes exactly k checkers and includes fillings with smaller entries", async () => {
  const result = await generateEquivalenceTable([1], 2);
  assert.equal(result.minBoardSize, 3);
  assert.equal(result.maxBoardSize, 3);
  assert.ok(result.rows.every((row) => row.tree.B.join(",") === "1,3"));
  assert.equal(result.coveredCount, 2);
  assert.deepEqual(new Set(result.rows.flatMap((row) => row.tableaux.map((entry) => entry.key))), new Set(["[[1]]", "[[2]]"]));
  assert.ok(result.rows.every((row) => row.tree.k === 2 && row.tree.root.state.white.length === 2));
});

test("tableaux are grouped only on their own minimal boards, excluding larger copies", async () => {
  const result = await generateEquivalenceTable([2, 1], 3);
  assert.equal(result.minBoardSize, 5);
  assert.equal(result.maxBoardSize, 6);
  assert.equal(result.rows.length, 7);
  assert.equal(result.tableauCount, 8);
  assert.equal(result.coveredCount, 8);
  assert.ok(!result.rows.some((row) => row.tree.n === 6 && row.tree.A.join(",") === "2,4,6"));
  const pair = result.rows.find((row) => row.tree.n === 5 && row.tree.A.join(",") === "2,4,5");
  assert.deepEqual(pair.tableaux.map((entry) => JSON.parse(entry.key)), [[[1, 2], [3]], [[1, 2], [2]]]);
  const larger = result.rows.find((row) => row.tree.n === 6 && row.tree.A.join(",") === "2,3,6");
  assert.deepEqual(larger.tableaux.map((entry) => JSON.parse(entry.key)), [[[1, 3], [3]]]);
  assert.ok(larger.tree.leaves.length > larger.tableaux.reduce((sum, entry) => sum + entry.leafIds.length, 0));
});

test("every row and every listed tableau are minimal in an independent A/B database", async () => {
  for (const [shape, k, maxN] of [[[1], 2, 4], [[2, 1], 3, 7], [[2], 2, 6], [[], 2, 3]]) {
    const minima = new Map();
    const candidates = [];
    for (let n = k; n <= maxN; n++) {
      for (const B of subsets(n, k)) {
        const beta = partitionFromSubset(n, k, B).filter((part) => part > 0);
        if (JSON.stringify(beta) !== JSON.stringify(shape)) continue;
        for (const A of subsets(n, k)) {
          if (!validateInitialWhite(n, k, initialWhiteConfiguration(A, B)).valid) continue;
          const tree = generateGameTree(n, A, B);
          const keys = tree.leaves.map((leaf) => filledTableauKey(tableauValues(tableauFromEvents(leaf.state.tableauEvents, k))));
          for (const key of keys) if (!minima.has(key)) minima.set(key, n);
          candidates.push({ tree, keys });
        }
      }
    }
    const expected = new Map();
    for (const { tree, keys } of candidates) {
      const minimalKeys = keys.filter((key) => minima.get(key) === tree.n).sort();
      if (minimalKeys.length) expected.set(JSON.stringify([tree.n, tree.A, tree.B]), minimalKeys);
    }
    const result = await generateEquivalenceTable(shape, k, { maxBoardSize: maxN });
    const actual = new Map(result.rows.map((row) => [JSON.stringify([row.tree.n, row.tree.A, row.tree.B]), row.tableaux.flatMap((entry) => entry.leafIds.map(() => entry.key)).sort()]));
    assert.deepEqual(actual, expected);
    assert.ok(result.rows.every((row) => row.tree.k === k));
    for (const row of result.rows) for (const entry of row.tableaux) {
      assert.equal(row.tree.n, minima.get(entry.key));
      for (const id of entry.leafIds) assert.equal(filledTableauKey(tableauValues(tableauFromEvents(row.tree.nodesById.get(id).state.tableauEvents, k))), entry.key);
    }
  }
});

test("empty shape retains exactly k checkers", async () => {
  const result = await generateEquivalenceTable([], 3);
  assert.equal(result.minBoardSize, 3);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].tree.k, 3);
  assert.equal(result.rows[0].tableaux[0].key, "[]");
});

test("invalid inputs, bounds and interruptions never return partial equivalence tables", async () => {
  await assert.rejects(generateEquivalenceTable([1], 0), /positive integer/);
  await assert.rejects(generateEquivalenceTable([1, 1], 1), /more rows/);
  await assert.rejects(generateEquivalenceTable([2], 2, { maxBoardSize: 3 }), /at least/);
  await assert.rejects(generateEquivalenceTable([2, 1], 3, { maxBoardSize: 5 }), /Minimum boards have not/);
  await assert.rejects(generateEquivalenceTable([2, 1], 3, { maxTableaux: 7 }), /No truncated/);
  await assert.rejects(generateEquivalenceTable([2, 1], 3, { maxTotalNodes: 11 }), /limit/i);
  const controller = new AbortController();
  await assert.rejects(generateEquivalenceTable([2, 1], 3, { signal: controller.signal, onProgress: () => controller.abort() }), /cancelled/);
});

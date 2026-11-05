import test from "node:test";
import assert from "node:assert/strict";
import { minimalTableauStart, directTableauGame, tableauGameFromMinimalStart } from "../dist/math/directTableauInverse.js";
import { generateGameTree, outputSubset, pathToNode } from "../dist/math/generateGames.js";
import { enumerateSubsets, filledTableauKey } from "../dist/math/inverseTableau.js";
import { initialWhiteConfiguration, validateInitialWhite, partitionFromSubset } from "../dist/math/validation.js";
import { tableauFromEvents, tableauValues } from "../dist/math/tableau.js";
import { generateTableauLadder } from "../dist/math/tableauLadder.js";

const values = (leaf, k) => tableauValues(tableauFromEvents(leaf.state.tableauEvents, k));
function compareGame(rows, k, tree, leaf) {
  const direct = directTableauGame(rows, k);
  const path = pathToNode(tree, leaf.id);
  assert.deepEqual(direct.states, path.map(node => node.state));
  assert.deepEqual(direct.actions, path.slice(1).map(node => node.moveInfo.action));
  assert.deepEqual(direct.output, outputSubset(leaf));
  return direct;
}

test("minimal-start formula and local branch rule agree with every happy input through n=8, k<=5", () => {
  const minima = new Map();
  const universes = new Map();
  let starts = 0, games = 0, decisions = 0;
  for (let n = 1; n <= 8; n++) for (let k = 1; k <= Math.min(5, n); k++) {
    for (const B of enumerateSubsets(n, k)) for (const A of enumerateSubsets(n, k)) {
      if (!validateInitialWhite(n, k, initialWhiteConfiguration(A, B)).valid) continue;
      const tree = generateGameTree(n, A, B, { maxNodes: 100000 });
      const shape = partitionFromSubset(n, k, B).filter(value => value > 0);
      const shapeKey = JSON.stringify([shape, k]);
      if (!universes.has(shapeKey)) universes.set(shapeKey, generateTableauLadder(shape, k, 100000).nodes.map(node => ({ node, formula: minimalTableauStart(node.rows, k) })));
      const alpha = partitionFromSubset(n, k, A);
      const admissible = universes.get(shapeKey).filter(({ formula }) =>
        alpha.slice(0, -1).every((value, j) => value - alpha[j + 1] >= formula.deficits[j]) &&
        alpha[0] + formula.content[0] <= n - k,
      ).map(({ node }) => node.id).sort();
      // Verify the converse as well: every admissible filling occurs exactly once.
      assert.deepEqual(tree.leaves.map(leaf => filledTableauKey(values(leaf, k))).sort(), admissible);
      starts++;
      for (const leaf of tree.leaves) {
        games++;
        const rows = values(leaf, k), formula = minimalTableauStart(rows, k);
        assert.ok(alpha.slice(0, -1).every((value, j) => value - alpha[j + 1] >= formula.deficits[j]));
        assert.deepEqual(partitionFromSubset(n, k, outputSubset(leaf)), alpha.map((value, j) => value + formula.content[j]));
        for (const node of pathToNode(tree, leaf.id).slice(1)) {
          const m = node.moveInfo;
          if (m.allowedActions.length !== 2) continue;
          const diagonal = m.topWhiteInCriticalDiagonal;
          const c = [...m.phase1Before].sort((a,b) => a.col-b.col).findIndex(checker => checker.col === diagonal.col) + 1;
          const q = [...m.phase1Before].sort((a,b) => a.row-b.row).findIndex(checker => checker.row === diagonal.row) + 1;
          const consumed = node.state.tableauEvents.filter(event => event.tableauRow === c).length;
          const next = rows[c-1]?.[rows[c-1].length - 1 - consumed];
          assert.equal(m.action, next !== undefined && next < q ? "swap" : "stay");
          decisions++;
        }
        const key = JSON.stringify([k, filledTableauKey(rows)]);
        if (!minima.has(key)) minima.set(key, { n, k, rows, matches: [] });
        const record = minima.get(key);
        if (record.n === n) record.matches.push({ tree, leaf });
      }
    }
  }
  for (const record of minima.values()) {
    const start = minimalTableauStart(record.rows, record.k);
    assert.equal(record.n, start.n);
    assert.equal(record.matches.length, 1, "unique minimal start and game for fixed k");
    const { tree, leaf } = record.matches[0];
    assert.deepEqual(tree.A, start.A);
    assert.deepEqual(tree.B, start.B);
    compareGame(record.rows, record.k, tree, leaf);
  }
  assert.deepEqual({ starts, games, tableaux: minima.size, decisions }, { starts: 6505, games: 11293, tableaux: 3048, decisions: 12188 });
});

test("direct inverse matches full sibling trees for larger multirow tableaux", () => {
  let checked = 0;
  for (const [shape, k] of [[[3,2,1],5], [[4,2,1],4], [[2,2,1,1],5]]) {
    for (const node of generateTableauLadder(shape, k, 5000).nodes) {
      const start = minimalTableauStart(node.rows, k);
      const tree = generateGameTree(start.n, start.A, start.B, { maxNodes: 1000000 });
      const matches = tree.leaves.filter(leaf => filledTableauKey(values(leaf, k)) === node.id);
      assert.equal(matches.length, 1);
      compareGame(node.rows, k, tree, matches[0]);
      checked++;
    }
  }
  console.log(`Larger-shape direct inverses checked: ${checked}`);
});

test("one-row drop formula, minimal-board counterexample, and input validation", () => {
  const rows = [[1,1,2,4,4]], k = 4;
  const start = minimalTableauStart(rows, k);
  assert.deepEqual(start.A, [3,5,6,9]);
  assert.equal(start.n, 9);
  assert.deepEqual(minimalTableauStart([[1,3],[3]], 3), {
    n: 6, k: 3, A: [2,3,6], B: [2,4,6], alpha: [2,2,0], gamma: [3,2,2], content: [1,0,2], deficits: [0,2],
  });
  assert.deepEqual(minimalTableauStart([[1,2],[3]], 3).A, [2,4,5]);
  assert.equal(minimalTableauStart([[1,2],[3]], 3).n, 5);
  const certified = tableauGameFromMinimalStart([[1,2],[3]], 3);
  assert.deepEqual(values(certified.leaf, 3).filter(row => row.length), [[1,2],[3]]);
  compareGame([[1,2],[3]], 3, certified.tree, certified.leaf);
  const empty = generateGameTree(3, [1,2,3], [1,2,3]);
  compareGame([], 3, empty, empty.leaves[0]);
  assert.throws(() => minimalTableauStart([[1,2],[2,2]], 2), /strictly/);
  assert.throws(() => directTableauGame([[3]], 2), /at least/);
});

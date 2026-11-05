import test from "node:test";
import assert from "node:assert/strict";
import { generateTableauLadder } from "../dist/math/tableauLadder.js";
import { enumerateSubsets, filledTableauKey } from "../dist/math/inverseTableau.js";
import { generateGameTree, pathToNode } from "../dist/math/generateGames.js";
import { initialWhiteConfiguration, validateInitialWhite, partitionFromSubset } from "../dist/math/validation.js";
import { buildSpecializationSchedule, initialBlackConfiguration } from "../dist/math/specializationOrder.js";
import { analyzeWhiteMove, applyPhaseOne, performCleanup } from "../dist/math/checkerRules.js";
import { createTableauEvent, tableauFromEvents, tableauValues } from "../dist/math/tableau.js";
import { minimalTableauStart } from "../dist/math/directTableauInverse.js";

const sum = xs => xs.reduce((a, b) => a + b, 0);
function signature(rows, k) {
  const counts = Array(k + 1).fill(0), d = Array(k).fill(0);
  for (const row of rows) for (const q of [...row].reverse()) {
    counts[q]++;
    for (let j = 1; j <= k; j++) d[j - 1] = Math.max(d[j - 1], counts[j] - counts[j - 1]);
  }
  return { d, D: d.map((_, i) => sum(d.slice(0, i + 1))) };
}
function clocks(rows, k, n) {
  const records = [], swaps = [];
  for (let r = 1; r <= k; r++) {
    const row = rows[r - 1] ?? [];
    row.forEach((q, c) => records.push({ stage: n + r - c - q, r, c: c + 1, q }));
    for (let p = r + 1; p <= k; p++) {
      const j = k + r - p;
      swaps.push({ stage: n - k + p - row.filter(q => q <= j).length, r, p, j });
    }
  }
  records.sort((a, b) => a.stage - b.stage || a.r - b.r);
  swaps.sort((a, b) => a.stage - b.stage || a.r - b.r);
  return { records, swaps };
}

// Construct a single path from the static sweep clocks, rather than search for
// a leaf or use the experimental next-entry branch rule.
function clockGame(rows, k, n, A) {
  const B = Array.from({ length: k }, (_, i) => n - k + i + 1 - (rows[i]?.length ?? 0));
  const { records, swaps } = clocks(rows, k, n);
  const plannedSwaps = new Set(swaps.map(({ stage, r }) => `${stage}/${r}`));
  let white = initialWhiteConfiguration(A, B);
  assert.ok(validateInitialWhite(n, k, white).valid);
  const events = [], actions = [], actualSwaps = [];
  const states = [{ n, k, step: 0, black: initialBlackConfiguration(n), white, tableauEvents: [] }];
  for (const move of buildSpecializationSchedule(n)) {
    const analysis = analyzeWhiteMove(white, move), stage = move.descending.col;
    const follower = analysis.topWhiteInCriticalDiagonal;
    const r = follower ? [...white].sort((a, b) => a.col - b.col).findIndex(w => w.col === follower.col) + 1 : 0;
    const wantsSwap = plannedSwaps.has(`${stage}/${r}`);
    const action = analysis.allowedActions.length === 2 ? wantsSwap ? "swap" : "stay" : analysis.allowedActions[0];
    if (action === "swap") {
      assert.ok(wantsSwap, "no unplanned forced swap");
      const leader = analysis.whiteInCriticalRow;
      const p = B.indexOf(leader.col) + 1;
      actualSwaps.push({ stage, r, p, j: k + r - p });
    }
    const cleanup = performCleanup(applyPhaseOne(white, analysis, action), move.after);
    if (analysis.dagger) {
      const to = cleanup.moves.find(slide => slide.from.row === follower.row && slide.from.col === follower.col).to;
      const e = createTableauEvent(move.step, white, follower, to);
      const c = (rows[e.tableauRow - 1]?.length ?? 0) - events.filter(old => old.tableauRow === e.tableauRow).length;
      assert.equal(stage, n + e.tableauRow + 1 - c - e.entry);
      events.push(e);
    }
    white = cleanup.white;
    actions.push(action);
    states.push({ n, k, step: move.step, black: move.after, white, tableauEvents: [...events] });
  }
  assert.deepEqual(actualSwaps, swaps);
  assert.deepEqual(tableauValues(tableauFromEvents(events, k)).filter(row => row.length), rows.filter(row => row.length));
  assert.deepEqual(events.map((e, i) => ({
    stage: n + e.tableauRow + 1 - ((rows[e.tableauRow - 1]?.length ?? 0) - events.slice(0, i).filter(x => x.tableauRow === e.tableauRow).length) - e.entry,
    r: e.tableauRow, q: e.entry,
  })), records.map(({ stage, r, q }) => ({ stage, r, q })));
  return { states, actions };
}

function* shapes(size, bound = size, prefix = []) {
  if (!size) { yield prefix; return; }
  for (let part = Math.min(size, bound); part >= 1; part--) yield* shapes(size - part, part, [...prefix, part]);
}

test("sweep word has exactly the note's prefix deficits; clocks partition all active slots", () => {
  let families = 0, tableaux = 0, events = 0, crossings = 0;
  for (let k = 1; k <= 5; k++) for (let size = 0; size <= 9; size++) for (const shape of shapes(size)) {
    if (shape.length > k) continue;
    families++;
    for (const { rows } of generateTableauLadder(shape, k, 200000).nodes) {
      tableaux++;
      const { d, D } = signature(rows, k), n = k + sum(d), { records, swaps } = clocks(rows, k, n);
      const prefix = Array(k + 1).fill(0), sweepD = Array(k).fill(0);
      for (const e of records) {
        prefix[e.q]++; events++;
        for (let j = 1; j <= k; j++) sweepD[j - 1] = Math.max(sweepD[j - 1], prefix[j] - prefix[j - 1]);
      }
      assert.deepEqual(sweepD, d);
      for (let r = 1; r <= k; r++) {
        const B = n - k + r - (rows[r - 1]?.length ?? 0);
        const stages = [...records.filter(x => x.r === r), ...swaps.filter(x => x.r === r)].map(x => x.stage).sort((a, b) => a - b);
        assert.deepEqual(stages, Array.from({ length: n - B }, (_, i) => B + 1 + i));
      }
      for (const x of swaps) {
        crossings++;
        const Bp = n - k + x.p - (rows[x.p - 1]?.length ?? 0);
        assert.ok(x.stage <= Bp);
        const before = records.filter(e => e.stage < x.stage || e.stage === x.stage && e.r < x.r);
        const Cj = before.filter(e => e.q === x.j).length;
        assert.equal(Cj, sum(rows.slice(0, x.r - 1).map(row => row.filter(q => q === x.j).length)));
        const L = (rows[x.r - 1] ?? []).filter(q => q <= x.j).length;
        assert.ok(D[x.j - 1] >= Cj + L);
      }
    }
  }
  console.log("Sweep-clock lemma checks: " + JSON.stringify({ families, tableaux, events, crossings }));
});

test("clock inverse and admissibility agree with every forward game through n=8, k<=5", () => {
  let starts = 0, games = 0, events = 0;
  for (let n = 1; n <= 8; n++) for (let k = 1; k <= Math.min(n, 5); k++) {
    for (const B of enumerateSubsets(n, k)) for (const A of enumerateSubsets(n, k)) {
      if (!validateInitialWhite(n, k, initialWhiteConfiguration(A, B)).valid) continue;
      starts++;
      const tree = generateGameTree(n, A, B, { maxNodes: 100000 });
      const shape = partitionFromSubset(n, k, B).filter(x => x > 0);
      const admissible = generateTableauLadder(shape, k, 100000).nodes.filter(({ rows }) => {
        const { d } = signature(rows, k);
        return d.every((x, i) => x <= A[i] - (A[i - 1] ?? 0) - 1);
      }).map(x => x.id).sort();
      assert.deepEqual(tree.leaves.map(leaf => filledTableauKey(tableauValues(tableauFromEvents(leaf.state.tableauEvents, k)))).sort(), admissible);
      for (const leaf of tree.leaves) {
        games++; events += leaf.state.tableauEvents.length;
        const rows = tableauValues(tableauFromEvents(leaf.state.tableauEvents, k)).filter(row => row.length);
        const actual = clockGame(rows, k, n, A), path = pathToNode(tree, leaf.id);
        assert.deepEqual(actual.states, path.map(node => node.state));
        assert.deepEqual(actual.actions, path.slice(1).map(node => node.moveInfo.action));
      }
    }
  }
  console.log("Clock inverse forward checks: " + JSON.stringify({ starts, games, events }));
});

test("larger minimal starts and the distinction between cumulative-order covers and south edges", () => {
  let checked = 0, padded = 0;
  for (const [shape, k] of [[[3, 2, 1], 5], [[4, 2, 1], 4], [[2, 2, 1, 1], 5]]) {
    for (const { rows } of generateTableauLadder(shape, k, 5000).nodes) {
      const s = minimalTableauStart(rows, k);
      clockGame(rows, k, s.n, s.A); checked++;
      // Independently test sufficiency when reserves exceed their minima.
      // Adding a gap before rank i shifts that entire suffix of occupied rows.
      for (let i = 0; i < k; i++) {
        clockGame(rows, k, s.n + 1, s.A.map((a, j) => a + (j >= i ? 1 : 0)));
        padded++;
      }
    }
  }
  const sigs = new Set(generateTableauLadder([2, 1], 3).nodes.map(({ rows }) => signature(rows, 3).D.join()));
  assert.ok(sigs.has("1,1,3") && sigs.has("2,2,3"));
  assert.ok(!sigs.has("1,2,3") && !sigs.has("2,1,3"));
  console.log("Larger sweep-clock games checked: " + JSON.stringify({ minimal: checked, padded }));
});

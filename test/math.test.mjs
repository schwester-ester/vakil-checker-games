import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSpecializationSchedule,
  initialBlackConfiguration,
  permutationFromBlack,
  specializationReflections,
} from "../dist/math/specializationOrder.js";
import {
  actionsForTableCase,
  analyzeWhiteMove,
  applyPhaseOne,
  findBlockers,
  isHappy,
  performCleanup,
} from "../dist/math/checkerRules.js";
import {
  generateGameTree,
  outputSubset,
} from "../dist/math/generateGames.js";
import {
  initialWhiteConfiguration,
  partitionFromSubset,
  validateInitialWhite,
} from "../dist/math/validation.js";
import { tableauFromEvents, tableauValues } from "../dist/math/tableau.js";

const outputKey = (node) => outputSubset(node).join(",");

test("Vakil specialization words for n=2,3,4", () => {
  assert.deepEqual(specializationReflections(2), [1]);
  assert.deepEqual(specializationReflections(3), [2, 1, 2]);
  assert.deepEqual(specializationReflections(4), [3, 2, 3, 1, 2, 3]);
});

test("n=4 specialization reproduces Figure 2 permutations", () => {
  const schedule = buildSpecializationSchedule(4);
  const permutations = [
    permutationFromBlack(initialBlackConfiguration(4)),
    ...schedule.map((move) => permutationFromBlack(move.after)),
  ];
  assert.deepEqual(permutations, [
    [1, 2, 3, 4],
    [1, 2, 4, 3],
    [1, 3, 4, 2],
    [1, 4, 3, 2],
    [2, 4, 3, 1],
    [3, 4, 2, 1],
    [4, 3, 2, 1],
  ]);
});

test("Table 2 is encoded case by case", () => {
  const D = {
    A: "rising-square",
    B: "elsewhere",
    C: "none",
  };
  const R = {
    alpha: "descending-square",
    beta: "elsewhere",
    gamma: "none",
  };
  assert.deepEqual(actionsForTableCase(R.alpha, D.A, false), ["swap"]);
  assert.deepEqual(actionsForTableCase(R.beta, D.A, false), ["swap"]);
  assert.deepEqual(actionsForTableCase(R.gamma, D.A, false), ["stay"]);
  assert.deepEqual(actionsForTableCase(R.alpha, D.B, false), ["swap"]);
  assert.deepEqual(actionsForTableCase(R.beta, D.B, false), ["stay", "swap"]);
  assert.deepEqual(actionsForTableCase(R.beta, D.B, true), ["stay"]);
  assert.deepEqual(actionsForTableCase(R.gamma, D.B, false), ["stay"]);
  assert.deepEqual(actionsForTableCase(R.alpha, D.C, false), ["stay"]);
  assert.deepEqual(actionsForTableCase(R.beta, D.C, false), ["stay"]);
  assert.deepEqual(actionsForTableCase(R.gamma, D.C, false), ["stay"]);
});

test("blockers are precisely the white checkers strictly inside the rectangle", () => {
  const critical = { row: 2, col: 6 };
  const diagonal = { row: 6, col: 2 };
  const white = [critical, diagonal, { row: 4, col: 4 }, { row: 3, col: 1 }];
  assert.deepEqual(findBlockers(critical, diagonal, white), [{ row: 4, col: 4 }]);
});

test("happiness is the two black-support inequalities", () => {
  const black = initialBlackConfiguration(4);
  assert.equal(isHappy({ row: 4, col: 2 }, black), true);
  assert.equal(isHappy({ row: 1, col: 1 }, black), false);
});

test("Phase 2 uniquely slides a descending-square white checker left", () => {
  const move = buildSpecializationSchedule(4)[0];
  assert.ok(move);
  const white = [{ row: 3, col: 2 }];
  const analysis = analyzeWhiteMove(white, move);
  assert.equal(analysis.tableCase, "C-alpha");
  const phaseOne = applyPhaseOne(white, analysis, "stay");
  const cleanup = performCleanup(phaseOne, move.after);
  assert.deepEqual(cleanup.white, [{ row: 3, col: 1 }]);
  assert.deepEqual(cleanup.moves, [
    { from: { row: 3, col: 2 }, to: { row: 3, col: 1 }, direction: "left" },
  ]);
});

test("dagger case uniquely raises the white checker", () => {
  const move = buildSpecializationSchedule(4)[0];
  assert.ok(move);
  const white = [{ row: 4, col: 1 }];
  const analysis = analyzeWhiteMove(white, move);
  assert.equal(analysis.tableCase, "A-gamma");
  assert.equal(analysis.dagger, true);
  const cleanup = performCleanup(applyPhaseOne(white, analysis, "stay"), move.after);
  assert.deepEqual(cleanup.white, [{ row: 3, col: 1 }]);
  assert.deepEqual(cleanup.moves[0], {
    from: { row: 4, col: 1 },
    to: { row: 3, col: 1 },
    direction: "up",
  });
});

test("initial input validation detects non-Vakil placements and zero intersections", () => {
  assert.equal(
    validateInitialWhite(4, 2, [
      { row: 2, col: 2 },
      { row: 4, col: 4 },
    ]).vakilForm,
    false,
  );
  const zero = validateInitialWhite(2, 1, [{ row: 1, col: 1 }]);
  assert.equal(zero.allHappy, false);
  assert.equal(zero.valid, false);
});

test("subset-to-partition convention matches the paper", () => {
  assert.deepEqual(partitionFromSubset(6, 3, [2, 4, 6]), [2, 1, 0]);
  assert.deepEqual(partitionFromSubset(6, 3, [1, 3, 5]), [3, 2, 1]);
});

test("Figure 6: exact leaves, outputs, and one-cell tableaux", () => {
  const tree = generateGameTree(4, [2, 4], [2, 4]);
  assert.equal(tree.leaves.length, 2);
  assert.deepEqual(tree.leaves.map(outputKey), ["2,3", "1,4"]);

  const tableaux = Object.fromEntries(
    tree.leaves.map((leaf) => [
      outputKey(leaf),
      tableauValues(tableauFromEvents(leaf.state.tableauEvents, 2)),
    ]),
  );
  assert.deepEqual(tableaux["2,3"], [[2], []]);
  assert.deepEqual(tableaux["1,4"], [[1], []]);
});

test("Figure 7: output is {2,3,4}+2{1,3,5}+{1,2,6}, preserving paths", () => {
  const tree = generateGameTree(6, [2, 4, 6], [2, 4, 6]);
  assert.equal(tree.leaves.length, 4);
  assert.deepEqual(tree.leaves.map(outputKey), ["2,3,4", "1,3,5", "1,3,5", "1,2,6"]);
  assert.equal(tree.leaves.filter((leaf) => outputKey(leaf) === "1,3,5").length, 2);

  const tableaux = tree.leaves.map((leaf) =>
    tableauValues(tableauFromEvents(leaf.state.tableauEvents, 3)),
  );
  assert.deepEqual(tableaux, [
    [[2, 3], [3], []],
    [[1, 3], [2], []],
    [[1, 2], [3], []],
    [[1, 2], [2], []],
  ]);
  assert.ok(tree.leaves.every((leaf) => leaf.state.tableauEvents.length === 3));
});

test("initial white construction is (a1,bk),...,(ak,b1)", () => {
  assert.deepEqual(initialWhiteConfiguration([2, 4, 6], [2, 4, 6]), [
    { row: 2, col: 6 },
    { row: 4, col: 4 },
    { row: 6, col: 2 },
  ]);
});

test("tableau events use the current row-rank and column-rank", async () => {
  const { createTableauEvent } = await import("../dist/math/tableau.js");
  const white = [
    { row: 5, col: 2 },
    { row: 2, col: 6 },
    { row: 4, col: 4 },
  ];
  const event = createTableauEvent(7, white, { row: 4, col: 4 }, { row: 3, col: 4 });
  assert.equal(event.entry, 2);
  assert.equal(event.tableauRow, 2);
  assert.equal(event.rowRank, 2);
  assert.equal(event.columnRank, 2);
});

test("all valid initial subset pairs through n=6 satisfy the engine invariants", () => {
  const subsets = (n, k) => {
    const result = [];
    const visit = (start, current) => {
      if (current.length === k) {
        result.push([...current]);
        return;
      }
      for (let value = start; value <= n - (k - current.length) + 1; value += 1) {
        current.push(value);
        visit(value + 1, current);
        current.pop();
      }
    };
    visit(1, []);
    return result;
  };

  let generated = 0;
  for (let n = 2; n <= 6; n += 1) {
    for (let k = 0; k <= n; k += 1) {
      const choices = subsets(n, k);
      for (const A of choices) {
        for (const B of choices) {
          const white = initialWhiteConfiguration(A, B);
          if (!validateInitialWhite(n, k, white).valid) continue;
          const tree = generateGameTree(n, A, B);
          assert.ok(tree.leaves.length >= 1);
          assert.ok(tree.leaves.every((leaf) => outputSubset(leaf).length === k));
          generated += 1;
        }
      }
    }
  }
  assert.equal(generated, 622);
});

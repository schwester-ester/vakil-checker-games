import test from "node:test";
import assert from "node:assert/strict";
import { generateTableauLadder, parseTableauShape } from "../dist/math/tableauLadder.js";
import { filledTableauKey, validateFilledTableau, findMinimalTableauGames } from "../dist/math/inverseTableau.js";

function enumerateIndependently(shape, maxEntry) {
  const rows = shape.map((length) => Array(length).fill(1));
  const cells = shape.flatMap((length, r) => Array.from({ length }, (_, c) => [r, c]));
  const result = [];
  function visit(index) {
    if (index === cells.length) {
      if (validateFilledTableau(rows).length === 0) result.push(rows.map((row) => [...row]));
      return;
    }
    const [r, c] = cells[index];
    for (let entry = 1; entry <= maxEntry; entry++) { rows[r][c] = entry; visit(index + 1); }
  }
  visit(0);
  return result;
}

test("ladder vertices and every one-cell increment agree with independent enumeration", () => {
  for (const [shape, maxEntry] of [[[2], 3], [[1, 1], 3], [[2, 1], 3], [[2, 2], 3], [[2, 1], 4], [[], 3]]) {
    const ladder = generateTableauLadder(shape, maxEntry);
    const expected = enumerateIndependently(shape, maxEntry);
    assert.deepEqual(new Set(ladder.nodes.map((node) => node.id)), new Set(expected.map(filledTableauKey)));
    const expectedEdges = new Set();
    for (const from of expected) for (const to of expected) {
      const differences = from.flatMap((row, r) => row.map((value, c) => to[r][c] - value)).filter((delta) => delta !== 0);
      if (differences.length === 1 && differences[0] === 1) expectedEdges.add(`${filledTableauKey(from)}>${filledTableauKey(to)}`);
    }
    assert.deepEqual(new Set(ladder.edges.map((edge) => `${edge.from}>${edge.to}`)), expectedEdges);
    for (const edge of ladder.edges) {
      const from = ladder.nodes.find((node) => node.id === edge.from);
      const to = ladder.nodes.find((node) => node.id === edge.to);
      assert.equal(to.level, from.level + 1);
      assert.equal(to.rows[edge.row][edge.col], from.rows[edge.row][edge.col] + 1);
    }
  }
});

test("ladder paths join without duplicating tableaux", () => {
  const ladder = generateTableauLadder([2, 1], 3);
  assert.equal(ladder.nodes.length, 8);
  const diamond = filledTableauKey([[1, 2], [3]]);
  assert.equal(ladder.edges.filter((edge) => edge.to === diamond).length, 2);
  assert.equal(ladder.nodes.filter((node) => node.id === diamond).length, 1);
  assert.deepEqual(ladder.nodes[0].rows, [[1, 1], [2]]);
});

test("shape parsing, impossible columns and complete-diagram limits", () => {
  assert.deepEqual(parseTableauShape("3, 2 1"), [3, 2, 1]);
  assert.deepEqual(parseTableauShape(""), []);
  for (const shape of ["1, 2", "0", "2,", "1.5", "x"]) assert.throws(() => parseTableauShape(shape));
  assert.equal(generateTableauLadder([1, 1, 1], 2).nodes.length, 0);
  assert.throws(() => generateTableauLadder([2, 1], 3, 7), /No truncated diagram/);
  assert.throws(() => generateTableauLadder([2], 0), /positive integers/);
  assert.throws(() => generateTableauLadder([1, 2], 3), /weakly decreasing/);
});

test("each generated tableau has its complete minimum-board correspondence", async () => {
  const ladder = generateTableauLadder([2, 1], 3);
  for (const node of ladder.nodes) {
    const result = await findMinimalTableauGames(node.rows);
    assert.ok(result.matches.length > 0);
    for (const match of result.matches) {
      for (const id of match.leafIds) {
        const leaf = match.tree.nodesById.get(id);
        assert.equal(leaf.state.tableauEvents.length, 3);
        assert.equal(match.tree.n, result.n);
      }
    }
  }
});

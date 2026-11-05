import test from 'node:test';
import assert from 'node:assert/strict';
import { pipeDreamFromTableau, pipeDreamFromEvents, reflectedPipeDreamCrossings } from '../dist/math/pipeDream.js';
import { generateTableauLadder } from '../dist/math/tableauLadder.js';
import { generateGameTree } from '../dist/math/generateGames.js';

// Independently read the usual antidiagonal RC-graph word after flipping the
// first k rows of the diagonal convention. Every letter must increase length.
function readPermutation(positions, n) {
  const word = [...positions].sort((a, b) => a.row - b.row || b.col - a.col);
  const permutation = Array.from({ length: n }, (_, i) => i + 1);
  for (const { row, col } of word) {
    const index = row + col - 2;
    if (index < 0 || index >= n - 1 || permutation[index] > permutation[index + 1]) return null;
    [permutation[index], permutation[index + 1]] = [permutation[index + 1], permutation[index]];
  }
  return permutation;
}
const key = positions => positions.map(({ row, col }) => `${row},${col}`).sort().join(';');

test('Grassmannian pipe dreams preserve entries, reduce to the correct permutation, and reflect both axes', () => {
  let checked = 0;
  for (const shape of [[], [1], [2], [1, 1], [2, 1], [2, 2], [3, 1], [3, 2, 1]]) {
    for (let k = Math.max(1, shape.length); k <= 5; k++) {
      for (const node of generateTableauLadder(shape, k, 10000).nodes) {
        const dream = pipeDreamFromTableau(node.rows, k);
        const reflected = reflectedPipeDreamCrossings(dream);
        const entries = node.rows.flat().sort((a, b) => a - b);
        assert.deepEqual(dream.crossings.map(crossing => crossing.entry).sort((a, b) => a - b), entries);
        assert.equal(new Set(dream.crossings.map(crossing => `${crossing.row},${crossing.col}`)).size, entries.length);
        assert.deepEqual(readPermutation(dream.crossings.map(crossing => ({ row: k + 1 - crossing.row, col: crossing.col })), dream.n), dream.permutation);
        const descents = dream.permutation.flatMap((value, i) => value > dream.permutation[i + 1] ? [i + 1] : []);
        assert.deepEqual(descents, entries.length === 0 ? [] : [k]);
        assert.equal(dream.permutation.reduce((total, value, i) => total + dream.permutation.slice(i + 1).filter(other => other < value).length, 0), entries.length);
        reflected.forEach((crossing, i) => {
          assert.equal(crossing.row + dream.crossings[i].row, dream.n + 1);
          assert.equal(crossing.col + dream.crossings[i].col, dream.n + 1);
          assert.equal(crossing.entry, dream.crossings[i].entry);
          assert.ok(crossing.row >= 1 && crossing.row <= dream.n && crossing.col >= 1 && crossing.col <= dream.n);
        });
        checked++;
      }
    }
  }
  assert.ok(checked > 300);
});

test('all eight tableaux of shape (2,1) give exactly all reduced pipe dreams of w=13524', () => {
  const images = generateTableauLadder([2, 1], 3).nodes.map(node => {
    const dream = pipeDreamFromTableau(node.rows, 3);
    assert.deepEqual(dream.permutation, [1, 3, 5, 2, 4]);
    return key(dream.crossings.map(crossing => ({ row: 4 - crossing.row, col: crossing.col })));
  });
  const cells = [];
  for (let row = 1; row < 5; row++) for (let col = 1; row + col <= 5; col++) cells.push({ row, col });
  const allDreams = [];
  for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) for (let c = b + 1; c < cells.length; c++) {
    const positions = [cells[a], cells[b], cells[c]];
    if (JSON.stringify(readPermutation(positions, 5)) === '[1,3,5,2,4]') allDreams.push(key(positions));
  }
  assert.equal(images.length, 8);
  assert.equal(new Set(images).size, 8);
  assert.deepEqual(images.sort(), allDreams.sort());
});

test('event labels stay attached to their tableau boxes; the ambient alphabet and board are retained', () => {
  const tree = generateGameTree(6, [2, 4, 6], [2, 4, 6]);
  for (const leaf of tree.leaves) {
    const dream = pipeDreamFromEvents(leaf.state.tableauEvents, tree.k, tree.n);
    assert.equal(dream.n, 6);
    assert.equal(dream.alphabetSize, 3);
    assert.deepEqual(dream.permutation, [1, 3, 5, 2, 4, 6]);
    assert.equal(dream.crossings.length, leaf.state.tableauEvents.length);
    for (const cross of reflectedPipeDreamCrossings(dream)) {
      assert.equal(cross.entry, cross.event.entry);
      assert.equal(cross.tableauRow, cross.event.tableauRow);
      assert.ok(leaf.state.tableauEvents.includes(cross.event));
    }
  }
  assert.deepEqual(pipeDreamFromTableau([], 0).permutation, [1]);
  assert.deepEqual(pipeDreamFromTableau([[], []], 2, 4).crossings, []);
  assert.deepEqual(pipeDreamFromTableau([[1]], 3).permutation, [1, 2, 4, 3]);
  assert.throws(() => pipeDreamFromTableau([[3]], 2), /alphabet/);
  assert.throws(() => pipeDreamFromTableau([[2], [1]], 2), /strictly/);
  assert.throws(() => pipeDreamFromTableau([[1, 1]], 2, 3), /board/);
});

test('each legal tableau increment moves exactly its numbered crossing one square northwest in the reflected view', () => {
  const ladder = generateTableauLadder([2, 1], 3);
  const images = new Map(ladder.nodes.map(node => [node.id, reflectedPipeDreamCrossings(pipeDreamFromTableau(node.rows, 3))]));
  for (const edge of ladder.edges) {
    const before = images.get(edge.from), after = images.get(edge.to);
    before.forEach((crossing, i) => {
      if (crossing.tableauRow === edge.row + 1 && crossing.tableauCol === edge.col + 1) {
        assert.equal(after[i].entry, crossing.entry + 1);
        assert.equal(after[i].row, crossing.row - 1);
        assert.equal(after[i].col, crossing.col - 1);
      } else assert.deepEqual(after[i], crossing);
    });
  }
});

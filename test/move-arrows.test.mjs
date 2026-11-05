import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGameTree } from '../dist/math/generateGames.js';
import { arrowsForMove, pathsForNode, boardMoveOptions } from '../dist/math/moveArrows.js';

const key = ({ row, col }) => `${row},${col}`;
const tree = generateGameTree(6, [2, 4, 6], [2, 4, 6]);

test('arrows preserve checker identity through swap and cleanup and reproduce every resulting board', () => {
  const kinds = new Set();
  let bentSwaps = 0;
  for (const node of tree.nodesById.values()) {
    if (!node.moveInfo) continue;
    const info = node.moveInfo;
    const arrows = arrowsForMove(info);
    const before = new Set(info.phase1Before.map(key));
    const starts = new Set(arrows.map(arrow => key(arrow.points[0])));
    const reconstructed = [...before].filter(position => !starts.has(position));
    for (const arrow of arrows) {
      kinds.add(arrow.kind);
      assert.ok(before.has(key(arrow.points[0])));
      reconstructed.push(key(arrow.points.at(-1)));
      if (arrow.kind === 'swap' && arrow.points.length > 2) {
        bentSwaps++;
        assert.equal(arrow.points[0].col, arrow.points[1].col);
        assert.equal(arrow.points[1].row, arrow.points[2].row);
      }
      if (arrow.kind === 'north') {
        assert.ok(info.tableauEvent);
        assert.deepEqual(arrow.points, [info.tableauEvent.checkerBefore, info.tableauEvent.checkerAfter]);
      }
      if (arrow.kind === 'west') {
        assert.equal(arrow.points[0].row, arrow.points.at(-1).row);
        assert.ok(arrow.points[0].col > arrow.points.at(-1).col);
      }
    }
    assert.equal(starts.size, arrows.length);
    assert.deepEqual(reconstructed.sort(), node.state.white.map(key).sort());
    assert.equal(arrows.filter(arrow => arrow.kind === 'swap').length, info.action === 'swap' ? 2 : 0);
  }
  assert.deepEqual([...kinds].sort(), ['north', 'swap', 'west']);
  assert.ok(bentSwaps > 0);
});

test('terminal boards have exactly k continuous checker routes ending at the final white positions', () => {
  for (const leaf of tree.leaves) {
    const paths = pathsForNode(tree, leaf);
    assert.equal(paths.length, tree.k);
    assert.deepEqual(paths.map(path => key(path.start)), tree.root.state.white.map(key));
    assert.deepEqual(paths.map(path => key(path.end)).sort(), leaf.state.white.map(key).sort());
    for (const path of paths) {
      let current = path.start;
      for (const move of path.moves) {
        assert.deepEqual(move.points[0], current);
        current = move.points.at(-1);
      }
      assert.deepEqual(current, path.end);
    }
    assert.equal(paths.flatMap(path => path.moves).filter(move => move.kind === 'north').length, leaf.state.tableauEvents.length);
    assert.deepEqual(boardMoveOptions(tree, leaf).movePaths, paths);
  }
  for (const node of tree.nodesById.values()) {
    if (node.children.length) {
      assert.deepEqual(boardMoveOptions(tree, node).moveArrows, node.moveInfo ? arrowsForMove(node.moveInfo) : []);
    }
  }
});

test('stationary checkers still have routes and zero-checker games have none', () => {
  const stationary = generateGameTree(1, [1], [1]);
  const paths = pathsForNode(stationary, stationary.leaves[0]);
  assert.equal(paths.length, 1);
  assert.ok(paths.some(path => path.moves.length === 0));
  const empty = generateGameTree(3, [], []);
  assert.deepEqual(pathsForNode(empty, empty.leaves[0]), []);
});

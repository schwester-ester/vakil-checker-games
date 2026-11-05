import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGameTree, pathToNode } from '../dist/math/generateGames.js';
import { boardHistoryOptions } from '../dist/math/boardHistory.js';
import { boardMoveOptions } from '../dist/math/moveArrows.js';

test('each board marks only its own recorded moves at the descending black checker squares', () => {
  const tree = generateGameTree(6, [2, 4, 6], [2, 4, 6]);
  let differentFromWhiteDestination = false;
  for (const node of tree.nodesById.values()) {
    const options = boardHistoryOptions(tree, node);
    const recordingMoves = pathToNode(tree, node.id).filter(state => state.moveInfo?.tableauEvent);
    assert.deepEqual(options.criticalSquares, recordingMoves.map(state => ({
      ...state.moveInfo.blackMove.descending,
      entry: state.moveInfo.tableauEvent.entry,
      step: state.state.step,
    })));
    assert.deepEqual(boardMoveOptions(tree, node).criticalSquares, options.criticalSquares);
    for (const state of recordingMoves) {
      if (state.moveInfo.blackMove.descending.col !== state.moveInfo.tableauEvent.checkerAfter.col) {
        differentFromWhiteDestination = true;
      }
    }
    if (node.state.step === tree.schedule.length) {
      assert.deepEqual(options.initialWhite, tree.root.state.white);
      assert.equal(options.criticalSquares.length, node.state.tableauEvents.length);
    } else {
      assert.equal(options.initialWhite, undefined);
    }
  }
  assert.ok(differentFromWhiteDestination, 'the critical square must not be replaced with the recording white checker destination');
});

test('final-board history handles stationary and zero-checker games', () => {
  for (const tree of [generateGameTree(1, [1], [1]), generateGameTree(3, [], [])]) {
    const options = boardHistoryOptions(tree, tree.leaves[0]);
    assert.deepEqual(options.initialWhite, tree.root.state.white);
    assert.deepEqual(options.criticalSquares, []);
  }
});

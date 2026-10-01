import { clonePositions, positionKey, samePosition } from "./positions.js";
import { buildSpecializationSchedule, initialBlackConfiguration } from "./specializationOrder.js";
import { analyzeWhiteMove, applyPhaseOne, explainMove, performCleanup, } from "./checkerRules.js";
import { initialWhiteConfiguration, normalizeSubset, partitionFromSubset, validateInitialWhite, validateSubset, } from "./validation.js";
import { createTableauEvent, isSemistandardTableau, tableauFromEvents, } from "./tableau.js";
export class BranchLimitError extends Error {
    limit;
    constructor(limit) {
        super(`Generation stopped after ${limit} nodes. Choose a smaller input or raise the node limit.`);
        this.name = "BranchLimitError";
        this.limit = limit;
    }
}
function publicNode(node) {
    return node;
}
function sameConfiguration(a, b) {
    return a.map(positionKey).join("|") === b.map(positionKey).join("|");
}
export function generateGameTree(n, AInput, BInput, options = {}) {
    const A = normalizeSubset(AInput);
    const B = normalizeSubset(BInput);
    const k = A.length;
    const subsetErrors = [
        ...validateSubset(A, n, k).map((error) => `A: ${error}`),
        ...validateSubset(B, n, k).map((error) => `B: ${error}`),
    ];
    if (A.length !== B.length) {
        subsetErrors.push("A and B must have the same cardinality.");
    }
    if (subsetErrors.length > 0) {
        throw new Error(subsetErrors.join(" "));
    }
    const white = initialWhiteConfiguration(A, B);
    const validation = validateInitialWhite(n, k, white);
    if (!validation.valid) {
        throw new Error(validation.errors.join(" "));
    }
    const schedule = buildSpecializationSchedule(n);
    const root = {
        id: "root",
        state: {
            n,
            k,
            step: 0,
            black: initialBlackConfiguration(n),
            white: clonePositions(white),
            tableauEvents: [],
        },
        children: [],
    };
    const nodesById = new Map();
    nodesById.set(root.id, publicNode(root));
    let frontier = [root];
    let nodeCount = 1;
    const maxNodes = options.maxNodes ?? 10_000;
    for (const blackMove of schedule) {
        const nextFrontier = [];
        for (const parent of frontier) {
            if (!sameConfiguration(parent.state.black, blackMove.before)) {
                throw new Error(`Black schedule and state disagree at step ${blackMove.step}.`);
            }
            const analysis = analyzeWhiteMove(parent.state.white, blackMove);
            analysis.allowedActions.forEach((action, actionIndex) => {
                nodeCount += 1;
                if (nodeCount > maxNodes) {
                    throw new BranchLimitError(maxNodes);
                }
                const phaseOneBefore = clonePositions(parent.state.white);
                const phaseOneAfter = applyPhaseOne(parent.state.white, analysis, action);
                const cleanup = performCleanup(phaseOneAfter, blackMove.after);
                let tableauEvent;
                if (analysis.dagger) {
                    const risingWhite = analysis.topWhiteInCriticalDiagonal;
                    if (risingWhite === undefined) {
                        throw new Error("The dagger case must have a rising white checker.");
                    }
                    const cleanupMove = cleanup.moves.find((move) => samePosition(move.from, risingWhite));
                    if (cleanupMove === undefined) {
                        throw new Error("The dagger checker did not perform its required Phase 2 rise.");
                    }
                    tableauEvent = createTableauEvent(blackMove.step, parent.state.white, risingWhite, cleanupMove.to);
                }
                const tableauEvents = tableauEvent === undefined
                    ? [...parent.state.tableauEvents]
                    : [...parent.state.tableauEvents, tableauEvent];
                const childId = `${parent.id}/${blackMove.step}-${action}-${actionIndex}`;
                const moveInfo = {
                    ...analysis,
                    action,
                    phase1Before: phaseOneBefore,
                    phase1After: phaseOneAfter,
                    cleanupMoves: cleanup.moves,
                    explanation: explainMove(analysis, action, cleanup.moves),
                    blackMove,
                    ...(tableauEvent === undefined ? {} : { tableauEvent }),
                };
                const child = {
                    id: childId,
                    parentId: parent.id,
                    branchLabel: action,
                    state: {
                        n,
                        k,
                        step: blackMove.step,
                        black: clonePositions(blackMove.after),
                        white: clonePositions(cleanup.white),
                        tableauEvents,
                    },
                    moveInfo,
                    children: [],
                };
                parent.children.push(child);
                nodesById.set(child.id, publicNode(child));
                nextFrontier.push(child);
            });
        }
        frontier = nextFrontier;
    }
    const beta = partitionFromSubset(n, k, B);
    for (const leaf of frontier) {
        const output = outputSubset(leaf);
        if (output.length !== k) {
            throw new Error("A terminal configuration failed to produce a k-subset.");
        }
        const tableau = tableauFromEvents(leaf.state.tableauEvents, k);
        const rowLengths = tableau.map((row) => row.length);
        if (rowLengths.some((length, index) => length !== beta[index])) {
            throw new Error(`Tableau shape invariant failed: got [${rowLengths}], expected beta=[${beta}].`);
        }
        if (!isSemistandardTableau(tableau)) {
            throw new Error("The Section 2.6 event data did not form a semistandard tableau.");
        }
    }
    return {
        n,
        k,
        A,
        B,
        root: publicNode(root),
        nodesById,
        leaves: frontier.map(publicNode),
        schedule,
        nodeCount,
    };
}
export function outputSubset(node) {
    if (node.state.step !== (node.state.n * (node.state.n - 1)) / 2) {
        throw new Error("Output subsets are defined only at terminal nodes.");
    }
    const output = node.state.white
        .map((checker) => {
        const black = node.state.black.find((candidate) => samePosition(candidate, checker));
        if (black === undefined || checker.row !== checker.col) {
            throw new Error("At the terminal position every white checker must lie on a black checker.");
        }
        return checker.row;
    })
        .sort((a, b) => a - b);
    return output;
}
export function groupLeavesByOutput(leaves) {
    const groups = new Map();
    for (const leaf of leaves) {
        const subset = outputSubset(leaf);
        const key = subset.join(",");
        const group = groups.get(key);
        if (group === undefined) {
            groups.set(key, { subset, leaves: [leaf] });
        }
        else {
            group.leaves.push(leaf);
        }
    }
    return [...groups.values()];
}
export function formalOutput(leaves) {
    return groupLeavesByOutput(leaves)
        .map(({ subset, leaves: group }) => {
        const coefficient = group.length === 1 ? "" : `${group.length}`;
        return `${coefficient}{${subset.join(", ")}}`;
    })
        .join(" + ");
}
export function pathToNode(tree, nodeId) {
    const result = [];
    let current = tree.nodesById.get(nodeId);
    while (current !== undefined) {
        result.push(current);
        current = current.parentId === undefined ? undefined : tree.nodesById.get(current.parentId);
    }
    return result.reverse();
}
export function firstLeafBelow(node) {
    let current = node;
    while (current.children.length > 0) {
        current = current.children[0];
    }
    return current;
}
//# sourceMappingURL=generateGames.js.map
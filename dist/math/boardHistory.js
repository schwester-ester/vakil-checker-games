import { pipeDreamFromEvents } from "./pipeDream.js";
/** Recording history belongs to this path; initial outlines belong only to outputs. */
export function boardHistoryOptions(tree, node) {
    return {
        ...(node.state.step === tree.schedule.length ? {
            initialWhite: tree.root.state.white,
            pipeDream: pipeDreamFromEvents(node.state.tableauEvents, tree.k, tree.n),
        } : {}),
        criticalSquares: node.state.tableauEvents.map((event) => ({
            ...tree.schedule[event.step - 1].descending,
            entry: event.entry,
            step: event.step,
        })),
    };
}
//# sourceMappingURL=boardHistory.js.map
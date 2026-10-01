export const positionKey = (position) => `${position.row},${position.col}`;
export const samePosition = (a, b) => a !== undefined && b !== undefined && a.row === b.row && a.col === b.col;
export const compareByRowThenColumn = (a, b) => a.row - b.row || a.col - b.col;
export const compareByColumnThenRow = (a, b) => a.col - b.col || a.row - b.row;
export const clonePositions = (positions) => positions.map(({ row, col }) => ({ row, col })).sort(compareByRowThenColumn);
export const hasDistinctRowsAndColumns = (positions) => {
    const rows = new Set(positions.map(({ row }) => row));
    const columns = new Set(positions.map(({ col }) => col));
    return rows.size === positions.length && columns.size === positions.length;
};
export const formatPosition = ({ row, col }) => `(${row}, ${col})`;
//# sourceMappingURL=positions.js.map
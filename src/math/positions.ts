import type { Position } from "./types.js";

export const positionKey = (position: Position): string => `${position.row},${position.col}`;

export const samePosition = (a: Position | undefined, b: Position | undefined): boolean =>
  a !== undefined && b !== undefined && a.row === b.row && a.col === b.col;

export const compareByRowThenColumn = (a: Position, b: Position): number =>
  a.row - b.row || a.col - b.col;

export const compareByColumnThenRow = (a: Position, b: Position): number =>
  a.col - b.col || a.row - b.row;

export const clonePositions = (positions: readonly Position[]): Position[] =>
  positions.map(({ row, col }) => ({ row, col })).sort(compareByRowThenColumn);

export const hasDistinctRowsAndColumns = (positions: readonly Position[]): boolean => {
  const rows = new Set(positions.map(({ row }) => row));
  const columns = new Set(positions.map(({ col }) => col));
  return rows.size === positions.length && columns.size === positions.length;
};

export const formatPosition = ({ row, col }: Position): string => `(${row}, ${col})`;

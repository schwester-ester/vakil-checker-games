import type { Position, TableauCell, TableauEvent, TableauRows } from "./types.js";
import { compareByColumnThenRow, compareByRowThenColumn, samePosition } from "./positions.js";

export function createTableauEvent(
  step: number,
  whiteBefore: readonly Position[],
  risingWhite: Position,
  checkerAfter: Position,
): TableauEvent {
  const byRow = [...whiteBefore].sort(compareByRowThenColumn);
  const byColumn = [...whiteBefore].sort(compareByColumnThenRow);
  const rowIndex = byRow.findIndex((checker) => samePosition(checker, risingWhite));
  const columnIndex = byColumn.findIndex((checker) => samePosition(checker, risingWhite));
  if (rowIndex < 0 || columnIndex < 0) {
    throw new Error("The rising white checker is missing from the current configuration.");
  }
  const rowRank = rowIndex + 1;
  const columnRank = columnIndex + 1;
  return {
    id: `tableau-${step}-${rowRank}-${columnRank}`,
    step,
    entry: rowRank,
    tableauRow: columnRank,
    rowRank,
    columnRank,
    checkerBefore: { ...risingWhite },
    checkerAfter: { ...checkerAfter },
  };
}

/**
 * Events occur from right to left within a row of Fulton's tableau. Therefore each new
 * entry is prepended. This produces the tableau of fixed shape beta used in Section 2.6.
 */
export function tableauFromEvents(
  events: readonly TableauEvent[],
  rowCount: number,
): TableauRows {
  const rows: TableauCell[][] = Array.from({ length: rowCount }, () => []);
  for (const event of events) {
    const row = rows[event.tableauRow - 1];
    if (row === undefined) {
      throw new Error(`Tableau row ${event.tableauRow} is outside 1, …, ${rowCount}.`);
    }
    row.unshift({ value: event.entry, event });
  }
  return rows;
}

export function tableauValues(rows: TableauRows): number[][] {
  return rows.map((row) => row.map(({ value }) => value));
}

export function isSemistandardTableau(rows: TableauRows): boolean {
  for (const row of rows) {
    for (let index = 1; index < row.length; index += 1) {
      if (row[index - 1]!.value > row[index]!.value) {
        return false;
      }
    }
  }
  const maxWidth = Math.max(0, ...rows.map((row) => row.length));
  for (let col = 0; col < maxWidth; col += 1) {
    for (let row = 1; row < rows.length; row += 1) {
      const above = rows[row - 1]?.[col];
      const below = rows[row]?.[col];
      if (above !== undefined && below !== undefined && above.value >= below.value) {
        return false;
      }
    }
  }
  return true;
}

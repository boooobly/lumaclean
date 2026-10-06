import { Children, cloneElement, isValidElement, Fragment, type ReactElement, type ReactNode } from "react";

// Preserve a single mounted set of controls. Mobile changes the table's presentation,
// not its data or forms, and every cell retains its original column label.
export function ledgerRows(children: ReactNode, headers: string[], secondary: string[] = []): ReactNode {
  return Children.map(children, row => {
    if (!isValidElement<{ children?: ReactNode }>(row)) return row;
    if (row.type === Fragment) return cloneElement(row, {}, ledgerRows(row.props.children, headers, secondary));
    if (row.type !== "tr") return row;
    return cloneElement(row, {}, Children.map(row.props.children, (cell, index) =>
      isValidElement<{ children?: ReactNode }>(cell) ? cloneElement(cell as ReactElement<{ "data-label"?: string; children?: ReactNode }>, { "data-label": headers[index] }, secondary.includes(headers[index]) ? <details><summary>Подробнее · {headers[index]}</summary>{cell.props.children}</details> : cell.props.children) : cell));
  });
}

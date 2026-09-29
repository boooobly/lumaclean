import type {ArticleTable} from "@/lib/articles/types";

export function ArticleDataTable({table}: {table: ArticleTable}) {
  return <table className="journal-data-table">
    <caption>{table.caption}</caption>
    <thead><tr>{table.headings.map(heading => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
    <tbody>{table.rows.map(row => <tr key={row[0]}>{row.map((cell, index) => index === 0
      ? <th key={index} scope="row">{cell}</th>
      : <td key={index}>{cell}</td>)}</tr>)}</tbody>
  </table>;
}

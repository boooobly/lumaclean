import type { ReactNode } from "react";

export function DisclosureSection({ title, children, open = false, id, className = "" }: { title: string; children: ReactNode; open?: boolean; id?: string; className?: string }) {
  return <details id={id} className={`admin-disclosure ${className}`} open={open}>
    <summary>{title}<span aria-hidden="true">＋</span></summary>
    <div className="admin-disclosure-body">{children}</div>
  </details>;
}

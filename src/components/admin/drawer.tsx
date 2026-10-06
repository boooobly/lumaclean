"use client";

import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Drawer({ title, label, children, className = "", icon, id }: { title: string; label?: string; children: ReactNode; className?: string; icon?: ReactNode; id?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return <>
    <button type="button" className={`admin-icon-button ${className}`} aria-label={label ?? title} aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>{icon ?? title}</button>
    <dialog id={id} ref={ref} className="admin-drawer" aria-labelledby={titleId} onClick={event => { if (event.target === event.currentTarget) ref.current?.close(); }}>
      <header><h2 id={titleId}>{title}</h2><button type="button" className="admin-icon-button" aria-label="Закрыть" onClick={() => ref.current?.close()}><X size={20} /></button></header>
      <div className="admin-drawer-body" onClick={event => { if ((event.target as HTMLElement).closest("a")) ref.current?.close(); }}>{children}</div>
    </dialog>
  </>;
}

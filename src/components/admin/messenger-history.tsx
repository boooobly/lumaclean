"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import Link from "next/link";

export function MessengerHistory({ children, latest, latestHref, older = false }: { children: ReactNode; latest?: string; latestHref: string; older?: boolean }) {
  const ref = useRef<HTMLDivElement>(null), pinned = useRef(!older);
  const [away, setAway] = useState(older);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (pinned.current) element.scrollTop = element.scrollHeight;
    const resize = new ResizeObserver(() => { if (pinned.current) element.scrollTop = element.scrollHeight; });
    if (element.firstElementChild) resize.observe(element.firstElementChild);
    return () => resize.disconnect();
  }, [latest]);
  return <div className="messenger-history-shell"><div ref={ref} className="messenger-history" role="region" aria-label="Переписка" tabIndex={0} onScroll={() => {
    const element = ref.current;
    if (!element) return;
    pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    setAway(!pinned.current);
  }}><div className="messenger-history-content">{children}</div></div>
    {away && (older ? <Link className="messenger-latest admin-icon-button" aria-label="К последним сообщениям" href={latestHref}><ArrowDown size={18} />Последние</Link> : <button type="button" className="messenger-latest admin-icon-button" aria-label="К последним сообщениям" onClick={() => { pinned.current = true; if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; setAway(false); }}><ArrowDown size={18} />Последние</button>)}
  </div>;
}

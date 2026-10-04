type ArrowDirection = "up-right" | "down-right" | "down";

export function ArrowIcon({direction = "up-right", className = ""}: {direction?: ArrowDirection; className?: string}) {
  const path = direction === "up-right"
    ? "M4 12 12 4M5 4h7v7"
    : direction === "down-right"
      ? "M4 4l8 8M12 5v7H5"
      : "M8 3v10M4 9l4 4 4-4";

  return <svg className={`site-arrow site-arrow-${direction} ${className}`.trim()} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

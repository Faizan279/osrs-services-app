import type { CSSProperties } from "react";

/** Display an artwork-only region of a client-supplied reference, without raster edits. */
export function ReferenceArt({
  board,
  crop,
  className = "",
  label,
}: {
  board: string;
  crop: [number, number, number, number];
  className?: string;
  label?: string;
}) {
  const [x, y, width, height] = crop;
  const style: CSSProperties = {
    backgroundImage: `url(/artwork/client-${board}-reference.jpeg)`,
    backgroundSize: `${(1536 / width) * 100}% ${(1024 / height) * 100}%`,
    backgroundPosition: `${(x / (1536 - width)) * 100}% ${(y / (1024 - height)) * 100}%`,
  };
  return (
    <span
      className={`reference-art ${className}`}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

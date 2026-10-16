// Book cover, falling back to the site's numbered tile when there's no
// image or it fails to load (e.g. offline).
import { useState } from "react";
import { cn } from "@/lib/utils";

const TILE = ["bg-foreground text-background", "bg-primary text-primary-foreground", "bg-background text-foreground"];

export function Cover({
  src,
  title,
  index = 0,
  className,
}: {
  src: string | null;
  title: string;
  index?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = "cover aspect-[2/3] w-full border-2 border-foreground";
  if (!src || failed) {
    return (
      <div aria-hidden="true" className={cn(box, "cover-num grid place-items-center font-display text-[1.6rem]", TILE[index % 3], className)}>
        {String(index + 1).padStart(2, "0")}
      </div>
    );
  }
  return (
    <img
      className={cn(box, "block bg-muted object-contain", className)}
      src={src}
      alt={`Cover of ${title}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

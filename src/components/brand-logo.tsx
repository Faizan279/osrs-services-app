import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/branding/osrs-services-logo.svg"
      alt="OSRS Services"
      width={320}
      height={90}
      className={cn("h-auto w-44", className)}
      priority={priority}
    />
  );
}

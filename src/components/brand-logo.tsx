import Image from "next/image";

import { cn } from "@/lib/utils";

const officialLogo = "/branding/osrs-services-logo.png";

export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  const logoSource =
    process.env.NEXT_PUBLIC_OSRS_SERVICES_LOGO_SRC ?? officialLogo;

  return (
    <span
      className={cn(
        "relative block aspect-[3.45/1] w-44 overflow-hidden",
        className,
      )}
      data-brand-asset={logoSource === officialLogo ? "official" : "configured"}
    >
      <Image
        src={logoSource}
        alt="OSRS Services"
        fill
        sizes="(max-width: 640px) 176px, 208px"
        className="scale-[1.04] object-cover object-center"
        priority={priority}
      />
    </span>
  );
}

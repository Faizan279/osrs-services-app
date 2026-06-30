import Image from "next/image";

import { cn } from "@/lib/utils";

const placeholderLogo = "/branding/osrs-services-logo-placeholder.svg";

export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  const logoSource =
    process.env.NEXT_PUBLIC_OSRS_SERVICES_LOGO_SRC ?? placeholderLogo;

  return (
    <Image
      src={logoSource}
      alt="OSRS Services"
      width={360}
      height={112}
      className={cn("h-auto w-44", className)}
      priority={priority}
      data-brand-asset={
        logoSource === placeholderLogo ? "temporary-placeholder" : "official"
      }
    />
  );
}

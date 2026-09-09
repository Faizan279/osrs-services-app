import type { LucideIcon } from "lucide-react";
import {
  Check,
  Clock3,
  Headphones,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import Image from "next/image";

export function DirectServiceHero({
  eyebrow,
  title,
  accent,
  description,
  icon: Icon,
  inferno = false,
  artwork,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  description: string;
  icon: LucideIcon;
  inferno?: boolean;
  artwork?: string;
}) {
  return (
    <section
      className={`service-hero ${inferno ? "service-hero-inferno" : ""}`}
    >
      {inferno || artwork ? (
        <Image
          src={artwork ?? "/artwork/zuk-inferno-hero.png"}
          alt=""
          fill
          priority
          sizes="100vw"
          className="z-0 object-cover object-[66%_44%]"
        />
      ) : null}
      <div className="service-hero-shade" />
      <div className="relative z-10 mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:py-8">
        <p className="text-primary text-xs font-black tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <div className="mt-3 flex items-center gap-4">
          <span className="service-hero-icon">
            <Icon className="size-7" aria-hidden="true" />
          </span>
          <h1 className="display-type max-w-4xl text-3xl sm:text-5xl">
            {title}{" "}
            {accent ? <span className="text-primary">{accent}</span> : null}
          </h1>
        </div>
        <p className="text-text-secondary mt-3 max-w-3xl text-base leading-7 sm:text-lg">
          {description}
        </p>
        <ul className="mt-5 grid max-w-4xl grid-cols-2 gap-3 text-xs font-bold lg:grid-cols-4">
          {[
            [UserRoundCheck, "100% hand played"],
            [ShieldCheck, "Account safety first"],
            [Clock3, "Clear delivery estimate"],
            [Headphones, "Support when you need it"],
          ].map(([TrustIcon, label]) => {
            const ItemIcon = TrustIcon as LucideIcon;
            return (
              <li key={String(label)} className="service-trust-item">
                <ItemIcon className="text-primary size-4" aria-hidden="true" />
                <span>{String(label)}</span>
                <Check
                  className="text-success ml-auto size-3"
                  aria-hidden="true"
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

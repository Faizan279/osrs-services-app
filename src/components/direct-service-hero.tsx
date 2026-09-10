import type { LucideIcon } from "lucide-react";
import { ReferenceArt } from "@/components/reference-art";
import { StoreTrustStrip } from "@/components/store-trust-strip";

export function DirectServiceHero({
  title,
  accent,
  description,
  inferno = false,
  eyebrow,
  artwork,
  icon,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  description: string;
  icon: LucideIcon;
  inferno?: boolean;
  artwork?: string;
}) {
  void icon;
  void artwork;
  const topic = (title + " " + accent + " " + eyebrow).toLowerCase();
  const plain = topic.includes("skill") || topic.includes("boss");
  const board = topic.includes("quest")
    ? "quest"
    : topic.includes("diar")
      ? "diary"
      : topic.includes("gold")
        ? "gold"
        : topic.includes("item")
          ? "items"
          : topic.includes("gather")
            ? "gathering"
            : null;
  return (
    <section
      className={
        "reference-service-hero " +
        (plain ? "is-plain" : "") +
        (inferno ? " is-infernal" : "")
      }
    >
      {board && (
        <ReferenceArt
          board={board}
          crop={[920, 65, 610, 120]}
          className="reference-service-banner-art"
        />
      )}
      <div className="reference-service-hero-content">
        <h1>
          {title} <span>{accent}</span>
        </h1>
        <p>{description}</p>
        {!plain && <StoreTrustStrip compact />}
      </div>
    </section>
  );
}

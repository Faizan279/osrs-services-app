import { Headphones, ShieldCheck, UsersRound, Zap } from "lucide-react";

export function StoreTrustStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`store-trust-strip ${compact ? "is-compact" : ""}`}>
      {[
        [UsersRound, "100% Hand Trained", "No bots. Ever."],
        [ShieldCheck, "Account Safety", "Your security is our priority"],
        [Zap, "Fast & Reliable", "Clear delivery estimates"],
        [Headphones, "Support", "Here when you need us"],
      ].map(([Icon, title, description]) => {
        const TrustIcon = Icon as typeof ShieldCheck;
        return (
          <div className="store-trust-fact" key={String(title)}>
            <span>
              <TrustIcon aria-hidden="true" />
            </span>
            <div>
              <strong>{String(title)}</strong>
              <small>{String(description)}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

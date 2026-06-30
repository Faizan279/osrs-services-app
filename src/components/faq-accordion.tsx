"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { FaqItem } from "@/content/homepage";
import { cn } from "@/lib/utils";

export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="border-border divide-border divide-y overflow-hidden rounded-2xl border">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const triggerId = `faq-trigger-${index}`;
        const panelId = `faq-panel-${index}`;

        return (
          <div key={item.question} className="bg-surface-1/70">
            <h3>
              <button
                id={triggerId}
                type="button"
                className="text-text-primary hover:bg-surface-2 focus-visible:ring-primary flex min-h-16 w-full items-center justify-between gap-5 px-5 py-4 text-left text-sm font-bold transition focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:px-6 sm:text-base"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                {item.question}
                <span className="border-border bg-background/60 flex size-8 shrink-0 items-center justify-center rounded-full border">
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "text-primary size-4 transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                  />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              aria-hidden={!isOpen}
              inert={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows] duration-200",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <p className="text-text-secondary max-w-3xl px-5 pb-5 text-sm leading-7 sm:px-6 sm:pb-6">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

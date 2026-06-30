"use client";

import { Check, Layers3, Sparkles, Swords } from "lucide-react";
import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";

function SectionHeading({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <CardHeader className="border-b border-white/5 pb-5">
      <div className="flex items-start gap-4">
        <span className="border-gold/20 bg-gold-muted/40 text-gold flex size-9 shrink-0 items-center justify-center rounded-lg border text-xs font-bold">
          {icon ?? number}
        </span>
        <div>
          <p className="text-text-primary text-lg font-semibold">{title}</p>
          <p className="text-text-muted mt-1 text-sm leading-6">
            {description}
          </p>
        </div>
      </div>
    </CardHeader>
  );
}

const colors = [
  { name: "Obsidian", value: "#030705", className: "bg-background" },
  { name: "Forest", value: "#142119", className: "bg-surface-3" },
  { name: "Action lime", value: "#A6D719", className: "bg-primary" },
  { name: "Muted gold", value: "#C7A45A", className: "bg-gold" },
];

export function DesignSystemShowcase() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <Layers3 className="text-gold size-4" aria-hidden="true" />
              <p className="text-gold kicker-type">Core palette</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {colors.map((color) => (
                <div
                  key={color.name}
                  className="border-border bg-background/30 rounded-xl border p-2.5"
                >
                  <div
                    className={`${color.className} h-14 rounded-lg border border-white/8 shadow-inner`}
                  />
                  <p className="mt-3 text-xs font-semibold">{color.name}</p>
                  <p className="text-text-muted mt-1 font-mono text-[0.65rem]">
                    {color.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-white/5 p-6 sm:p-7 lg:border-l">
            <p className="text-gold kicker-type">Type hierarchy</p>
            <p className="display-type mt-5 text-3xl leading-tight text-white">
              Refined where it matters.
            </p>
            <p className="text-text-secondary mt-3 max-w-lg text-sm leading-6">
              Characterful display type introduces major moments. A clean sans
              serif carries controls, labels, and operational detail.
            </p>
            <div className="border-border mt-5 flex items-center justify-between border-t pt-4 text-xs">
              <span className="font-semibold tracking-[0.12em] uppercase">
                Interface label
              </span>
              <span className="text-text-muted">14 / 20 · Semibold</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionHeading
            number="01"
            title="Actions"
            description="Lime is reserved for the decision that moves work forward."
          />
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <Button>Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
          </CardContent>
        </Card>

        <Card>
          <SectionHeading
            number="02"
            title="Status language"
            description="Compact signals stay distinct without flooding the interface."
          />
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap gap-2">
              <Badge>Draft</Badge>
              <Badge variant="success">Ready</Badge>
              <Badge variant="warning">Review</Badge>
              <Badge variant="danger">Blocked</Badge>
              <Badge variant="info">Info</Badge>
            </div>
            <Alert variant="success">
              <span className="flex items-center gap-2">
                <Check className="text-success size-4" aria-hidden="true" />
                Foundation checks are ready to run.
              </span>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <SectionHeading
            number="03"
            title="Form controls"
            description="Focus, validation, and disabled states remain unmistakable."
          />
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <label htmlFor="showcase-email" className="text-sm font-semibold">
                Email
              </label>
              <Input
                id="showcase-email"
                type="email"
                placeholder="name@example.com"
              />
            </div>
            <Input aria-invalid="true" defaultValue="Needs attention" />
            <Input disabled value="Unavailable" readOnly />
          </CardContent>
        </Card>

        <Card>
          <SectionHeading
            number="04"
            title="Feedback and overlays"
            description="Loading, toast, and confirmation patterns share one tone."
            icon={<Swords className="size-4" aria-hidden="true" />}
          />
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => toast.success("Design token saved")}
              >
                Show toast
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Sparkles className="size-4" aria-hidden="true" />
                    Open dialog
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Reusable confirmation</DialogTitle>
                  <DialogDescription>
                    This accessible dialog establishes the pattern for sensitive
                    actions in later tasks.
                  </DialogDescription>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => toast.success("Confirmed")}>
                      Confirm
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

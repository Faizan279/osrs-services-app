"use client";

import { Check, Sparkles } from "lucide-react";

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

export function DesignSystemShowcase() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Actions</h2>
          <p className="text-text-secondary text-sm">
            Clear hierarchy for high-confidence operations.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button>Primary action</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Form controls</h2>
            <p className="text-text-secondary text-sm">
              Focus, validation, and disabled states are built in.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
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
          <CardHeader>
            <h2 className="text-xl font-bold">Status language</h2>
            <p className="text-text-secondary text-sm">
              Compact badges and contextual alerts.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>Draft</Badge>
              <Badge variant="success">Ready</Badge>
              <Badge variant="warning">Review</Badge>
              <Badge variant="danger">Blocked</Badge>
              <Badge variant="info">Info</Badge>
            </div>
            <Alert variant="success">
              <span className="flex items-center gap-2">
                <Check className="text-success size-4" />
                Foundation checks are ready to run.
              </span>
            </Alert>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Feedback and overlays</h2>
          <p className="text-text-secondary text-sm">
            Loading, toast, and confirmation patterns.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => toast.success("Design token saved")}
              >
                Show toast
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Sparkles className="size-4" />
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export function FormStateIndicator() {
  const marker = useRef<HTMLSpanElement>(null);
  const [dirty, setDirty] = useState(false);
  const { pending } = useFormStatus();

  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    const markDirty = () => setDirty(true);
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
    };
  }, []);

  return (
    <span
      ref={marker}
      role="status"
      className={`text-xs font-semibold ${pending ? "text-info" : dirty ? "text-warning" : "text-text-muted"}`}
    >
      {pending
        ? "Saving changes…"
        : dirty
          ? "Unsaved changes"
          : "All changes saved"}
    </span>
  );
}

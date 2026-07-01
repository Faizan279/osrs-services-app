"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

export function ConfirmSubmitButton({
  confirmation,
  ...props
}: ComponentProps<typeof Button> & { confirmation: string }) {
  return (
    <Button
      {...props}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmation)) event.preventDefault();
      }}
    />
  );
}

import { ZodError } from "zod";

import {
  CatalogueConflictError,
  CataloguePublicationError,
  CatalogueTransitionError,
} from "@/lib/catalogue/errors";

const genericFailure =
  "The catalogue action could not be completed. Please try again.";

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
}

export function catalogueActionErrorMessage(
  error: unknown,
  context: string,
  reportUnexpected: (context: string, error: unknown) => void = (
    operation,
    cause,
  ) => console.error(`[catalogue:${operation}]`, cause),
) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the submitted values.";
  }
  if (
    error instanceof CatalogueConflictError ||
    error instanceof CataloguePublicationError ||
    error instanceof CatalogueTransitionError
  ) {
    return error.message;
  }

  switch (errorCode(error)) {
    case "P2002":
      return "That slug or canonical URL is already in use.";
    case "P2003":
      return "This record is still referenced and cannot be removed.";
    case "P2025":
      return "This catalogue record no longer exists.";
    default:
      reportUnexpected(context, error);
      return genericFailure;
  }
}

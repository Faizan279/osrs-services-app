export class CatalogueConflictError extends Error {}

export const pendingChangesConflictMessage =
  "Pending changes were updated by another user. Reload before continuing.";

export class CataloguePublicationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(" "));
  }
}

export class CatalogueTransitionError extends Error {}

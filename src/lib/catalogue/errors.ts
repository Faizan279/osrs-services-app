export class CatalogueConflictError extends Error {}

export class CataloguePublicationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(" "));
  }
}

export class CatalogueTransitionError extends Error {}

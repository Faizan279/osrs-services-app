export type CatalogueMediaOwner = {
  categoryId?: string;
  serviceId?: string;
};

export function mediaOwnerWhere(owner: CatalogueMediaOwner) {
  if (owner.categoryId && !owner.serviceId) {
    return { categoryId: owner.categoryId } as const;
  }
  if (owner.serviceId && !owner.categoryId) {
    return { serviceId: owner.serviceId } as const;
  }
  throw new Error("A media reference must belong to exactly one parent.");
}

export function primaryMediaResetWhere(owner: CatalogueMediaOwner) {
  return { ...mediaOwnerWhere(owner), isPrimary: true } as const;
}

export async function createOwnedMediaReference<
  TInput extends CatalogueMediaOwner & { isPrimary: boolean },
  TResult,
>(
  input: TInput,
  operations: {
    clearPrimary(
      where: ReturnType<typeof primaryMediaResetWhere>,
    ): Promise<void>;
    create(data: TInput): Promise<TResult>;
  },
) {
  mediaOwnerWhere(input);
  if (input.isPrimary) {
    await operations.clearPrimary(primaryMediaResetWhere(input));
  }
  return operations.create(input);
}

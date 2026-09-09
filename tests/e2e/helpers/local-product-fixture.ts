import { randomUUID } from "node:crypto";
import { localCommerceConnection } from "./local-gold-fixture";

export async function withLocalProductStock(
  work: (slug: string) => Promise<void>,
) {
  const connection = await localCommerceConnection();
  const revisionId = `e2e${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  const [product] = await connection.query(
    "SELECT id, slug, availabilityState FROM Product WHERE publicTitle = ? LIMIT 1",
    ["Brimstone Ring"],
  );
  if (!product) {
    await connection.end();
    throw new Error("Expected local seeded Brimstone Ring.");
  }
  const [revision] = await connection.query(
    "SELECT revisionNumber, snapshot FROM ProductRevision WHERE productId = ? ORDER BY revisionNumber DESC LIMIT 1",
    [product.id],
  );
  const variants = await connection.query(
    "SELECT id, availabilityState, status, stockMode, onHandQuantity FROM ProductVariant WHERE productId = ?",
    [product.id],
  );
  const snapshot =
    typeof revision.snapshot === "string"
      ? JSON.parse(revision.snapshot)
      : revision.snapshot;
  snapshot.revision = {
    id: revisionId,
    revisionNumber: revision.revisionNumber + 1,
    publishedAt: new Date().toISOString(),
  };
  for (const variant of snapshot.variants) {
    Object.assign(variant, {
      priceMode: "FIXED_UNIT",
      baseUnitPriceCents: 1234,
      minimumQuantity: "1",
      maximumQuantity: "10",
      quantityIncrement: "1",
      stockMode: "TRACKED",
      enabled: true,
      priceTiers: [],
    });
  }
  try {
    await connection.query(
      "INSERT INTO ProductRevision (id, productId, revisionNumber, snapshot) VALUES (?, ?, ?, ?)",
      [
        revisionId,
        product.id,
        snapshot.revision.revisionNumber,
        JSON.stringify(snapshot),
      ],
    );
    await connection.query(
      "UPDATE Product SET availabilityState = ? WHERE id = ?",
      ["AVAILABLE", product.id],
    );
    await connection.query(
      "UPDATE ProductVariant SET availabilityState = ?, status = ?, stockMode = ?, onHandQuantity = ? WHERE productId = ?",
      ["AVAILABLE", "AVAILABLE", "TRACKED", "10", product.id],
    );
    await work(product.slug);
  } finally {
    await connection.query(
      "UPDATE Product SET availabilityState = ? WHERE id = ?",
      [product.availabilityState, product.id],
    );
    for (const variant of variants)
      await connection.query(
        "UPDATE ProductVariant SET availabilityState = ?, status = ?, stockMode = ?, onHandQuantity = ? WHERE id = ?",
        [
          variant.availabilityState,
          variant.status,
          variant.stockMode,
          variant.onHandQuantity.toString(),
          variant.id,
        ],
      );
    // Only the newly created test revision is removed; original revisions stay immutable.
    await connection.query(
      "DELETE FROM ProductRevision WHERE id = ? AND productId = ?",
      [revisionId, product.id],
    );
    await connection.end();
  }
}

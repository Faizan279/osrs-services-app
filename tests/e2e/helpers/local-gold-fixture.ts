import mariadb from "mariadb";

// Explicit opt-in and loopback/database-name guards prevent this helper from
// changing a deployed store. All modified availability fields are restored.
export async function localCommerceConnection() {
  const url = new URL(process.env.DIRECT_ORDER_FIXTURE_DATABASE_URL ?? "");
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "3310" ||
    !/^\/osrs_final_redesign\d*$/.test(url.pathname)
  ) {
    throw new Error(
      "Commerce fixtures require the isolated loopback redesign database.",
    );
  }
  return mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  });
}

export async function withLocalGoldStock(work: () => Promise<void>) {
  const connection = await localCommerceConnection();
  const [market] = await connection.query(
    "SELECT id, availabilityState, stockQuantityGp FROM GoldMarket WHERE stableKey = ?",
    ["gold-main-market"],
  );
  if (!market) {
    await connection.end();
    throw new Error("Expected seeded local gold market.");
  }
  try {
    await connection.query(
      "UPDATE GoldMarket SET availabilityState = ?, stockQuantityGp = ? WHERE id = ?",
      ["AVAILABLE", "1000000000", market.id],
    );
    await work();
  } finally {
    await connection.query(
      "UPDATE GoldMarket SET availabilityState = ?, stockQuantityGp = ? WHERE id = ?",
      [market.availabilityState, market.stockQuantityGp.toString(), market.id],
    );
    await connection.end();
  }
}

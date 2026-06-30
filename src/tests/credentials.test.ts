import { describe, expect, it, vi } from "vitest";

import { authenticateCredentialsWith } from "@/lib/auth/credentials-core";

describe("credentials authentication", () => {
  it("returns one generic failure for a wrong password", async () => {
    const findUser = vi.fn().mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      name: "Admin",
      passwordHash: "stored-hash",
      status: "ACTIVE",
    });
    const verify = vi.fn().mockResolvedValue(false);

    await expect(
      authenticateCredentialsWith(
        { email: "ADMIN@example.com", password: "wrong-password" },
        findUser,
        verify,
      ),
    ).resolves.toEqual({ ok: false });
    expect(findUser).toHaveBeenCalledWith("admin@example.com");
  });

  it("rejects disabled users before password verification", async () => {
    const verify = vi.fn();
    const result = await authenticateCredentialsWith(
      { email: "disabled@example.com", password: "not-relevant" },
      async () => ({
        id: "user-2",
        email: "disabled@example.com",
        name: null,
        passwordHash: "stored-hash",
        status: "DISABLED",
      }),
      verify,
    );
    expect(result).toEqual({ ok: false });
    expect(verify).not.toHaveBeenCalled();
  });
});

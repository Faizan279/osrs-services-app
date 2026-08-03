import "server-only";

import { authenticateCredentialsWith } from "@/lib/auth/credentials-core";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";

export function authenticateCredentials(input: unknown) {
  return authenticateCredentialsWith(
    input,
    (email) =>
      prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          status: true,
          accountType: true,
        },
      }),
    verifyPassword,
    "STAFF",
  );
}

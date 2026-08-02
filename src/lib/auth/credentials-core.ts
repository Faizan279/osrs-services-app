import { z } from "zod";

export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256),
});

export type CredentialUser = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  status: "ACTIVE" | "DISABLED";
  accountType?: "STAFF" | "CUSTOMER";
};

type FindUser = (email: string) => Promise<CredentialUser | null>;
type VerifyPassword = (
  passwordHash: string,
  candidate: string,
) => Promise<boolean>;

export async function authenticateCredentialsWith(
  input: unknown,
  findUser: FindUser,
  verify: VerifyPassword,
  expectedAccountType: "STAFF" | "CUSTOMER" = "STAFF",
) {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const };
  }

  const user = await findUser(parsed.data.email);
  if (
    !user ||
    user.status !== "ACTIVE" ||
    (user.accountType ?? "STAFF") !== expectedAccountType
  ) {
    return { ok: false as const };
  }

  const matches = await verify(user.passwordHash, parsed.data.password);
  if (!matches) {
    return { ok: false as const };
  }

  return {
    ok: true as const,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

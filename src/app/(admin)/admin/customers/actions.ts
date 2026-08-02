"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/guards";
import {
  customerAdminActionErrorMessage,
  customerSettingsInputSchema,
  revokeAdminCustomerSession,
  setCustomerAccountStatus,
  updateAdminCustomerSettings,
} from "@/lib/customer/admin";

const expectedVersionSchema = z.coerce.number().int().min(1);

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function destination(
  pathname: string,
  state: "saved" | "error",
  message: string,
) {
  const params = new URLSearchParams({ state, message });
  return `${pathname}?${params.toString()}`;
}

function expectedVersion(formData: FormData) {
  return expectedVersionSchema.parse(formData.get("expectedVersion"));
}

export async function updateCustomerSettingsAction(formData: FormData) {
  const session = await requireCapability(
    "customers.configure",
    "/admin/customers",
  );
  try {
    await updateAdminCustomerSettings({
      input: customerSettingsInputSchema.parse({
        id: formData.get("id"),
        registrationEnabled: checked(formData, "registrationEnabled"),
        dashboardEnabled: checked(formData, "dashboardEnabled"),
        emailVerificationRequired: checked(
          formData,
          "emailVerificationRequired",
        ),
        passwordRecoveryEnabled: checked(formData, "passwordRecoveryEnabled"),
        customerSessionDurationHours: formData.get(
          "customerSessionDurationHours",
        ),
        maximumActiveCustomerSessions: formData.get(
          "maximumActiveCustomerSessions",
        ),
        publicRegistrationInstructions: formData.get(
          "publicRegistrationInstructions",
        ),
        publicRecoveryInstructions: formData.get("publicRecoveryInstructions"),
        needsClientReview: checked(formData, "needsClientReview"),
      }),
      expectedVersion: expectedVersion(formData),
      actorId: session.user.id,
    });
  } catch (error) {
    redirect(
      destination(
        "/admin/customers",
        "error",
        customerAdminActionErrorMessage(error),
      ),
    );
  }
  revalidatePath("/admin/customers");
  redirect(
    destination("/admin/customers", "saved", "Customer settings saved."),
  );
}

export async function setCustomerStatusAction(formData: FormData) {
  const session = await requireCapability(
    "customers.manage",
    "/admin/customers",
  );
  const customerId = String(formData.get("customerId") ?? "");
  try {
    const status = z.enum(["ACTIVE", "DISABLED"]).parse(formData.get("status"));
    await setCustomerAccountStatus({
      customerId,
      status,
      expectedVersion: expectedVersion(formData),
      actorId: session.user.id,
      reason: String(formData.get("reason") ?? "ADMIN_REVIEW"),
    });
  } catch (error) {
    redirect(
      destination(
        `/admin/customers/${customerId}`,
        "error",
        customerAdminActionErrorMessage(error),
      ),
    );
  }
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  redirect(
    destination(
      `/admin/customers/${customerId}`,
      "saved",
      "Customer status updated.",
    ),
  );
}

export async function revokeCustomerSessionAction(formData: FormData) {
  const session = await requireCapability(
    "customers.security.manage",
    "/admin/customers",
  );
  const customerId = String(formData.get("customerId") ?? "");
  try {
    await revokeAdminCustomerSession({
      customerId,
      sessionId: String(formData.get("sessionId") ?? ""),
      actorId: session.user.id,
    });
  } catch (error) {
    redirect(
      destination(
        `/admin/customers/${customerId}`,
        "error",
        customerAdminActionErrorMessage(error),
      ),
    );
  }
  revalidatePath(`/admin/customers/${customerId}`);
  redirect(
    destination(`/admin/customers/${customerId}`, "saved", "Session revoked."),
  );
}

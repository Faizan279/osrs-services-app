"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/guards";
import {
  checkoutActionErrorMessage,
  checkoutPaymentMethodInputSchema,
  checkoutSettingsInputSchema,
  updateCheckoutPaymentMethod,
  updateCheckoutSettings,
} from "@/lib/checkout/admin";

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

export async function updateCheckoutSettingsAction(formData: FormData) {
  const session = await requireCapability(
    "checkout.configure",
    "/admin/checkout",
  );
  try {
    await updateCheckoutSettings({
      input: checkoutSettingsInputSchema.parse({
        id: formData.get("id"),
        maximumCartItems: formData.get("maximumCartItems"),
        cartExpiryMinutes: formData.get("cartExpiryMinutes"),
        checkoutReservationMinutes: formData.get("checkoutReservationMinutes"),
        orderNumberPrefix: formData.get("orderNumberPrefix"),
        termsVersion: formData.get("termsVersion"),
        privacyPolicyVersion: formData.get("privacyPolicyVersion"),
        publicCheckoutInstructions: formData.get("publicCheckoutInstructions"),
        publicPaymentReviewInstructions: formData.get(
          "publicPaymentReviewInstructions",
        ),
        guestCheckoutEnabled: checked(formData, "guestCheckoutEnabled"),
        needsClientReview: checked(formData, "needsClientReview"),
      }),
      expectedVersion: expectedVersion(formData),
      actorId: session.user.id,
    });
  } catch (error) {
    redirect(
      destination(
        "/admin/checkout",
        "error",
        checkoutActionErrorMessage(error),
      ),
    );
  }
  revalidatePath("/admin/checkout");
  redirect(destination("/admin/checkout", "saved", "Checkout settings saved."));
}

export async function updateCheckoutPaymentMethodAction(formData: FormData) {
  const session = await requireCapability(
    "checkout.configure",
    "/admin/checkout/payment-methods",
  );
  try {
    await updateCheckoutPaymentMethod({
      input: checkoutPaymentMethodInputSchema.parse({
        id: formData.get("id"),
        publicName: formData.get("publicName"),
        publicDescription: formData.get("publicDescription"),
        publicInstructions: formData.get("publicInstructions"),
        enabled: checked(formData, "enabled"),
        sortOrder: formData.get("sortOrder"),
        needsClientReview: checked(formData, "needsClientReview"),
      }),
      expectedVersion: expectedVersion(formData),
      actorId: session.user.id,
    });
  } catch (error) {
    redirect(
      destination(
        "/admin/checkout/payment-methods",
        "error",
        checkoutActionErrorMessage(error),
      ),
    );
  }
  revalidatePath("/admin/checkout/payment-methods");
  redirect(
    destination(
      "/admin/checkout/payment-methods",
      "saved",
      "Payment method saved.",
    ),
  );
}

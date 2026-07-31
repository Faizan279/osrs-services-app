"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/guards";
import {
  cancelOrder,
  markOrderPaid,
  markOrderPaymentUnderReview,
  sanitizeCheckoutError,
  updateOrderFulfillmentStatus,
} from "@/lib/checkout/orders";
import { normalizePlainText } from "@/lib/checkout/security";

const orderIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9]+$/i, "Invalid order identifier.");

const expectedVersionSchema = z.coerce.number().int().min(1);

const orderStatusSchema = z.enum([
  "AWAITING_ASSIGNMENT",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER",
  "COMPLETED",
  "REQUIRES_REVIEW",
  "DISPUTED",
]);

function destination(
  pathname: string,
  state: "saved" | "error",
  message: string,
) {
  const params = new URLSearchParams({ state, message });
  return `${pathname}?${params.toString()}`;
}

function orderPath(orderId: string) {
  return `/admin/orders/${orderId}`;
}

function parsedOrderId(formData: FormData) {
  return orderIdSchema.parse(formData.get("orderId"));
}

function expectedVersion(formData: FormData) {
  return expectedVersionSchema.parse(formData.get("expectedVersion"));
}

function optionalNote(formData: FormData, key: string, max: number) {
  const value = formData.get(key);
  if (value == null || String(value).trim() === "") return null;
  return normalizePlainText(value, max);
}

export async function updateOrderStatusAction(formData: FormData) {
  const orderId = parsedOrderId(formData);
  const path = orderPath(orderId);
  const session = await requireCapability("orders.status.manage", path);
  try {
    await updateOrderFulfillmentStatus({
      orderId,
      actorId: session.user.id,
      expectedVersion: expectedVersion(formData),
      nextStatus: orderStatusSchema.parse(formData.get("nextStatus")),
      publicNote: optionalNote(formData, "publicNote", 500),
      internalNote: optionalNote(formData, "internalNote", 2000),
    });
  } catch (error) {
    const safe = sanitizeCheckoutError(error);
    redirect(destination(path, "error", safe.message));
  }
  revalidatePath(path);
  redirect(destination(path, "saved", "Order status updated."));
}

export async function markPaymentReviewAction(formData: FormData) {
  const orderId = parsedOrderId(formData);
  const path = orderPath(orderId);
  const session = await requireCapability("orders.payment.review", path);
  try {
    await markOrderPaymentUnderReview({
      orderId,
      actorId: session.user.id,
      expectedVersion: expectedVersion(formData),
      publicNote: optionalNote(formData, "publicNote", 500),
      internalNote: optionalNote(formData, "internalNote", 2000),
    });
  } catch (error) {
    const safe = sanitizeCheckoutError(error);
    redirect(destination(path, "error", safe.message));
  }
  revalidatePath(path);
  redirect(destination(path, "saved", "Payment review started."));
}

export async function markOrderPaidAction(formData: FormData) {
  const orderId = parsedOrderId(formData);
  const path = orderPath(orderId);
  const session = await requireCapability("orders.payment.review", path);
  try {
    await markOrderPaid({
      orderId,
      actorId: session.user.id,
      expectedVersion: expectedVersion(formData),
      idempotencyKey: `admin-paid-${randomUUID()}`,
      publicNote: optionalNote(formData, "publicNote", 500),
      internalNote: optionalNote(formData, "internalNote", 2000),
    });
  } catch (error) {
    const safe = sanitizeCheckoutError(error);
    redirect(destination(path, "error", safe.message));
  }
  revalidatePath(path);
  redirect(destination(path, "saved", "Payment marked paid."));
}

export async function cancelOrderAction(formData: FormData) {
  const orderId = parsedOrderId(formData);
  const path = orderPath(orderId);
  const session = await requireCapability("orders.cancel", path);
  try {
    await cancelOrder({
      orderId,
      actorId: session.user.id,
      expectedVersion: expectedVersion(formData),
      idempotencyKey: `admin-cancel-${randomUUID()}`,
      publicNote: optionalNote(formData, "publicNote", 500),
      internalNote: optionalNote(formData, "internalNote", 2000),
    });
  } catch (error) {
    const safe = sanitizeCheckoutError(error);
    redirect(destination(path, "error", safe.message));
  }
  revalidatePath(path);
  redirect(destination(path, "saved", "Order cancelled."));
}

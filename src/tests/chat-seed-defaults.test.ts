import { describe, expect, it } from "vitest";

import { defaultFeatureFlags, defaultRoles } from "../../prisma/seed-core";
import { allPermissionKeys, permissions } from "@/lib/auth/permissions";

const flagDefaults = new Map(
  defaultFeatureFlags.map(([key, , enabled]) => [key, enabled]),
);

const rolePermissions = new Map(
  defaultRoles.map((role) => [role.key, new Set(role.permissions)]),
);

describe("chat seed defaults", () => {
  it("keeps every Task 015 chat feature flag disabled by default", () => {
    expect(flagDefaults.get("live_chat_enabled")).toBe(false);
    expect(flagDefaults.get("guest_live_chat_enabled")).toBe(false);
    expect(flagDefaults.get("customer_live_chat_enabled")).toBe(false);
    expect(flagDefaults.get("chat_realtime_enabled")).toBe(false);
  });

  it("splits support queue access from restricted chat administration", () => {
    const superAdmin = rolePermissions.get("SUPER_ADMIN")!;
    const supportAgent = rolePermissions.get("SUPPORT_AGENT")!;

    expect(allPermissionKeys).toEqual(
      expect.arrayContaining([
        permissions.chatView,
        permissions.chatRespond,
        permissions.chatAssign,
        permissions.chatStatusManage,
        permissions.chatInternalNotesCreate,
        permissions.chatOrderLink,
        permissions.chatSettingsManage,
        permissions.chatQuickRepliesManage,
        permissions.chatMessagesRedact,
        permissions.chatArchive,
        permissions.chatMonitorAll,
      ]),
    );
    expect(superAdmin.has(permissions.chatSettingsManage)).toBe(true);
    expect(superAdmin.has(permissions.chatMessagesRedact)).toBe(true);
    expect(supportAgent.has(permissions.chatView)).toBe(true);
    expect(supportAgent.has(permissions.chatRespond)).toBe(true);
    expect(supportAgent.has(permissions.chatAssign)).toBe(true);
    expect(supportAgent.has(permissions.chatOrderLink)).toBe(true);
    expect(supportAgent.has(permissions.chatSettingsManage)).toBe(false);
    expect(supportAgent.has(permissions.chatMessagesRedact)).toBe(false);
    expect(supportAgent.has(permissions.chatArchive)).toBe(false);
    expect(supportAgent.has(permissions.chatMonitorAll)).toBe(false);
  });
});

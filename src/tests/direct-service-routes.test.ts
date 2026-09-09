import { describe, expect, it } from "vitest";

import {
  directCategoryDestination,
  directServiceDestination,
} from "@/config/direct-service-routes";
import { primaryNavigation } from "@/config/public-navigation";

describe("direct service routing", () => {
  it.each([
    ["power-levelling", "/skills"],
    ["bossing-pvm", "/bossing"],
    ["quests", "/quests"],
    ["achievement-diaries", "/diaries"],
    ["gold", "/gold"],
    ["premium-services", "/infernal"],
    ["ironman-gathering", "/misc-gathering"],
  ])("bypasses the %s category page", (slug, destination) => {
    expect(directCategoryDestination(slug)).toBe(destination);
  });

  it.each([
    ["skill-training-request", "/skills"],
    ["pvm-support", "/bossing"],
    ["quest-progression", "/quests"],
    ["diary-progression", "/diaries"],
    ["infernal-cape-service", "/infernal"],
    ["gold-trading", "/gold"],
    ["ironman-gathering-support", "/misc-gathering"],
  ])("bypasses the %s legacy detail", (slug, destination) => {
    expect(directServiceDestination(slug)).toBe(destination);
  });

  it("uses direct primary navigation destinations", () => {
    expect(
      Object.fromEntries(
        primaryNavigation.map((item) => [item.label, item.href]),
      ),
    ).toMatchObject({
      Skills: "/skills",
      Bossing: "/bossing",
      Infernal: "/infernal",
      Quests: "/quests",
      Diaries: "/diaries",
      Gold: "/gold",
      Items: "/products",
    });
  });
});

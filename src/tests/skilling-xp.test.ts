import { describe, expect, it } from "vitest";

import {
  calculateLevelProgress,
  calculateXpProgress,
  levelForXp,
  xpForLevel,
} from "@/lib/skilling/xp";

describe("OSRS skilling XP table", () => {
  it("returns exact known level thresholds", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(83);
    expect(xpForLevel(50)).toBe(101_333);
    expect(xpForLevel(99)).toBe(13_034_431);
  });

  it("maps XP boundaries to the highest reached level", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(82)).toBe(1);
    expect(levelForXp(83)).toBe(2);
    expect(levelForXp(13_034_430)).toBe(98);
    expect(levelForXp(13_034_431)).toBe(99);
    expect(levelForXp(200_000_000)).toBe(99);
  });

  it("validates level-mode progress", () => {
    expect(calculateLevelProgress({ currentLevel: 1, targetLevel: 2 })).toEqual(
      expect.objectContaining({ xpRequired: 83, currentXp: 0, targetXp: 83 }),
    );
    expect(() =>
      calculateLevelProgress({ currentLevel: 50, targetLevel: 50 }),
    ).toThrow(/higher/);
    expect(() =>
      calculateLevelProgress({ currentLevel: 60, targetLevel: 50 }),
    ).toThrow(/higher/);
  });

  it("validates XP-mode progress and rejects unsafe values", () => {
    expect(calculateXpProgress({ currentXp: 83, targetXp: 101_333 })).toEqual(
      expect.objectContaining({
        currentLevel: 2,
        targetLevel: 50,
        xpRequired: 101_250,
      }),
    );
    expect(() => calculateXpProgress({ currentXp: -1, targetXp: 1 })).toThrow(
      /negative/,
    );
    expect(() => calculateXpProgress({ currentXp: 10, targetXp: 10 })).toThrow(
      /higher/,
    );
    expect(() => levelForXp(1.5)).toThrow(/whole number/);
    expect(() => xpForLevel(99.5)).toThrow(/whole number/);
    expect(() => levelForXp(200_000_001)).toThrow(/cannot exceed/);
  });
});

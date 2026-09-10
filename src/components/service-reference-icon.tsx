import type { CSSProperties } from "react";

// Display the artwork in the client-supplied reference boards without changing
// their source files. Admin-uploaded boss/skill images take precedence.
const bossRows = [
  [
    "zulrah",
    "vorkath",
    "araxxor",
    "nex",
    "cerberus",
    "hydra",
    "general graardor",
    "k'ril tsutsaroth",
  ],
  [
    "kree'arra",
    "commander zilyana",
    "phantom muspah",
    "kalphite queen",
    "king black dragon",
    "chaos elemental",
    "barrows",
    "dagannoth kings",
  ],
  [
    "corporeal beast",
    "the gauntlet",
    "colosseum",
    "duke sucellus",
    "vardorvis",
    "leviathan",
    "whisperer",
    "zebak",
  ],
  [
    "thermonuclear smoke devil",
    "kraken",
    "sarachnis",
    "scurrius",
    "obor",
    "bryophyta",
    "callisto",
    "vet'ion",
  ],
];
const skillRows = [
  ["attack", "strength", "defence", "hitpoints", "ranged", "prayer"],
  ["magic", "runecrafting", "construction", "agility", "herblore", "thieving"],
  ["crafting", "fletching", "slayer", "hunter", "mining", "smithing"],
  ["fishing", "cooking", "firemaking", "woodcutting", "farming", "sailing"],
];

export function serviceReferenceIcon(
  name: string,
  kind: "boss" | "skill",
  assetPath?: string | null,
): CSSProperties | undefined {
  if (assetPath?.startsWith("/") && !assetPath.startsWith("//")) {
    return {
      backgroundImage: `url(${JSON.stringify(assetPath)})`,
      backgroundSize: "contain",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  const normalized = name
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/^alchemical /, "")
    .replace(/^the /, "")
    .replace(/^runecraft$/, "runecrafting")
    .replace(/^barrows brothers$/, "barrows");
  const rows = kind === "boss" ? bossRows : skillRows;
  for (const [row, names] of rows.entries()) {
    const column = names.findIndex(
      (candidate) => candidate.replace(/^the /, "") === normalized,
    );
    if (column < 0) continue;
    if (kind === "boss")
      return {
        backgroundImage: 'url("/artwork/client-boss-reference.jpeg")',
        backgroundSize: `${(1536 / 114) * 100}% ${(1024 / 85) * 100}%`,
        backgroundPosition: `${((31 + column * 138.5) / (1536 - 114)) * 100}% ${((282 + row * 154) / (1024 - 85)) * 100}%`,
        backgroundRepeat: "no-repeat",
      };
    return {
      backgroundImage: 'url("/artwork/client-skill-reference.jpeg")',
      backgroundSize: `${(1312 / 57) * 100}% ${(1199 / 58) * 100}%`,
      backgroundPosition: `${((48 + column * 88.3) / (1312 - 57)) * 100}% ${((267 + row * 101.5) / (1199 - 58)) * 100}%`,
      backgroundRepeat: "no-repeat",
    };
  }
}

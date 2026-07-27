import type { PrismaClient } from "../src/generated/prisma/client";
import { accountListingRevisionSnapshot } from "../src/lib/accounts/estimate";

const CATEGORY_ID = "accountscategorytask010";
const SERVICE_ID = "accountsservicetask010";
const MARKETPLACE_ID = "accountmarkettask010";

const categoryDescription =
  "Browse representative prebuilt account listings after staff review. Account marketplace data is disabled by default until pricing, screenshots and handover wording are approved.";

const serviceContent =
  "Account marketplace listings are preview-only in Task 010. Support rechecks availability, price and safe handover readiness before any future checkout step. Never provide passwords, email credentials, bank PINs, authenticator data or recovery information.";

const marketplaceInstructions =
  "Use the listing details to request support review. Availability and price are rechecked before any checkout or handover step exists.";

const listingSeeds = [
  {
    id: "acctlistingmainpvm010",
    stableKey: "account-main-pvm-ready",
    title: "PvM ready main account",
    slug: "pvm-ready-main-account",
    shortDescription:
      "Reviewed demo listing for a main account with combat-focused public stats and raid-ready unlock notes.",
    fullDescription:
      "This representative account listing demonstrates the Account Marketplace Engine. It contains public-safe stats, unlocks, feature tags and gallery references only. No login identifier, password, email, recovery detail, bank PIN or authenticator information is stored.",
    internalReferenceCode: "ACCT-DEMO-MAIN-PVM",
    basePriceCents: 24999,
    gameMode: "NORMAL" as const,
    combatLevel: 123,
    totalLevel: 1900,
    questPoints: 284,
    accountAgeLabel: "Established account",
    membershipStateLabel: "Membership review required",
    availability: "AVAILABLE" as const,
    publicationStatus: "PUBLISHED" as const,
    approvalStatus: "APPROVED" as const,
    isFeatured: true,
    sortOrder: 10,
    publicBadgeText: "PvM ready",
    published: true,
    stats: [
      ["combat-level", "Combat level", 123, null, "COMBAT", "Overview", 10],
      ["total-level", "Total level", 1900, 2277, "SUMMARY", "Overview", 20],
      ["quest-points", "Quest points", 284, 400, "QUEST", "Overview", 30],
      ["attack", "Attack", 90, 99, "SKILL", "Combat", 40],
      ["strength", "Strength", 94, 99, "SKILL", "Combat", 50],
      ["ranged", "Ranged", 96, 99, "SKILL", "Combat", 60],
      ["magic", "Magic", 94, 99, "SKILL", "Combat", 70],
    ],
    unlocks: [
      ["barrows-gloves", "Barrows gloves", "QUEST", 10],
      ["lunar-spellbook", "Lunar spellbook", "SPELLBOOK", 20],
      ["raids-access", "Raids access reviewed", "RAID", 30],
    ],
    features: [
      ["main-account", "Main account", 10],
      ["pvm-ready", "PvM ready", 20],
      ["raids-ready", "Raids ready", 30],
    ],
  },
  {
    id: "acctlistingiron010",
    stableKey: "account-iron-skilling-demo",
    title: "Ironman skilling account",
    slug: "ironman-skilling-account",
    shortDescription:
      "Draft demo listing for an Ironman account focused on skilling progression.",
    fullDescription:
      "This draft listing is seeded for admin workflow validation and remains private until approved and published.",
    internalReferenceCode: "ACCT-DEMO-IRON-SKILL",
    basePriceCents: 17999,
    gameMode: "IRONMAN" as const,
    combatLevel: 96,
    totalLevel: 1750,
    questPoints: 210,
    accountAgeLabel: "Progression account",
    membershipStateLabel: "Membership review required",
    availability: "PAUSED" as const,
    publicationStatus: "DRAFT" as const,
    approvalStatus: "PENDING_REVIEW" as const,
    isFeatured: false,
    sortOrder: 20,
    publicBadgeText: "Skilling focused",
    published: false,
    stats: [
      ["total-level", "Total level", 1750, 2277, "SUMMARY", "Overview", 10],
      ["mining", "Mining", 88, 99, "SKILL", "Skilling", 20],
      ["fishing", "Fishing", 91, 99, "SKILL", "Skilling", 30],
    ],
    unlocks: [
      ["fairy-rings", "Fairy rings", "TRANSPORTATION", 10],
      ["hard-diaries", "Hard diary progress", "DIARY", 20],
    ],
    features: [
      ["ironman", "Ironman", 10],
      ["skilling-focused", "Skilling focused", 20],
    ],
  },
  {
    id: "acctlistingpure010",
    stableKey: "account-pure-demo",
    title: "Pure account review listing",
    slug: "pure-account-review-listing",
    shortDescription:
      "Draft demo listing for a pure account profile awaiting client review.",
    fullDescription:
      "This draft listing validates low-defence account feature tags without making production claims.",
    internalReferenceCode: "ACCT-DEMO-PURE",
    basePriceCents: 12999,
    gameMode: "NORMAL" as const,
    combatLevel: 77,
    totalLevel: 1200,
    questPoints: 120,
    accountAgeLabel: "Specialized account",
    membershipStateLabel: "Membership review required",
    availability: "PAUSED" as const,
    publicationStatus: "DRAFT" as const,
    approvalStatus: "PENDING_REVIEW" as const,
    isFeatured: false,
    sortOrder: 30,
    publicBadgeText: "Pure",
    published: false,
    stats: [
      ["combat-level", "Combat level", 77, null, "COMBAT", "Overview", 10],
      ["ranged", "Ranged", 94, 99, "SKILL", "Combat", 20],
      ["magic", "Magic", 94, 99, "SKILL", "Combat", 30],
    ],
    unlocks: [["desert-treasure", "Desert Treasure reviewed", "QUEST", 10]],
    features: [
      ["pure", "Pure", 10],
      ["pvp-ready", "PvP ready", 20],
    ],
  },
] as const;

function imageSeed(listingKey: string, listingTitle: string) {
  return [
    {
      stableKey: `${listingKey}:cover`,
      imageType: "COVER" as const,
      assetPath: "/artwork/portal-hero-desktop.webp",
      altText: `${listingTitle} safe marketplace cover`,
      caption: "Safe demo artwork, not an account screenshot.",
      sortOrder: 10,
    },
    {
      stableKey: `${listingKey}:gallery`,
      imageType: "GALLERY" as const,
      assetPath: "/artwork/portal-hero-mobile.webp",
      altText: `${listingTitle} safe gallery placeholder`,
      caption: "Demo image without private account details.",
      sortOrder: 20,
    },
  ];
}

export async function seedAccountMarketplace(prisma: PrismaClient) {
  const category = await prisma.catalogueCategory.upsert({
    where: { seededKey: "accounts" },
    create: {
      id: CATEGORY_ID,
      seededKey: "accounts",
      name: "Accounts",
      slug: "accounts",
      shortDescription:
        "Prebuilt account listings prepared for support review.",
      description: categoryDescription,
      iconKey: "user-round-search",
      displayOrder: 37,
      isActive: true,
      seoTitle: "OSRS account marketplace",
      seoDescription:
        "Browse reviewed prebuilt account listings without credential storage or checkout.",
    },
    update: {},
    select: { id: true },
  });

  const service = await prisma.catalogueService.upsert({
    where: { seededKey: "account-marketplace" },
    create: {
      id: SERVICE_ID,
      seededKey: "account-marketplace",
      categoryId: category.id,
      name: "Account marketplace",
      slug: "account-marketplace",
      canonicalSlug: "accounts/account-marketplace",
      shortSummary:
        "Browse public-safe prebuilt account listings with server-side filters and support-review calls to action.",
      content: serviceContent,
      serviceType: "MARKETPLACE",
      engineType: "ACCOUNT_MARKETPLACE",
      publicationStatus: "PUBLISHED",
      availabilityState: "AVAILABLE",
      isFeatured: true,
      isQuoteOnly: true,
      displayOrder: 37,
      publicPreparationNotes:
        "Never provide login credentials, email credentials, bank PINs, authenticator data or recovery information.",
      seoTitle: "OSRS account marketplace",
      seoDescription:
        "Prebuilt account marketplace listings with safe handover readiness metadata.",
      needsClientReview: true,
    },
    update: {},
    select: { id: true },
  });

  await prisma.catalogueServiceGameMode.createMany({
    data: [
      { serviceId: service.id, gameMode: "NORMAL" },
      { serviceId: service.id, gameMode: "IRONMAN" },
      { serviceId: service.id, gameMode: "HARDCORE_IRONMAN" },
      { serviceId: service.id, gameMode: "ULTIMATE_IRONMAN" },
    ],
    skipDuplicates: true,
  });

  await prisma.catalogueRequirement.createMany({
    data: [
      {
        seededKey: "account-marketplace:no-credentials",
        serviceId: service.id,
        title: "No credential submission",
        description:
          "Support never asks for passwords, email credentials, PINs, authenticator data or recovery information in Task 010.",
        type: "ACCOUNT",
        isRequired: true,
        displayOrder: 10,
        verificationMode: "CUSTOMER_CONFIRMED",
      },
    ],
    skipDuplicates: true,
  });

  const marketplace = await prisma.accountMarketplace.upsert({
    where: { stableKey: "account-main-marketplace" },
    create: {
      id: MARKETPLACE_ID,
      stableKey: "account-main-marketplace",
      serviceId: service.id,
      publicName: "OSRS Accounts Marketplace",
      slug: "accounts",
      description:
        "Review-safe account marketplace configured for prebuilt account listings.",
      currencyCode: "USD",
      availabilityState: "AVAILABLE",
      publicMarketplaceInstructions: marketplaceInstructions,
      internalNotes:
        "Task 010 seed data is non-production and must be reviewed before enabling the public flag.",
      defaultSort: "featured",
      needsClientReview: true,
    },
    update: {},
    select: { id: true },
  });

  for (const listing of listingSeeds) {
    const savedListing = await prisma.accountListing.upsert({
      where: { stableKey: listing.stableKey },
      create: {
        id: listing.id,
        stableKey: listing.stableKey,
        marketplaceId: marketplace.id,
        publicTitle: listing.title,
        slug: listing.slug,
        shortDescription: listing.shortDescription,
        fullDescription: listing.fullDescription,
        internalReferenceCode: listing.internalReferenceCode,
        currencyCode: "USD",
        basePriceCents: listing.basePriceCents,
        gameMode: listing.gameMode,
        combatLevel: listing.combatLevel,
        totalLevel: listing.totalLevel,
        questPoints: listing.questPoints,
        accountAgeLabel: listing.accountAgeLabel,
        membershipStateLabel: listing.membershipStateLabel,
        availability: listing.availability,
        publicationStatus: listing.publicationStatus,
        approvalStatus: listing.approvalStatus,
        isFeatured: listing.isFeatured,
        sortOrder: listing.sortOrder,
        publicBadgeText: listing.publicBadgeText,
        needsClientReview: true,
        publishedAt: listing.published
          ? new Date("2026-07-27T15:00:00.000Z")
          : null,
      },
      update: {},
      select: { id: true },
    });

    await prisma.accountListingHandoverChecklist.upsert({
      where: { listingId: savedListing.id },
      create: {
        id: `${savedListing.id.slice(0, 18)}handover`,
        listingId: savedListing.id,
        listingSecurityReviewed: listing.published,
        handoverInstructionsPrepared: listing.published,
        ownershipEvidenceReviewed: listing.published,
        readyForFutureHandover: false,
        readiness: "INTERNAL_REVIEW_REQUIRED",
        needsClientReview: true,
      },
      update: {},
    });

    for (const [
      statKey,
      publicLabel,
      value,
      maximumValue,
      statType,
      statGroup,
      sortOrder,
    ] of listing.stats) {
      await prisma.accountListingStat.upsert({
        where: { stableKey: `${listing.stableKey}:stat:${statKey}` },
        create: {
          id: `${listing.id.slice(0, 14)}${statKey.replace(/-/g, "").slice(0, 10)}`,
          stableKey: `${listing.stableKey}:stat:${statKey}`,
          listingId: savedListing.id,
          statKey,
          publicLabel,
          value,
          maximumValue,
          statType,
          statGroup,
          sortOrder,
          isPublic: true,
          needsClientReview: true,
        },
        update: {},
      });
    }

    for (const [
      unlockKey,
      publicLabel,
      unlockType,
      sortOrder,
    ] of listing.unlocks) {
      await prisma.accountListingUnlock.upsert({
        where: { stableKey: `${listing.stableKey}:unlock:${unlockKey}` },
        create: {
          id: `${listing.id.slice(0, 13)}${unlockKey.replace(/-/g, "").slice(0, 11)}`,
          stableKey: `${listing.stableKey}:unlock:${unlockKey}`,
          listingId: savedListing.id,
          unlockKey,
          publicLabel,
          description: "Public-safe unlock marker requiring client review.",
          unlockType,
          sortOrder,
          isPublic: true,
          filterable: true,
          needsClientReview: true,
        },
        update: {},
      });
    }

    for (const [featureKey, publicLabel, sortOrder] of listing.features) {
      await prisma.accountListingFeature.upsert({
        where: { stableKey: `${listing.stableKey}:feature:${featureKey}` },
        create: {
          id: `${listing.id.slice(0, 13)}${featureKey.replace(/-/g, "").slice(0, 11)}`,
          stableKey: `${listing.stableKey}:feature:${featureKey}`,
          listingId: savedListing.id,
          featureKey,
          publicLabel,
          description: "Public-safe feature tag requiring client review.",
          sortOrder,
          isPublic: true,
          filterable: true,
          needsClientReview: true,
        },
        update: {},
      });
    }

    for (const image of imageSeed(listing.stableKey, listing.title)) {
      await prisma.accountListingImage.upsert({
        where: { stableKey: image.stableKey },
        create: {
          id: `${listing.id.slice(0, 15)}${image.imageType.toLowerCase()}`,
          stableKey: image.stableKey,
          listingId: savedListing.id,
          imageType: image.imageType,
          assetPath: image.assetPath,
          altText: image.altText,
          caption: image.caption,
          sortOrder: image.sortOrder,
          isPublic: true,
          needsClientReview: true,
        },
        update: {},
      });
    }

    if (listing.published) {
      const existingRevision = await prisma.accountListingRevision.findFirst({
        where: { listingId: savedListing.id },
        select: { id: true },
      });
      if (!existingRevision) {
        const stats = await prisma.accountListingStat.findMany({
          where: { listingId: savedListing.id, isPublic: true },
          orderBy: { sortOrder: "asc" },
        });
        const unlocks = await prisma.accountListingUnlock.findMany({
          where: { listingId: savedListing.id, isPublic: true },
          orderBy: { sortOrder: "asc" },
        });
        const features = await prisma.accountListingFeature.findMany({
          where: { listingId: savedListing.id, isPublic: true },
          orderBy: { sortOrder: "asc" },
        });
        const images = await prisma.accountListingImage.findMany({
          where: { listingId: savedListing.id, isPublic: true },
          orderBy: [{ imageType: "asc" }, { sortOrder: "asc" }],
        });
        const revisionId = "acctrevisionmainpvm010";
        const publishedAt = new Date("2026-07-27T15:00:00.000Z");
        const snapshot = accountListingRevisionSnapshot({
          marketplace: {
            id: marketplace.id,
            stableKey: "account-main-marketplace",
            slug: "accounts",
            serviceId: service.id,
            serviceSlug: "account-marketplace",
            categoryId: category.id,
            categorySlug: "accounts",
            publicName: "OSRS Accounts Marketplace",
            currencyCode: "USD",
          },
          listing: {
            id: savedListing.id,
            stableKey: listing.stableKey,
            slug: listing.slug,
            publicTitle: listing.title,
            shortDescription: listing.shortDescription,
            fullDescription: listing.fullDescription,
            gameMode: listing.gameMode,
            currencyCode: "USD",
            basePriceCents: listing.basePriceCents,
            combatLevel: listing.combatLevel,
            totalLevel: listing.totalLevel,
            questPoints: listing.questPoints,
            accountAgeLabel: listing.accountAgeLabel,
            membershipStateLabel: listing.membershipStateLabel,
            publicBadgeText: listing.publicBadgeText,
            secureHandoverLabel: "Secure handover process reviewed by support",
          },
          revisionId,
          revisionNumber: 1,
          publishedAt,
          stats: stats.map((stat) => ({
            stableKey: stat.stableKey,
            statKey: stat.statKey,
            publicLabel: stat.publicLabel,
            value: stat.value,
            maximumValue: stat.maximumValue,
            statGroup: stat.statGroup,
            sortOrder: stat.sortOrder,
          })),
          unlocks: unlocks.map((unlock) => ({
            stableKey: unlock.stableKey,
            unlockKey: unlock.unlockKey,
            publicLabel: unlock.publicLabel,
            description: unlock.description,
            unlockType: unlock.unlockType,
            sortOrder: unlock.sortOrder,
          })),
          features: features.map((feature) => ({
            stableKey: feature.stableKey,
            featureKey: feature.featureKey,
            publicLabel: feature.publicLabel,
            description: feature.description,
            sortOrder: feature.sortOrder,
          })),
          images: images.map((image) => ({
            stableKey: image.stableKey,
            imageType: image.imageType,
            assetPath: image.assetPath,
            altText: image.altText,
            caption: image.caption,
            sortOrder: image.sortOrder,
          })),
        });
        await prisma.accountListingRevision.create({
          data: {
            id: revisionId,
            listingId: savedListing.id,
            revisionNumber: 1,
            snapshotSchemaVersion: 1,
            snapshot,
            publishedAt,
          },
        });
      }
    }
  }
}

-- Keep every column using CartItemKind aligned without removing existing values.
ALTER TABLE `OrderResourceAllocation`
  MODIFY `itemKind` ENUM(
    'SKILLING_ESTIMATE', 'BOSSING_ESTIMATE', 'PREMIUM_ESTIMATE',
    'CATALOGUE_OFFERING_ESTIMATE', 'PRODUCT_ESTIMATE',
    'ACCOUNT_LISTING_ESTIMATE', 'GOLD_BUY_ESTIMATE',
    'ACCEPTED_CUSTOM_BUILD_QUOTE'
  ) NOT NULL;

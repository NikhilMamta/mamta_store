/**
 * Unit Conversion Utility
 *
 * All conversions use the explicit factor stored WITH the transaction record.
 * Never use built-in tables or re-read from master for historical records.
 *
 * Terminology:
 *   Base UOM    = Purchase UOM (e.g., LTR, KG, Box)
 *   Issue UOM   = Store-out UOM (e.g., ml, g, pcs)
 *   Factor      = How many issue units = 1 purchase unit (e.g., 1000 for LTR→ml)
 */

/**
 * convertIssueToBaseUOM
 * Converts a store-out quantity (in issue UOM) back to purchase UOM.
 *
 * Example: 200 ml ÷ 1000 = 0.2 LTR
 *
 * @param issueQty  - Quantity in issue UOM (e.g., 200 ml)
 * @param factor    - Conversion factor from transaction snapshot (e.g., 1000)
 * @returns         - Quantity in purchase UOM (e.g., 0.2 LTR)
 */
export function convertIssueToBaseUOM(issueQty: number, factor: number): number {
    const safeFactor = factor > 0 ? factor : 1;
    return issueQty / safeFactor;
}

/**
 * convertBaseToIssueUOM
 * Converts a purchase UOM quantity to issue UOM.
 *
 * Example: 2 LTR × 1000 = 2000 ml
 *
 * @param baseQty  - Quantity in purchase UOM (e.g., 2 LTR)
 * @param factor   - Conversion factor (e.g., 1000)
 * @returns        - Quantity in issue UOM (e.g., 2000 ml)
 */
export function convertBaseToIssueUOM(baseQty: number, factor: number): number {
    return baseQty * (factor > 0 ? factor : 1);
}

/**
 * getFactorFromMaster
 * Reads the issue UOM factor from master data, keyed by inventory item ID.
 * Returns 1 (no conversion) if not configured — safe default.
 *
 * Use this ONLY at transaction creation time to snapshot the factor.
 * Never use this to recalculate historical transactions.
 *
 * @param inventoryItemId      - Stable item ID from inventory table
 * @param itemIssueUomFactor   - Map from masterSheet (itemId → factor)
 */
export function getFactorFromMaster(
    inventoryItemId: number | undefined,
    itemIssueUomFactor: Record<number, number> | undefined
): number {
    if (!inventoryItemId || !itemIssueUomFactor) return 1;
    const factor = itemIssueUomFactor[inventoryItemId];
    return factor && factor > 0 ? factor : 1;
}

/**
 * getIssueUomFromMaster
 * Returns the issue UOM label for an item, keyed by inventory item ID.
 *
 * @param inventoryItemId  - Stable item ID from inventory table
 * @param itemIssueUom     - Map from masterSheet (itemId → issue UOM label)
 */
export function getIssueUomFromMaster(
    inventoryItemId: number | undefined,
    itemIssueUom: Record<number, string> | undefined
): string | undefined {
    if (!inventoryItemId || !itemIssueUom) return undefined;
    return itemIssueUom[inventoryItemId];
}

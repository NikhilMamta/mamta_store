import type { IndentSheet, ReceivedSheet, StoreOutSheet } from '@/types';

type Filters = {
    startDate?: string; // ISO date string
    endDate?: string; // ISO date string
    vendors?: string[];
    products?: string[];
};

export function analyzeData(
    {
        indentSheet,
        receivedSheet,
        storeOutSheet = [],
    }: {
        indentSheet: IndentSheet[];
        receivedSheet: ReceivedSheet[];
        storeOutSheet?: StoreOutSheet[];
    },
    filters: Filters = {}
) {
    const start = filters.startDate ? new Date(filters.startDate) : null;
    const end = filters.endDate ? new Date(filters.endDate) : null;

    const vendorSet = new Set(filters.vendors ?? []);
    const productSet = new Set(filters.products ?? []);

    const isWithinDate = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.toString() !== 'Invalid Date' && (!start || d >= start) && (!end || d <= end);
    };

    const isVendorMatch = (name: string) => !name || vendorSet.size === 0 || vendorSet.has(name);
    const isProductMatch = (name: string) => !name || productSet.size === 0 || productSet.has(name);

    // Map from indentNumber to productName (from Purchase Indents)
    const indentProductMap = new Map<string, string>();
    for (const indent of indentSheet) {
        if (indent.indentNumber && indent.productName) {
            indentProductMap.set(indent.indentNumber, indent.productName);
        }
    }

    // -------------------------------
    // 1. Total Indents (Purchase Type)
    const approvedIndents = indentSheet.filter(
        (i) =>
            isWithinDate(i.timestamp) &&
            isProductMatch(i.productName)
    );

    const totalApprovedQuantity = approvedIndents.reduce(
        (sum, i) => sum + (Number(i.approvedQuantity) || 0),
        0
    );

    // -------------------------------
    // 2. Total Purchases (Received)
    const receivedPurchases = receivedSheet.filter((r) => {
        const productName = indentProductMap.get(r.indentNumber);
        return (
            isWithinDate(r.timestamp) &&
            isVendorMatch(r.vendor) &&
            (!productName || isProductMatch(productName))
        );
    });

    const totalPurchasedQuantity = receivedPurchases.reduce(
        (sum, r) => sum + (Number(r.receivedQuantity) || 0),
        0
    );

    // -------------------------------
    // 3. Total Issued (Store Out Approval / Store Out)
    const issuedItems = storeOutSheet.filter(
        (i) =>
            isWithinDate(i.timestamp) &&
            isProductMatch(i.productName || indentProductMap.get(i.indentNumber || ''))
    );

    const totalIssuedQuantity = issuedItems.reduce(
        (sum, i) => sum + (Number(i.approveQty || i.qty) || 0),
        0
    );

    // -------------------------------
    // Top 10 Products (By frequency in Purchases and Store Out)
    const productFrequencyMap = new Map<string, { freq: number; quantity: number }>();

    // From Purchases
    for (const r of receivedSheet) {
        if (!isWithinDate(r.timestamp)) continue;
        const productName = indentProductMap.get(r.indentNumber);
        if (!productName || !isProductMatch(productName)) continue;

        if (!productFrequencyMap.has(productName)) {
            productFrequencyMap.set(productName, { freq: 0, quantity: 0 });
        }
        const entry = productFrequencyMap.get(productName)!;
        entry.freq += 1;
        entry.quantity += Number(r.receivedQuantity) || 0;
    }

    // From Store Out
    for (const i of storeOutSheet) {
        if (!isWithinDate(i.timestamp)) continue;
        const productName = i.productName || indentProductMap.get(i.indentNumber || '');
        if (!productName || !isProductMatch(productName)) continue;

        if (!productFrequencyMap.has(productName)) {
            productFrequencyMap.set(productName, { freq: 0, quantity: 0 });
        }
        const entry = productFrequencyMap.get(productName)!;
        entry.freq += 1;
        entry.quantity += Number(i.approveQty || i.qty) || 0;
    }

    const topProducts = [...productFrequencyMap.entries()]
        .sort((a, b) => b[1].freq - a[1].freq)
        .slice(0, 10)
        .map(([name, data]) => ({ name, ...data }));

    // -------------------------------
    // Top 10 Vendors
    const vendorMap = new Map<string, { orders: number; quantity: number }>();

    for (const r of receivedSheet) {
        if (!isWithinDate(r.timestamp) || !isVendorMatch(r.vendor)) continue;

        if (!vendorMap.has(r.vendor)) {
            vendorMap.set(r.vendor, { orders: 0, quantity: 0 });
        }
        const entry = vendorMap.get(r.vendor)!;
        entry.orders += 1;
        entry.quantity += Number(r.receivedQuantity) || 0;
    }

    const topVendors = [...vendorMap.entries()]
        .sort((a, b) => b[1].orders - a[1].orders)
        .slice(0, 10)
        .map(([name, data]) => ({ name, ...data }));

    // -------------------------------
    return {
        approvedIndentCount: approvedIndents.length,
        totalApprovedQuantity,
        receivedPurchaseCount: receivedPurchases.length,
        totalPurchasedQuantity,
        issuedIndentCount: issuedItems.length,
        totalIssuedQuantity,
        topProducts,
        topVendors,
    };
}

import type { IndentSheet, MasterSheet, ReceivedSheet, Sheet } from '@/types';
import type { InventorySheet, PoMasterSheet, PoHistorySheet, QuotationHistorySheet, StoreOutSheet, UserPermissions, Vendor, ThreePartyApprovalSheet } from '@/types/sheets';
import { supabase } from './supabase';


// Utility to convert snake_case object to camelCase
const toCamelCase = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => toCamelCase(v));
    } else if (obj !== null && obj.constructor === Object) {
        return Object.keys(obj).reduce(
            (result, key) => ({
                ...result,
                [key.replace(/(_\w)/g, k => k[1].toUpperCase())]: toCamelCase(obj[key]),
            }),
            {},
        );
    }
    return obj;
};

// Utility to convert DD/MM/YYYY HH:mm:ss to YYYY-MM-DD HH:mm:ss for Postgres
const formatToPostgresDate = (dateStr: any): any => {
    if (typeof dateStr !== 'string') return dateStr;

    // Check for DD/MM/YYYY HH:mm:ss or DD/MM/YYYY
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
    if (match) {
        const [, d, m, y, rest] = match;
        // Reformat to YYYY-MM-DD
        let formatted = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

        // If there's time info, format it too
        if (rest && rest.trim()) {
            // Handle space or other separators
            const timePart = rest.trim();
            formatted += ` ${timePart}`;
        }
        return formatted;
    }
    return dateStr;
};

// Utility to convert camelCase object to snake_case (for inserts/updates)
const toSnakeCase = (obj: any): any => {
    // Handle null/undefined safely
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(v => toSnakeCase(v));
    } else if (typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce(
            (result, key) => {
                // Convert camelCase to snake_case and handle numbers (e.g., planned1 -> planned_1)
                const snakeKey = key
                    .replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
                    // Automatically add underscore for numbered fields like planned1 -> planned_1, planned5 -> planned_5
                    // BUT skip planned2 because in the DB it's 'planned2' (no underscore)
                    .replace(/(planned|term)([13456789]|10)/g, '$1_$2')
                    .replace(/(actual)(\d)/g, '$1_$2');

                let value = obj[key];
                // Format date strings for Postgres
                if (typeof value === 'string') {
                    value = formatToPostgresDate(value);
                }

                return {
                    ...result,
                    [snakeKey]: toSnakeCase(value),
                };
            },
            {},
        );
    }
    return obj;
};

// Allowed columns for 'indent' table according to user SQL schema
const INDENT_COLUMNS = [
    'id', 'timestamp', 'indent_number', 'indenter_name', 'department',
    'area_of_use', 'group_head', 'product_name', 'quantity',
    'uom', 'specifications', 'indent_approved_by', 'indent_type',
    'attachment', 'planned_1', 'status', 'actual_2', 'vendor_name_1',
    'rate_1', 'payment_term_1', 'approved_vendor_name', 'approved_rate',
    'approved_payment_term', 'planned2', 'actual_2', 'vendor_name_2', 'rate_2', 'payment_term_2',
    'vendor_name_3', 'rate_3', 'payment_term_3', 'comparison_sheet'
];

const APPROVED_INDENT_COLUMNS = [
    'id', 'timestamp', 'indent_number', 'vendor_type', 'approved_quantity', 'uom', 'delay', 'planned2', 'status'
];

const THREE_PARTY_APPROVAL_COLUMNS = [
    'id', 'timestamp', 'indent_number', 'approved_vendor_name', 'approved_rate',
    'approved_payment_term', 'approved_date', 'planned_4', 'delay', 'status'
];

const VENDOR_RATE_UPDATE_COLUMNS = [
    'id', 'timestamp', 'indent_number', 'vendor_name_1', 'rate_1', 'payment_term_1',
    'vendor_name_2', 'rate_2', 'payment_term_2', 'vendor_name_3', 'rate_3', 'payment_term_3',
    'comparison_sheet', 'delay', 'planned_3', 'status'
];

const PO_HISTORY_COLUMNS = [
    'id', 'timestamp', 'indent_number', 'party_name', 'po_number', 'quotation_number',
    'quotation_date', 'enquiry_number', 'enquiry_date', 'internal_code', 'product',
    'description', 'quantity', 'unit', 'rate', 'gst_percent', 'discount_percent',
    'amount', 'total_po_amount', 'prepared_by', 'approved_by', 'pdf',
    'term_1', 'term_2', 'term_3', 'term_4', 'term_5', 'term_6', 'term_7', 'term_8', 'term_9', 'term_10',
    'status', 'planned_4', 'delay', 'indent_by'
];

const PO_APPROVAL_COLUMNS = [
    'id', 'timestamp', 'indent_number', 'indent_by', 'final_approval', 'planned_5', 'delay', 'status'
];

const RECEIVES_ITEMS_COLUMNS = [
    'id', 'timestamp', 'indent_number', 'po_number', 'po_date', 'vendor',
    'received_status', 'received_quantity', 'uom', 'bill_status', 'bill_amount', 'photo_of_bill', 'searial_number',
    'planned_6', 'status'
];

const STORE_OUT_REQUEST_COLUMNS = [
    'id', 'timestamp', 'indent_number', 'product_name', 'issue_no', 'issue_date', 'indenter_name', 'indent_type',
    'approval_needed', 'requested_by', 'floor', 'ward_name', 'qty', 'unit', 'department',
    'category', 'area_of_use', 'planned_7', 'delay', 'status', 'approved_by',
    // Unit normalization snapshot fields
    'purchase_uom', 'conversion_factor', 'inventory_item_id'
];

const STORE_OUT_APPROVAL_COLUMNS = [
    'id', 'timestamp', 'indent_number', 'approve_qty', 'slip', 'planned_8', 'delay', 'status',
    // Unit normalization snapshot fields (propagated from store_out_request at approval time)
    'purchase_uom', 'conversion_factor', 'inventory_item_id'
];

const STORE_OUT_COLUMNS = [
    'id', 'timestamp', 'indent_number', 'planned_9', 'delay', 'status'
];

const INVENTORY_COLUMNS = [
    'id', 'item_id', 'max_level', 'opening', 'individual_rate',
    'indented', 'approved', 'purchase_quantity', 'out_quantity', 'current_stock',
    'total_price', 'color_code', 'last_updated'
];


const USER_COLUMNS = [
    'id', 'username', 'password', 'name', 'dashboard', 'inventory', 'create_indent',
    'create_po', 'get_purchase', 'all_indent', 'quotation', 'created_at',
    'training_video', 'license', 'approve_indent', 'vendor_rate_update',
    'three_party_approval', 'pending_pos', 'po_history', 'po_approval',
    'receive_items', 'store_out_approval', 'store_out', 'administration', 'master_data'
];

// Utility to normalize table names
const getTableName = (sheetName: string) => {
    const normalized = sheetName.toLowerCase().replace(/\s+/g, '_');
    if (normalized === 'user') return 'users';
    if (normalized === 'received') return 'receives_items';
    if (normalized === 'store_out_approval') return 'store_out_approval';
    if (normalized === 'store_out_request') return 'store_out_request';
    if (normalized === 'store_out') return 'store_out';
    if (normalized === 'po_master') return 'po_history';
    if (normalized === 'po_history') return 'po_history';
    if (normalized === 'inventory') return 'inventory';
    return normalized;
};

export async function uploadFileToSupabase(file: File | Blob, bucketName: string, customFileName?: string): Promise<string> {
    // Use customFileName if provided, otherwise fallback to file.name or a default timestamp
    const baseName = customFileName || (file instanceof File ? file.name : `${Date.now()}.pdf`);
    const fileName = baseName.replace(/[\/\s]+/g, '_');

    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
        });

    if (error) {
        console.error(`Error uploading to Supabase bucket "${bucketName}":`, error);
        throw error;
    }

    const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);

    return publicUrl;
}

type SendPoEmailPayload = {
    to: string;
    vendorName: string;
    poNumber: string;
    pdfUrl: string;
    fileName: string;
};

export async function sendPoEmail(payload: SendPoEmailPayload) {
    const { data, error } = await supabase.functions.invoke('send-po-email', {
        body: payload,
    });

    if (error) {
        throw error;
    }

    if (data?.success === false) {
        throw new Error(data.message || 'Failed to send PO email');
    }

    return data;
}

export async function fetchSheet(
    sheetName: Sheet
): Promise<MasterSheet | IndentSheet[] | ReceivedSheet[] | UserPermissions[] | PoMasterSheet[] | InventorySheet[] | ThreePartyApprovalSheet[]> {
    console.log(`Fetching ${sheetName} from Supabase...`);

    // Check if key looks suspicious (looks like a Stripe key)
    if (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
        console.warn('WARNING: VITE_SUPABASE_PUBLISHABLE_KEY looks like a Stripe key. Please verify it in .env');
    }

    // Special handling for MASTER sheet to maintain backward compatibility with the object structure
    if (sheetName === 'MASTER') {
        const [masterRes, vendorsRes, itemsRes] = await Promise.all([
            supabase.from('master').select('*'),
            supabase.from('vendors').select('*'),
            supabase.from('items').select('*')
        ]);

        if (masterRes.error) {
            console.error('Supabase error fetching MASTER:', masterRes.error);
            throw masterRes.error;
        }

        const vendors: Vendor[] = [];
        const groupHeads: Record<string, Set<string>> = {};
        const departments = new Set<string>();
        const paymentTerms = new Set<string>();
        const defaultTerms = new Set<string>();
        const units = new Set<string>();
        const wardNames = new Set<string>();
        const itemMux: Record<string, string> = {};
        // Name-keyed maps for unit conversion (avoids ID mismatches between master and inventory tables)
        const itemIssueUom: Record<string, string> = {};
        const itemIssueUomFactor: Record<string, number> = {};
        const itemIdByName: Record<string, number> = {}; // itemName.toLowerCase() -> master row id

        let companyInfo: any = {};

        // 1. Process new Vendors table data
        if (vendorsRes.data) {
            vendorsRes.data.forEach((row: any) => {
                const cRow = toCamelCase(row);
                if (cRow.vendorName) {
                    vendors.push({
                        vendorName: cRow.vendorName,
                        gstin: cRow.vendorGstin || '',
                        address: cRow.vendorAddress || '',
                        email: cRow.vendorEmail || ''
                    });
                    if (cRow.paymentTerm) paymentTerms.add(cRow.paymentTerm);
                }
            });
        }

        // 2. Process new Items table data
        if (itemsRes.data) {
            itemsRes.data.forEach((row: any) => {
                const cRow = toCamelCase(row);
                const itemId = Number(cRow.id);
                const itemName = cRow.itemName?.trim();
                const itemNameLower = itemName?.toLowerCase();

                if (itemName) {
                    if (cRow.groupHead) {
                        if (!groupHeads[cRow.groupHead]) groupHeads[cRow.groupHead] = new Set();
                        groupHeads[cRow.groupHead].add(itemName);
                    }
                    if (cRow.purchaseUom || cRow.unitOfMeasurement) {
                        units.add(cRow.purchaseUom || cRow.unitOfMeasurement);
                    }
                    if (itemId && itemNameLower) {
                        itemIdByName[itemNameLower] = itemId;
                        if (cRow.issueUom) {
                            itemIssueUom[itemNameLower] = cRow.issueUom;
                            itemMux[itemNameLower] = cRow.issueUom;
                        }
                        if (cRow.issueUomFactor && Number(cRow.issueUomFactor) > 0) {
                            itemIssueUomFactor[itemNameLower] = Number(cRow.issueUomFactor);
                        }
                    }
                }
            });
        }

        // 3. Process remaining metadata (company info, departments, ward names) from legacy master table
        masterRes.data.forEach((row: any) => {
            const cRow = toCamelCase(row);

            // Backward compatibility fallback in case some data wasn't fully migrated:
            if (cRow.vendorName && vendors.length === 0) {
                vendors.push({
                    vendorName: cRow.vendorName,
                    gstin: cRow.vendorGstin || '',
                    address: cRow.vendorAddress || '',
                    email: cRow.vendorEmail || ''
                });
            }
            if (cRow.paymentTerm) paymentTerms.add(cRow.paymentTerm);
            if (cRow.department) departments.add(cRow.department);
            if (cRow.defaultTerms) defaultTerms.add(cRow.defaultTerms);
            if (cRow.unitOfMeasurement || cRow.unitOfMeasurment) {
                units.add(cRow.unitOfMeasurement || cRow.unitOfMeasurment);
            }
            if (cRow.wardName) wardNames.add(cRow.wardName);

            if (cRow.groupHead && cRow.itemName && Object.keys(groupHeads).length === 0) {
                if (!groupHeads[cRow.groupHead]) groupHeads[cRow.groupHead] = new Set();
                groupHeads[cRow.groupHead].add(cRow.itemName);
            }

            if (cRow.itemName && cRow.mux && Object.keys(itemIssueUom).length === 0) {
                itemMux[cRow.itemName.trim().toLowerCase()] = cRow.mux;
                itemIssueUom[cRow.itemName.trim().toLowerCase()] = cRow.mux;
            }

            if (!companyInfo.companyName && cRow.companyName) {
                companyInfo = {
                    companyName: cRow.companyName,
                    companyAddress: cRow.companyAddress,
                    companyPhone: cRow.companyPhone,
                    companyGstin: cRow.companyGstin,
                    companyPan: cRow.companyPan,
                    billingAddress: cRow.billingAddress,
                    destinationAddress: cRow.destinationAddress,
                };
            }
        });

        return {
            vendors,
            departments: [...departments],
            paymentTerms: [...paymentTerms],
            groupHeads: Object.fromEntries(Object.entries(groupHeads).map(([k, v]) => [k, [...v]])),
            itemMux,
            itemIssueUom,
            itemIssueUomFactor,
            itemIdByName,
            companyPan: companyInfo.companyPan,
            companyName: companyInfo.companyName,
            companyAddress: companyInfo.companyAddress,
            companyPhone: companyInfo.companyPhone,
            companyGstin: companyInfo.companyGstin,
            billingAddress: companyInfo.billingAddress,
            destinationAddress: companyInfo.destinationAddress,
            defaultTerms: [...defaultTerms],
            units: [...units],
            wardNames: [...wardNames]
        };
    }

    if (sheetName === 'INVENTORY') {
        const { data: invData, error: invError } = await supabase
            .from('inventory')
            .select(`
                id,
                max_level,
                opening,
                individual_rate,
                indented,
                approved,
                purchase_quantity,
                out_quantity,
                current_stock,
                total_price,
                color_code,
                last_updated,
                item_id,
                items (
                    item_name,
                    group_head,
                    purchase_uom
                )
            `);

        if (invError) {
            console.error('Supabase error fetching INVENTORY:', invError);
            throw invError;
        }

        const flattened = invData.map((row: any) => {
            const item = row.items || {};
            return {
                id: row.id,
                itemId: row.item_id,
                maxLevel: Number(row.max_level) || 0,
                opening: Number(row.opening) || 0,
                individualRate: Number(row.individual_rate) || 0,
                indented: Number(row.indented) || 0,
                approved: Number(row.approved) || 0,
                purchaseQuantity: Number(row.purchase_quantity) || 0,
                outQuantity: Number(row.out_quantity) || 0,
                currentStock: Number(row.current_stock) || 0,
                totalPrice: Number(row.total_price) || 0,
                colorCode: row.color_code || '',
                lastUpdated: row.last_updated || '',
                itemName: item.item_name || '',
                groupHead: item.group_head || '',
                uom: item.purchase_uom || ''
            };
        });
        return flattened as any;
    }

    const { data, error } = await supabase
        .from(getTableName(sheetName))
        .select('*');

    if (error) {
        console.error(`Supabase error fetching ${sheetName}:`, error);
        throw error;
    }

    // Automatically convert all Supabase data to camelCase to match app expectations
    // EXCEPT for the USER table where we now use the raw snake_case schema for permissions
    if (sheetName === 'USER') return data;
    return toCamelCase(data);
}


export async function postToQuotationHistory(rows: any[]) {
    // Convert to snake_case for Supabase
    const sRows = toSnakeCase(rows);
    const { data, error } = await supabase
        .from('quotation_history')
        .insert(sRows);

    if (error) {
        console.error('Supabase error posting quotation:', error);
        throw error;
    }
    return { success: true, data };
}

export async function postToPoHistory(rows: PoHistorySheet[]) {
    // Manually map camelCase fields to exact snake_case column names in po_history table
    const sRows = rows.map((r) => ({
        timestamp: r.timestamp ? formatToPostgresDate(r.timestamp) : new Date().toISOString(),
        indent_number: r.indentNumber || '',
        party_name: r.partyName || '',
        po_number: r.poNumber || '',
        quotation_number: r.quotationNumber || '',
        quotation_date: formatToPostgresDate(r.quotationDate) || null,
        enquiry_number: r.enquiryNumber || '',
        enquiry_date: formatToPostgresDate(r.enquiryDate) || null,
        internal_code: r.internalCode || r.indentNumber || '',
        product: r.product || '',
        description: r.description || '',
        quantity: r.quantity ?? null,
        unit: r.unit || '',
        rate: r.rate ?? null,
        gst_percent: r.gstPercent ?? null,
        discount_percent: r.discountPercent ?? null,
        amount: r.amount ?? null,
        total_po_amount: r.totalPoAmount ?? null,
        prepared_by: r.preparedBy || '',
        approved_by: r.approvedBy || '',
        pdf: r.pdf || '',
        term_1: r.term1 || null,
        term_2: r.term2 || null,
        term_3: r.term3 || null,
        term_4: r.term4 || null,
        term_5: r.term5 || null,
        term_6: r.term6 || null,
        term_7: r.term7 || null,
        term_8: r.term8 || null,
        term_9: r.term9 || null,
        term_10: r.term10 || null,
        status: r.status || 'Pending',
        planned_4: formatToPostgresDate(r.planned4) || null,
        delay: r.delay || null,
    }));

    const { error } = await supabase.from('po_history').insert(sRows);
    if (error) {
        console.error('Supabase error in postToPoHistory:', error);
        throw error;
    }
    return { success: true };
}

export async function fetchVendorDetails(vendorName: string) {
    const { data, error } = await supabase
        .from('vendors')
        .select('vendor_name, vendor_gstin, vendor_address, vendor_email')
        .ilike('vendor_name', vendorName.trim())
        .limit(1);

    if (error) {
        console.error('Supabase error fetching vendor details:', error);
        return null;
    }

    if (!data || data.length === 0) return null;

    const vendor = data[0];
    return {
        vendorName: vendor.vendor_name,
        gstin: vendor.vendor_gstin,
        address: vendor.vendor_address,
        email: vendor.vendor_email
    };
}

export async function fetchVendors() {
    const { data, error } = await supabase
        .from('vendors')
        .select('vendor_name, vendor_gstin, vendor_address, vendor_email')
        .not('vendor_name', 'is', null);

    if (error) {
        console.error('Supabase error fetching vendors:', error);
        return [];
    }

    return data.map((v: any) => ({
        vendorName: v.vendor_name,
        gstin: v.vendor_gstin,
        address: v.vendor_address,
        email: v.vendor_email
    }));
}

export async function postStoreOutToSheet(data: Partial<StoreOutSheet>[]) {
    // Convert to snake_case for Supabase
    const sData = toSnakeCase(data);
    const { error } = await supabase
        .from('store_out')
        .insert(sData);

    if (error) {
        console.error("Supabase error in postStoreOutToSheet:", error);
        throw error;
    }
    return { success: true };
}

export async function postToSheet(
    data: any[],
    action: 'insert' | 'update' | 'delete' | 'insertQuotation' = 'insert',
    sheet: Sheet = 'INDENT'
) {
    const tableName = getTableName(sheet);
    let result;

    // Filter out null/undefined items from data array
    const cleanData = data.filter(item => item !== null && item !== undefined);

    if (cleanData.length === 0) {
        console.warn('⚠️ postToSheet called with empty data array');
        return { success: true };
    }

    // Convert to snake_case for Supabase
    let sData = toSnakeCase(cleanData);

    // If target table is 'indent', filter out columns not present in user's SQL schema
    if (tableName === 'indent') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            INDENT_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'approved_indent') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            APPROVED_INDENT_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'three_party_approval') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            THREE_PARTY_APPROVAL_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'vendor_rate_update') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            VENDOR_RATE_UPDATE_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'po_history') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            PO_HISTORY_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'po_approval') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            PO_APPROVAL_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'receives_items') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            RECEIVES_ITEMS_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'store_out_approval') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            STORE_OUT_APPROVAL_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'store_out') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            STORE_OUT_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'store_out_request') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            STORE_OUT_REQUEST_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'store_out_approval') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            STORE_OUT_APPROVAL_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'store_out') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            STORE_OUT_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'inventory') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            INVENTORY_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }


    if (tableName === 'users') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            USER_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (tableName === 'po_history') {
        sData = sData.map((row: any) => {
            const filteredRow: any = {};
            PO_HISTORY_COLUMNS.forEach(col => {
                if (col in row) filteredRow[col] = row[col];
            });
            return filteredRow;
        });
    }

    if (action === 'insert' || action === 'insertQuotation') {
        result = await supabase.from(tableName).insert(sData);
    } else if (action === 'update') {
        result = await Promise.all(sData.map((row: any) => {
            // Priority 1: Use 'id' if explicitly provided in the row
            if (row.id) {
                const { id, ...updateData } = row;
                return supabase.from(tableName).update(updateData).match({ id });
            }

            // Priority 2: Use 'indent_number' for 'indent' table or if provided
            if (tableName === 'indent' || row.indent_number) {
                const matchVal = row.indent_number || row.row_index;
                const { indent_number, row_index, ...updateData } = row;
                return supabase.from(tableName).update(updateData).match({ indent_number: matchVal });
            }

            // Priority 3: Fallback for other tables
            const matchVal = row.row_index || row.id;
            const { row_index, id, ...updateData } = row;
            return supabase.from(tableName).update(updateData).match({ id: matchVal });
        }));
    } else if (action === 'delete') {
        result = await Promise.all(sData.map((row: any) => {
            // Priority 1: Use 'id' if explicitly provided in the row
            if (row.id) {
                return supabase.from(tableName).delete().match({ id: row.id });
            }

            // Priority 2: Use 'indent_number' for 'indent' table or if provided
            if (tableName === 'indent' || row.indent_number) {
                const matchVal = row.indent_number || row.row_index;
                return supabase.from(tableName).delete().match({ indent_number: matchVal });
            }

            // Priority 3: Fallback for other tables
            return supabase.from(tableName).delete().match({ id: row.row_index || row.id });
        }));
    }

    // Comprehensive error checking for both single results and arrays of results
    const hasError = Array.isArray(result)
        ? result.some(r => r && r.error)
        : (result && result.error);

    if (hasError) {
        const errorDetail = Array.isArray(result)
            ? result.find(r => r && r.error)?.error
            : result.error;

        console.error(`Supabase error in postToSheet (${action}):`, errorDetail);
        throw new Error(`Supabase ${action} failed: ${errorDetail?.message || 'Unknown error'}`);
    }

    return { success: true };
}

export async function submitToMaster(wardName: string) {
    const { error } = await supabase
        .from('master')
        .insert([{ ward_name: wardName }]);

    if (error) {
        console.error('[submitToMaster] Supabase error:', error);
        return false;
    }
    return true;
}

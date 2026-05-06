export type Sheet = 'INDENT' | 'RECEIVED' | 'MASTER' | 'USER' | 'PO MASTER' | 'PO HISTORY' | 'PO APPROVAL' | 'INVENTORY' | 'QUOTATION HISTORY' | 'STORE OUT' | 'APPROVED INDENT' | 'VENDOR RATE UPDATE' | 'THREE PARTY APPROVAL' | 'STORE OUT REQUEST' | 'STORE OUT APPROVAL' | 'STORE_OUT_REQUEST' | 'STORE_OUT_APPROVAL';

export type ApprovedIndentSheet = {
    id?: number;
    timestamp: string;
    indentNumber: string;
    vendorType: string;
    approvedQuantity: number;
    delay?: string;
    planned2?: string;
    status?: string;
    searialNumber?: string | number;
    uom?: string;
};

export type VendorRateUpdateSheet = {
    id?: number;
    timestamp: string;
    indentNumber: string;
    vendorName1?: string;
    rate1?: number;
    paymentTerm1?: string;
    vendorName2?: string;
    rate2?: number;
    paymentTerm2?: string;
    vendorName3?: string;
    rate3?: number;
    paymentTerm3?: string;
    comparisonSheet?: string;
    delay?: string;
    planned3?: string;
    status?: string;
};

export type PoApprovalSheet = {
    id?: number;
    timestamp: string;
    indentNumber: string;
    indentBy?: string;
    finalApproval?: string;
    planned5?: string;
    delay?: string;
    status?: string;
};

export type ThreePartyApprovalSheet = {
    id?: number;
    timestamp: string;
    indentNumber: string;
    approvedVendorName: string;
    approvedRate: number;
    approvedPaymentTerm: string;
    approvedDate: string;
    planned4: string;
    delay: string;
    status?: string;
};

export type IndentSheet = {
    id?: number;
    rowIndex?: number;
    timestamp: string;
    indentNumber: string;
    indenterName: string;
    department: string;
    areaOfUse: string;
    groupHead: string;
    productName: string;
    quantity: number;
    uom: string;
    specifications: string;
    indentApprovedBy: string;
    indentType: string;
    attachment: string;
    planned1: string;
    actual1: string;
    timeDelay1: string;
    vendorType: string;
    approvedQuantity: number;
    planned2: string;
    actual2: string;
    timeDelay2: string;
    vendorName1: string;
    rate1: number;
    paymentTerm1: string;
    vendorName2: string;
    rate2: number;
    paymentTerm2: string;
    vendorName3: string;
    rate3: number;
    paymentTerm3: string;
    comparisonSheet: string;
    planned3: string;
    actual3: string;
    timeDelay3: string;
    approvedVendorName: string;
    approvedRate: number;
    approvedPaymentTerm: string;
    approvedDate: string;
    planned4: string;
    actual4: string;
    timeDelay4: string;
    poNumber: string;
    poCopy: string;
    planned5: string;
    actual5: string;
    timeDelay5: string;
    receiveStatus: string;
    planned6: string;
    actual6: string;
    timeDelay6: string;
    issueApprovedBy: string;
    issueStatus: string;
    issuedQuantity: number;
    planned7: string;
    actual7: string;
    timeDelay7: string;
    billStatus: string;
    billNumber: string;
    qty: number;
    leadTimeToLiftMaterial: string;
    typeOfBill: string;
    billAmount: number;
    discountAmount: number;
    paymentType: string;
    advanceAmountIfAny: number;
    photoOfBill: string;
    rate: number;
    status?: string;
    searialNumber?: number | string;
    wardName?: string;
    floor?: string;
};

export type StoreOutSheet = {
    rowIndex?: number;
    timestamp: string;
    issueNo: string;
    indentNumber?: string; // Robustness
    issueDate: string;
    requestedBy: string;
    floor: string;
    wardName: string;
    productName: string;
    qty: number;
    quantity?: number; // Robustness
    unit: string;
    uom?: string; // Robustness
    department: string;
    category: string;
    groupHead?: string; // Robustness
    areaOfUse: string;
    indentType?: string;
    planned: string;
    actual: string;
    timeDelay: number;
    status: string;
    approveQty: number;
    searialNumber?: number | string;
    Planned1: string; // Column X
    Actual1: string;  // Column Y
    Status: string;   // Column AA
    status1?: string; // Potential Fetcher rename for Column AA
    storeOutStatus?: string; // Optional manual mapping
    groupOfHead?: string; // Actual key from fetcher
    slip?: string; // Column W
    // Keeping internal mapped names if needed, but safer to match fetcher keys directly
};

export type ReceivedSheet = {
    rowIndex?: number;
    timestamp: string;
    indentNumber: string;
    poDate: string;
    poNumber: string;
    vendor: string;
    receivedStatus: string;
    receivedQuantity: number;
    uom: string;
    photoOfProduct: string;
    warrantyStatus: string;
    endDate: string;
    billStatus: string;
    billNumber: string;
    billAmount: number;
    photoOfBill: string;
    anyTransportations: string;
    transporterName: string;
    transportingAmount: number;
    searialNumber?: string | number;
};

export type InventorySheet = {
    rowIndex?: number;
    lastUpdated?: string;
    groupHead: string;
    itemName: string;
    uom: string;
    maxLevel: number;
    opening: number;
    individualRate: number;
    indented: number;
    approved: number;
    purchaseQuantity: number;
    outQuantity: number;
    current: number;
    totalPrice: number;
    colorCode: string;
    currentStock?: number;
};


export type PoMasterSheet = {
    rowIndex?: number;
    discountPercent: number;
    gstPercent: number;
    timestamp: string;
    partyName: string;
    poNumber: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gst: number;
    discount: number;
    amount: number;
    totalPoAmount: number;
    preparedBy: string;
    approvedBy: string;
    indentBy?: string;
    finalApproved?: string;
    pdf: string;
    quotationNumber: string;
    quotationDate: string;
    enquiryNumber: string;
    enquiryDate: string;
    term1: string;
    term2: string;
    term3: string;
    term4: string;
    term5: string;
    term6: string;
    term7: string;
    term8: string;
    term9: string;
    term10: string;
    planned: string;
    actual: string;
    status: string;
};

export type PoHistorySheet = {
    id?: number;
    timestamp?: string;
    indentNumber?: string;
    partyName?: string;
    poNumber?: string;
    quotationNumber?: string;
    quotationDate?: string;
    enquiryNumber?: string;
    enquiryDate?: string;
    internalCode?: string;
    product?: string;
    description?: string;
    quantity?: number;
    unit?: string;
    rate?: number;
    gstPercent?: number;
    discountPercent?: number;
    amount?: number;
    totalPoAmount?: number;
    preparedBy?: string;
    approvedBy?: string;
    pdf?: string;
    term1?: string;
    term2?: string;
    term3?: string;
    term4?: string;
    term5?: string;
    term6?: string;
    term7?: string;
    term8?: string;
    term9?: string;
    term10?: string;
    status?: string;
    planned4?: string;
    delay?: string;
    indentBy?: string;
};

export type Vendor = {
    vendorName: string;
    gstin: string;
    address: string;
    email: string;
};

export type MasterSheet = {
    vendors: Vendor[];
    paymentTerms: string[];
    departments: string[];
    groupHeads: Record<string, string[]>; // category: items[]
    companyName: string;
    companyAddress: string;
    companyGstin: string;
    companyPhone: string;
    billingAddress: string;
    companyPan: string;
    destinationAddress: string;
    defaultTerms: string[];
    units: string[];
    wardNames: string[];
};

export type UserPermissions = {
    id?: number;
    username: string;
    password: string;
    name: string;

    dashboard: boolean;
    inventory: boolean;
    create_indent: boolean;
    create_po: boolean;
    get_purchase: boolean;
    all_indent: boolean;
    quotation: boolean;
    training_video: boolean;
    license: boolean;
    approve_indent: boolean;
    vendor_rate_update: boolean;
    three_party_approval: boolean;
    pending_pos: boolean;
    po_history: boolean;
    po_approval: boolean;
    receive_items: boolean;
    store_out_approval: boolean;
    store_out: boolean;
    administration: boolean;
    master_data: boolean;
};

export const allPermissionKeys = [
    "dashboard",
    "inventory",
    "create_indent",
    "create_po",
    "get_purchase",
    "all_indent",
    "quotation",
    "training_video",
    "license",
    "approve_indent",
    "vendor_rate_update",
    "three_party_approval",
    "pending_pos",
    "po_history",
    "po_approval",
    "receive_items",
    "store_out_approval",
    "store_out",
    "administration",
    "master_data",
] as const;


export type QuotationHistorySheet = {
    rowIndex?: number;
    timestamp: string;
    quatationNo: string;      // Note: matches sheet spelling
    supplierName: string;
    adreess: string;          // Note: matches sheet spelling
    gst: string;
    indentNo: string;
    product: string;
    description: string;
    qty: string;
    unit: string;
    pdfLink: string;

};
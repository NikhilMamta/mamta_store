import { fetchSheet } from '@/lib/fetchers';
import type { IndentSheet, InventorySheet, MasterSheet, PoMasterSheet, ReceivedSheet, StoreOutSheet, PoHistorySheet } from '@/types';
import type { ApprovedIndentSheet, VendorRateUpdateSheet, ThreePartyApprovalSheet, PoApprovalSheet } from '@/types/sheets';
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SheetsState {
    updateReceivedSheet: () => void;
    updatePoMasterSheet: () => void;
    updateIndentSheet: () => void;
    updateStoreOutSheet: () => void;
    updateApprovedIndentSheet: () => void;
    updateVendorRateUpdateSheet: () => void;
    updateThreePartyApprovalSheet: () => void;
    updatePoHistorySheet: () => void;
    updatePoApprovalSheet: () => void;
    updateStoreOutApprovalSheet: () => void;
    updateInventorySheet: () => void;
    updateAll: () => void;

    indentSheet: IndentSheet[];
    storeOutSheet: StoreOutSheet[];
    poMasterSheet: PoMasterSheet[];
    receivedSheet: ReceivedSheet[];
    inventorySheet: InventorySheet[];
    approvedIndentSheet: ApprovedIndentSheet[];
    vendorRateUpdateSheet: VendorRateUpdateSheet[];
    threePartyApprovalSheet: ThreePartyApprovalSheet[];
    poHistorySheet: PoHistorySheet[];
    poApprovalSheet: PoApprovalSheet[];
    storeOutApprovalSheet: any[];
    masterSheet: MasterSheet | undefined;

    indentLoading: boolean;
    storeOutLoading: boolean;
    poMasterLoading: boolean;
    receivedLoading: boolean;
    inventoryLoading: boolean;
    approvedIndentLoading: boolean;
    vendorRateUpdateLoading: boolean;
    threePartyApprovalLoading: boolean;
    poHistoryLoading: boolean;
    poApprovalLoading: boolean;
    storeOutApprovalLoading: boolean;
    allLoading: boolean;
}

const SheetsContext = createContext<SheetsState | null>(null);

export const SheetsProvider = ({ children }: { children: React.ReactNode }) => {
    const [indentSheet, setIndentSheet] = useState<IndentSheet[]>([]);
    const [storeOutSheet, setStoreOutSheet] = useState<StoreOutSheet[]>([]);
    const [receivedSheet, setReceivedSheet] = useState<ReceivedSheet[]>([]);
    const [poMasterSheet, setPoMasterSheet] = useState<PoMasterSheet[]>([]);
    const [inventorySheet, setInventorySheet] = useState<InventorySheet[]>([]);
    const [approvedIndentSheet, setApprovedIndentSheet] = useState<ApprovedIndentSheet[]>([]);
    const [vendorRateUpdateSheet, setVendorRateUpdateSheet] = useState<VendorRateUpdateSheet[]>([]);
    const [threePartyApprovalSheet, setThreePartyApprovalSheet] = useState<ThreePartyApprovalSheet[]>([]);
    const [poHistorySheet, setPoHistorySheet] = useState<PoHistorySheet[]>([]);
    const [poApprovalSheet, setPoApprovalSheet] = useState<PoApprovalSheet[]>([]);
    const [storeOutApprovalSheet, setStoreOutApprovalSheet] = useState<any[]>([]);
    const [masterSheet, setMasterSheet] = useState<MasterSheet>();

    const [indentLoading, setIndentLoading] = useState(true);
    const [storeOutLoading, setStoreOutLoading] = useState(true);
    const [poMasterLoading, setPoMasterLoading] = useState(true);
    const [receivedLoading, setReceivedLoading] = useState(true);
    const [inventoryLoading, setInventoryLoading] = useState(true);
    const [approvedIndentLoading, setApprovedIndentLoading] = useState(true);
    const [vendorRateUpdateLoading, setVendorRateUpdateLoading] = useState(true);
    const [threePartyApprovalLoading, setThreePartyApprovalLoading] = useState(true);
    const [poHistoryLoading, setPoHistoryLoading] = useState(true);
    const [poApprovalLoading, setPoApprovalLoading] = useState(true);
    const [storeOutApprovalLoading, setStoreOutApprovalLoading] = useState(true);
    const [allLoading, setAllLoading] = useState(true);

    function updateIndentSheet() {
        setIndentLoading(true);
        fetchSheet('INDENT').then((res) => {
            setIndentSheet(res as IndentSheet[]);
            setIndentLoading(false);
        });
    }

    function updateStoreOutSheet() {
        setStoreOutLoading(true);
        fetchSheet('STORE OUT APPROVAL').then((res) => {
            setStoreOutSheet(res as any as StoreOutSheet[]);
            setStoreOutLoading(false);
        });
    }
    function updateReceivedSheet() {
        setReceivedLoading(true);
        fetchSheet('RECEIVED').then((res) => {
            setReceivedSheet(res as ReceivedSheet[]);
            setReceivedLoading(false);
        });
    }

    function updatePoMasterSheet() {
        setPoMasterLoading(true);
        fetchSheet('PO MASTER').then((res) => {
            setPoMasterSheet(res as PoMasterSheet[]);
            setPoMasterLoading(false);
        });
    }

    function updateInventorySheet() {
        setInventoryLoading(true);
        fetchSheet('INVENTORY').then((res) => {
            setInventorySheet(res as InventorySheet[]);
            setInventoryLoading(false);
        });
    }


    function updateApprovedIndentSheet() {
        setApprovedIndentLoading(true);
        fetchSheet('APPROVED INDENT').then((res) => {
            setApprovedIndentSheet(res as ApprovedIndentSheet[]);
            setApprovedIndentLoading(false);
        });
    }

    function updateVendorRateUpdateSheet() {
        setVendorRateUpdateLoading(true);
        fetchSheet('VENDOR RATE UPDATE').then((res) => {
            setVendorRateUpdateSheet(res as VendorRateUpdateSheet[]);
            setVendorRateUpdateLoading(false);
        });
    }

    function updateThreePartyApprovalSheet() {
        setThreePartyApprovalLoading(true);
        fetchSheet('THREE PARTY APPROVAL').then((res) => {
            setThreePartyApprovalSheet(res as ThreePartyApprovalSheet[]);
            setThreePartyApprovalLoading(false);
        });
    }

    function updatePoHistorySheet() {
        setPoHistoryLoading(true);
        fetchSheet('PO HISTORY').then((res) => {
            setPoHistorySheet(res as PoHistorySheet[]);
            setPoHistoryLoading(false);
        });
    }

    function updatePoApprovalSheet() {
        setPoApprovalLoading(true);
        fetchSheet('PO APPROVAL').then((res) => {
            setPoApprovalSheet(res as PoApprovalSheet[]);
            setPoApprovalLoading(false);
        });
    }

    function updateStoreOutApprovalSheet() {
        setStoreOutApprovalLoading(true);
        fetchSheet('STORE OUT REQUEST').then((res) => {
            setStoreOutApprovalSheet(res as any[]);
            setStoreOutApprovalLoading(false);
        });
    }

    function updateMasterSheet() {
        fetchSheet('MASTER').then((res) => {
            setMasterSheet(res as MasterSheet);
        });
    }

    function updateAll() {
        setAllLoading(true);
        updateMasterSheet();
        updateReceivedSheet();
        updateIndentSheet();
        updateStoreOutSheet();
        updatePoMasterSheet();
        updateInventorySheet();
        updateApprovedIndentSheet();
        updateVendorRateUpdateSheet();
        updateThreePartyApprovalSheet();
        updatePoHistorySheet();
        updatePoApprovalSheet();
        updateStoreOutApprovalSheet();
        setAllLoading(false);
    }

    useEffect(() => {
        try {
            updateAll();
            toast.success('Fetched all the data');
        } catch (e) {
            toast.error('Something went wrong while fetching data');
        } finally {
        }
    }, []);

    return (
        <SheetsContext.Provider
            value={{
                updateIndentSheet,
                updateStoreOutSheet,
                updatePoMasterSheet,
                updateReceivedSheet,
                updateApprovedIndentSheet,
                updateVendorRateUpdateSheet,
                updateThreePartyApprovalSheet,
                updatePoHistorySheet,
                updatePoApprovalSheet,
                updateStoreOutApprovalSheet,
                updateInventorySheet,
                updateAll,
                indentSheet,
                storeOutSheet,
                poMasterSheet,
                receivedSheet,
                storeOutApprovalSheet,
                inventorySheet,
                approvedIndentSheet,
                vendorRateUpdateSheet,
                threePartyApprovalSheet,
                poHistorySheet,
                poApprovalSheet,
                masterSheet,
                indentLoading,
                storeOutLoading,
                poMasterLoading,
                receivedLoading,
                storeOutApprovalLoading,
                inventoryLoading,
                approvedIndentLoading,
                vendorRateUpdateLoading,
                threePartyApprovalLoading,
                poHistoryLoading,
                poApprovalLoading,
                allLoading,
            }}
        >
            {children}
        </SheetsContext.Provider>
    );
};

export const useSheets = () => useContext(SheetsContext)!;

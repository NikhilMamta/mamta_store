import { fetchFromDB } from '@/lib/fetchers';
import type { IndentData, InventoryData, MasterData, PoMasterData, ReceivedData, StoreOutData, PoHistoryData } from '@/types';
import type { ApprovedIndentData, VendorRateUpdateData, ThreePartyApprovalData, PoApprovalData } from '@/types/database';
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface DatabaseState {
    updateReceivedData: () => void;
    updatePoMasterData: () => void;
    updateIndentData: () => void;
    updateStoreOutData: () => void;
    updateApprovedIndentData: () => void;
    updateVendorRateUpdateData: () => void;
    updateThreePartyApprovalData: () => void;
    updatePoHistoryData: () => void;
    updatePoApprovalData: () => void;
    updateStoreOutApprovalData: () => void;
    updateInventoryData: () => void;
    updateMasterData: () => void;
    updateAll: () => void;

    indentData: IndentData[];
    storeOutData: StoreOutData[];
    poMasterData: PoMasterData[];
    receivedData: ReceivedData[];
    inventoryData: InventoryData[];
    approvedIndentData: ApprovedIndentData[];
    vendorRateUpdateData: VendorRateUpdateData[];
    threePartyApprovalData: ThreePartyApprovalData[];
    poHistoryData: PoHistoryData[];
    poApprovalData: PoApprovalData[];
    storeOutApprovalData: any[];
    masterData: MasterData | undefined;

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

const DatabaseContext = createContext<DatabaseState | null>(null);

export const DatabaseProvider = ({ children }: { children: React.ReactNode }) => {
    const [indentData, setIndentData] = useState<IndentData[]>([]);
    const [storeOutData, setStoreOutData] = useState<StoreOutData[]>([]);
    const [receivedData, setReceivedData] = useState<ReceivedData[]>([]);
    const [poMasterData, setPoMasterData] = useState<PoMasterData[]>([]);
    const [inventoryData, setInventoryData] = useState<InventoryData[]>([]);
    const [approvedIndentData, setApprovedIndentData] = useState<ApprovedIndentData[]>([]);
    const [vendorRateUpdateData, setVendorRateUpdateData] = useState<VendorRateUpdateData[]>([]);
    const [threePartyApprovalData, setThreePartyApprovalData] = useState<ThreePartyApprovalData[]>([]);
    const [poHistoryData, setPoHistoryData] = useState<PoHistoryData[]>([]);
    const [poApprovalData, setPoApprovalData] = useState<PoApprovalData[]>([]);
    const [storeOutApprovalData, setStoreOutApprovalData] = useState<any[]>([]);
    const [masterData, setMasterData] = useState<MasterData>();

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

    function updateIndentData() {
        setIndentLoading(true);
        fetchFromDB('INDENT').then((res) => {
            setIndentData(res as IndentData[]);
            setIndentLoading(false);
        });
    }

    function updateStoreOutData() {
        setStoreOutLoading(true);
        fetchFromDB('STORE OUT APPROVAL').then((res) => {
            setStoreOutData(res as any as StoreOutData[]);
            setStoreOutLoading(false);
        });
    }
    function updateReceivedData() {
        setReceivedLoading(true);
        fetchFromDB('RECEIVED').then((res) => {
            setReceivedData(res as ReceivedData[]);
            setReceivedLoading(false);
        });
    }

    function updatePoMasterData() {
        setPoMasterLoading(true);
        fetchFromDB('PO MASTER').then((res) => {
            setPoMasterData(res as PoMasterData[]);
            setPoMasterLoading(false);
        });
    }

    function updateInventoryData() {
        setInventoryLoading(true);
        fetchFromDB('INVENTORY').then((res) => {
            setInventoryData(res as InventoryData[]);
            setInventoryLoading(false);
        });
    }

    function updateApprovedIndentData() {
        setApprovedIndentLoading(true);
        fetchFromDB('APPROVED INDENT').then((res) => {
            setApprovedIndentData(res as ApprovedIndentData[]);
            setApprovedIndentLoading(false);
        });
    }
    
    function updateVendorRateUpdateData() {
        setVendorRateUpdateLoading(true);
        fetchFromDB('VENDOR RATE UPDATE').then((res) => {
            setVendorRateUpdateData(res as VendorRateUpdateData[]);
            setVendorRateUpdateLoading(false);
        });
    }
    
    function updateThreePartyApprovalData() {
        setThreePartyApprovalLoading(true);
        fetchFromDB('THREE PARTY APPROVAL').then((res) => {
            setThreePartyApprovalData(res as ThreePartyApprovalData[]);
            setThreePartyApprovalLoading(false);
        });
    }

    function updatePoHistoryData() {
        setPoHistoryLoading(true);
        fetchFromDB('PO HISTORY').then((res) => {
            setPoHistoryData(res as PoHistoryData[]);
            setPoHistoryLoading(false);
        });
    }

    function updatePoApprovalData() {
        setPoApprovalLoading(true);
        fetchFromDB('PO APPROVAL').then((res) => {
            setPoApprovalData(res as PoApprovalData[]);
            setPoApprovalLoading(false);
        });
    }

    function updateStoreOutApprovalData() {
        setStoreOutApprovalLoading(true);
        fetchFromDB('STORE OUT REQUEST').then((res) => {
            setStoreOutApprovalData(res as any[]);
            setStoreOutApprovalLoading(false);
        });
    }
    
    function updateMasterData() {
        fetchFromDB('MASTER').then((res) => {
            setMasterData(res as MasterData);
        });
    }

    function updateAll() {
        setAllLoading(true);
        updateMasterData();
        updateReceivedData();
        updateIndentData();
        updateStoreOutData();
        updatePoMasterData();
        updateInventoryData();
        updateApprovedIndentData();
        updateVendorRateUpdateData();
        updateThreePartyApprovalData();
        updatePoHistoryData();
        updatePoApprovalData();
        updateStoreOutApprovalData();
        setAllLoading(false);
    }

    useEffect(() => {
        try {
            updateAll();
        } catch (e) {
            toast.error('Something went wrong while fetching data');
        } finally {
        }
    }, []);

    return (
        <DatabaseContext.Provider
            value={{
                updateIndentData,
                updateStoreOutData,
                updatePoMasterData,
                updateReceivedData,
                updateApprovedIndentData,
                updateVendorRateUpdateData,
                updateThreePartyApprovalData,
                updatePoHistoryData,
                updatePoApprovalData,
                updateStoreOutApprovalData,
                updateInventoryData,
                updateMasterData,
                updateAll,
                indentData,
                storeOutData,
                poMasterData,
                receivedData,
                storeOutApprovalData,
                inventoryData,
                approvedIndentData,
                vendorRateUpdateData,
                threePartyApprovalData,
                poHistoryData,
                poApprovalData,
                masterData,
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
        </DatabaseContext.Provider>
    );
};

export const useDatabase = () => useContext(DatabaseContext)!;

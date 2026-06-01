import Heading from '../element/Heading';

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef } from '@tanstack/react-table';
import { Pill } from '../ui/pill';
import DataTable from '../element/DataTable';
import { Card, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Store, X, Calendar, RefreshCw, Search, Pencil } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { ComboBox } from '../ui/combobox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { postToSheet } from '@/lib/fetchers';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InventoryTable {
    id?: number;
    itemName: string;
    groupHead: string;
    uom: string;
    status: string;
    opening: number;
    rate: number;
    indented: number;
    approved: number;
    purchaseQuantity: number;
    outQuantity: number;
    currentStock: number;
    totalPrice: number;
    lastUpdated: string;
    mux?: string;
}

export default () => {
    const {
        inventorySheet,
        inventoryLoading,
        masterSheet,
        updateAll,
        indentSheet,
        approvedIndentSheet,
        receivedSheet,
        storeOutSheet,
        storeOutApprovalSheet,
        vendorRateUpdateSheet
    } = useSheets();

    const navigate = useNavigate();

    const [tableData, setTableData] = useState<InventoryTable[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryTable | null>(null);
    const [editOpeningValue, setEditOpeningValue] = useState('');

    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');
    const [filterItem, setFilterItem] = useState('');
    const [searchItemTerm, setSearchItemTerm] = useState('');

    useEffect(() => {
        // Use raw sheets for everything
        const filteredIndentSheet = indentSheet;
        const filteredApprovedIndentSheet = approvedIndentSheet;
        const filteredReceivedSheet = receivedSheet;
        const filteredStoreOutSheet = storeOutSheet;
        const filteredStoreOutApprovalSheet = storeOutApprovalSheet;
        const filteredVendorRateUpdateSheet = vendorRateUpdateSheet;

        // 1. Mapping of indentNumber -> itemName from FULL sheets (to resolve names for historical items)
        const indentToItem: Record<string, string> = {};

        indentSheet.forEach(row => {
            if (row.indentNumber && row.productName) {
                indentToItem[row.indentNumber] = row.productName.trim().toLowerCase();
            }
        });

        storeOutApprovalSheet.forEach(row => {
            if ((row.indentNumber || row.issueNo) && row.productName) {
                const id = row.indentNumber || row.issueNo;
                indentToItem[id] = row.productName.trim().toLowerCase();
            }
        });

        // 2. Track latest activity timestamp using ONLY filtered sheets
        const latestActivityMap: Record<string, Date> = {};
        const updateLatest = (name: string, ts: any) => {
            if (!name || !ts) return;
            let d: Date;
            if (typeof ts === 'string' && ts.includes('/')) {
                const [datePart, timePart] = ts.split(' ');
                const [day, month, year] = datePart.split('/');
                d = new Date(`${year}-${month}-${day}${timePart ? 'T' + timePart : ''}`);
            } else {
                d = new Date(ts);
            }
            if (isNaN(d.getTime())) return;
            if (!latestActivityMap[name] || d > latestActivityMap[name]) {
                latestActivityMap[name] = d;
            }
        };

        // Populate latest activity from filtered sheets
        filteredIndentSheet.forEach(r => updateLatest(r.productName?.trim().toLowerCase(), r.timestamp));
        filteredApprovedIndentSheet.forEach(r => updateLatest(indentToItem[r.indentNumber], r.timestamp));
        filteredReceivedSheet.forEach(r => updateLatest(indentToItem[r.indentNumber], r.timestamp));
        filteredStoreOutSheet.forEach(r => {
            const id = r.indentNumber || r.issueNo;
            const name = (r.productName || (id ? indentToItem[id] : '') || '').trim().toLowerCase();
            updateLatest(name, r.timestamp || r.issueDate);
        });

        // 3. Calculate dynamic totals from filtered sheets
        const indentTotals: Record<string, number> = {};
        filteredIndentSheet.forEach(curr => {
            const name = curr.productName?.trim().toLowerCase();
            if (name) {
                indentTotals[name] = (indentTotals[name] || 0) + (Number(curr.quantity) || 0);
            }
        });

        const approvedTotals: Record<string, number> = {};
        filteredApprovedIndentSheet.forEach(curr => {
            const name = indentToItem[curr.indentNumber];
            if (name) {
                approvedTotals[name] = (approvedTotals[name] || 0) + (Number(curr.approvedQuantity) || 0);
            }
        });

        const purchaseTotals: Record<string, number> = {};
        filteredReceivedSheet.forEach(curr => {
            const name = indentToItem[curr.indentNumber];
            if (name) {
                purchaseTotals[name] = (purchaseTotals[name] || 0) + (Number(curr.receivedQuantity) || 0);
            }
        });

        const outTotals: Record<string, number> = {};
        filteredStoreOutSheet.forEach(curr => {
            const id = curr.indentNumber || curr.issueNo;
            const name = (curr.productName || (id ? indentToItem[id] : '') || '').trim().toLowerCase();
            if (name) {
                outTotals[name] = (outTotals[name] || 0) + (Number(curr.approveQty || curr.qty) || 0);
            }
        });

        // Latest rates from filtered vendor updates
        const latestRates: Record<string, number> = {};
        const sortedVendorUpdates = [...filteredVendorRateUpdateSheet].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        sortedVendorUpdates.forEach(curr => {
            const name = indentToItem[curr.indentNumber];
            if (name && !latestRates[name] && curr.rate1) {
                latestRates[name] = Number(curr.rate1);
            }
        });

        // 4. Group inventory sheet by unique item name
        const uniqueInventory: Record<string, any> = {};
        inventorySheet.forEach(i => {
            const name = i.itemName?.trim().toLowerCase();
            if (!name) return;

            // Seed latest activity from the inventory record itself
            updateLatest(name, i.lastUpdated);

            if (!uniqueInventory[name]) {
                uniqueInventory[name] = { ...i, opening: Number(i.opening || 0) };
            } else {
                uniqueInventory[name].opening += Number(i.opening || 0);
            }
        });

        // Build final rows
        let sortedData = Object.values(uniqueInventory).map((i: any) => {
            const itemName = i.itemName?.trim().toLowerCase();
            const indented = itemName ? (indentTotals[itemName] || 0) : 0;
            const approved = itemName ? (approvedTotals[itemName] || 0) : 0;
            const purchased = itemName ? (purchaseTotals[itemName] || 0) : 0;
            const issued = itemName ? (outTotals[itemName] || 0) : 0;
            const opening = i.opening || 0;

            const currentStock = opening + purchased - issued;
            const rate = itemName ? (latestRates[itemName] || i.individualRate || 0) : (i.individualRate || 0);
            const totalPrice = currentStock * rate;
            const mux = itemName ? (masterSheet?.itemMux?.[itemName] || '') : '';

            return {
                id: i.id,
                totalPrice,
                uom: i.uom || '',
                rate,
                currentStock,
                status: i.colorCode || '',
                indented,
                opening,
                itemName: i.itemName || '',
                groupHead: i.groupHead || '',
                mux,
                purchaseQuantity: purchased,
                approved,
                outQuantity: issued,
                lastUpdated: latestActivityMap[itemName]?.toISOString() || '',
            };
        });

        // ✅ PROFESSIONAL SEARCH & SORT:
        // Sort by lastUpdated (most recent first)
        sortedData.sort((a: any, b: any) => {
            const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            return dateB - dateA;
        });

        // Apply search and dropdown filters
        const filteredAndSorted = sortedData.filter(item => {
            const search = searchTerm.toLowerCase();
            const searchMatch = !searchTerm || (
                item.itemName.toLowerCase().includes(search) ||
                item.groupHead.toLowerCase().includes(search) ||
                item.uom.toLowerCase().includes(search)
            );
            let dateMatch = true;
            if (filterFromDate || filterToDate) {
                if (item.lastUpdated && !isNaN(Date.parse(item.lastUpdated))) {
                    const itemDateStr = new Date(item.lastUpdated).toLocaleDateString('en-CA');
                    if (filterFromDate && itemDateStr < filterFromDate) dateMatch = false;
                    if (filterToDate && itemDateStr > filterToDate) dateMatch = false;
                } else {
                    dateMatch = false;
                }
            }
            const itemMatch = !filterItem || item.itemName === filterItem;
            return searchMatch && dateMatch && itemMatch;
        });

        setTableData(filteredAndSorted);
    }, [
        inventorySheet,
        indentSheet,
        approvedIndentSheet,
        receivedSheet,
        storeOutSheet,
        storeOutApprovalSheet,
        vendorRateUpdateSheet,
        searchTerm,
        filterFromDate,
        filterToDate,
        filterItem,
    ]);

    const columns: ColumnDef<InventoryTable>[] = [
        {
            id: 'actions',
            header: () => <div className="text-slate-500 text-center text-[11px] font-bold tracking-wider uppercase min-w-[80px]">Actions</div>,
            cell: ({ row }) => (
                <div className="flex justify-center min-w-[80px]">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-emerald-700 h-8 w-8 p-0 hover:bg-emerald-50 hover:text-emerald-800 border border-transparent hover:border-emerald-100 rounded-md transition-all active:scale-90"
                        onClick={() => {
                            setEditingInventoryItem(row.original);
                            setEditOpeningValue(row.original.opening.toString());
                            setIsEditOpen(true);
                        }}
                        title="Edit Opening Quantity"
                    >
                        <Pencil size={14} />
                    </Button>
                </div>
            ),
        },
        {
            id: 'serialNo',
            header: () => <div className="text-slate-400 text-center text-[11px] font-bold tracking-wider uppercase min-w-[60px]">S.No.</div>,
            cell: ({ row }) => <div className="text-center font-bold text-xs text-slate-400 min-w-[60px]">#{(row.index + 1).toString().padStart(2, '0')}</div>,
        },
        {
            accessorKey: 'lastUpdated',
            id: 'lastUpdated',
            header: () => <div className="text-slate-500 text-center text-[11px] font-bold tracking-wider uppercase min-w-[150px]">Last Updated</div>,
            cell: ({ row }) => {
                const date = row.original.lastUpdated;
                if (!date) return <div className="text-center text-slate-300 min-w-[150px]">—</div>;
                return (
                    <div className="flex flex-col items-center justify-center text-center text-xs gap-1 min-w-[150px]">
                        <span className="font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/50 whitespace-nowrap shadow-sm">
                            {new Date(date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                            }).replace(/ /g, '-')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase">
                            {new Date(date).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                            })}
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'itemName',
            id: 'itemName',
            header: () => <div className="text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[260px] pl-4">Item Name</div>,
            cell: ({ row }) => {
                return (
                    <div className="text-left font-extrabold text-slate-800 leading-snug min-w-[260px] pl-4 whitespace-normal break-words pr-2">
                        {row.original.itemName}
                    </div>
                );
            },
        },
        {
            accessorKey: 'groupHead',
            id: 'groupHead',
            header: () => <div className="text-center text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[140px]">Group Head</div>,
            cell: ({ getValue }) => (
                <div className="text-center min-w-[140px]">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100/50 shadow-sm">
                        {getValue() as string}
                    </span>
                </div>
            )
        },
        {
            accessorKey: 'uom',
            id: 'uom',
            header: () => <div className="text-center text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[90px]">UOM</div>,
            cell: ({ getValue }) => (
                <div className="text-center min-w-[90px]">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200/60 uppercase tracking-wider">
                        {getValue() as string}
                    </span>
                </div>
            )
        },
        {
            accessorKey: 'mux',
            id: 'mux',
            header: () => <div className="text-center text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[100px]">Mux</div>,
            cell: ({ getValue }) => {
                const val = getValue() as string;
                return (
                    <div className="text-center min-w-[100px]">
                        {val ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-100/50 shadow-sm">
                                {val}
                            </span>
                        ) : (
                            <span className="text-slate-300">—</span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'rate',
            id: 'rate',
            header: () => <div className="text-right text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[120px] pr-4">Rate</div>,
            cell: ({ row }) => (
                <div className="text-right font-extrabold text-slate-700 min-w-[120px] pr-4">
                    ₹{Number(row.original.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            ),
        },
        {
            accessorKey: 'status',
            id: 'status',
            header: () => <div className="text-center text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[130px]">Status</div>,
            cell: ({ row }) => {
                const code = row.original.status?.toLowerCase() || '';
                let content;
                if (row.original.currentStock === 0) {
                    content = <Pill variant="reject">Out of Stock</Pill>;
                } else if (code === 'red') {
                    content = <Pill variant="pending">Low Stock</Pill>;
                } else if (code === 'purple') {
                    content = <Pill variant="primary">Excess</Pill>;
                } else {
                    content = <Pill variant="secondary">In Stock</Pill>;
                }
                return (
                    <div className="flex justify-center min-w-[130px]">
                        {content}
                    </div>
                );
            },
        },
        {
            accessorKey: 'indented',
            id: 'indented',
            header: () => <div className="text-right text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[110px] pr-4">Indented</div>,
            cell: ({ getValue }) => (
                <div className="text-right font-extrabold text-slate-600 min-w-[110px] pr-4">
                    {Number(getValue()).toLocaleString('en-IN')}
                </div>
            )
        },
        {
            accessorKey: 'approved',
            id: 'approved',
            header: () => <div className="text-right text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[110px] pr-4">Approved</div>,
            cell: ({ getValue }) => (
                <div className="text-right font-extrabold text-sky-600 min-w-[110px] pr-4">
                    {Number(getValue()).toLocaleString('en-IN')}
                </div>
            )
        },
        {
            accessorKey: 'opening',
            id: 'opening',
            header: () => <div className="text-right text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[110px] pr-4">Opening</div>,
            cell: ({ getValue }) => (
                <div className="text-right font-semibold text-slate-500 min-w-[110px] pr-4">
                    {Number(getValue()).toLocaleString('en-IN')}
                </div>
            )
        },
        {
            accessorKey: 'purchaseQuantity',
            id: 'purchaseQuantity',
            header: () => <div className="text-right text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[115px] pr-4">Purchased</div>,
            cell: ({ getValue }) => (
                <div className="text-right font-black text-emerald-600 min-w-[115px] pr-4">
                    {Number(getValue()).toLocaleString('en-IN')}
                </div>
            )
        },
        {
            accessorKey: 'outQuantity',
            id: 'outQuantity',
            header: () => <div className="text-right text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[110px] pr-4">Issued</div>,
            cell: ({ getValue }) => (
                <div className="text-right font-black text-rose-600 min-w-[110px] pr-4">
                    {Number(getValue()).toLocaleString('en-IN')}
                </div>
            )
        },
        {
            accessorKey: 'currentStock',
            id: 'currentStock',
            header: () => <div className="text-center text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[140px]">Current Quantity</div>,
            cell: ({ getValue, row }) => {
                const qty = getValue() as number;
                const code = row.original.status?.toLowerCase() || '';
                let bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
                if (qty === 0) {
                    bgClass = "bg-rose-50 text-rose-700 border-rose-200/60";
                } else if (code === 'red') {
                    bgClass = "bg-amber-50 text-amber-700 border-amber-200/60";
                } else if (code === 'purple') {
                    bgClass = "bg-violet-50 text-violet-700 border-violet-200/60";
                }
                return (
                    <div className="flex justify-center min-w-[140px]">
                        <span className={cn("inline-flex items-center px-3 py-1 rounded-md text-xs font-black border shadow-sm", bgClass)}>
                            {qty.toLocaleString('en-IN')}
                        </span>
                    </div>
                );
            }
        },
        {
            accessorKey: 'totalPrice',
            id: 'totalPrice',
            header: () => <div className="text-right text-[11px] font-bold tracking-wider text-slate-500 uppercase min-w-[140px] pr-4">Total Value</div>,
            cell: ({ row }) => (
                <div className="text-right font-black text-emerald-800 min-w-[140px] pr-4">
                    ₹{Number(row.original.totalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            ),
        },
    ];

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingInventoryItem) return;

        setIsSubmitting(true);
        try {
            await postToSheet(
                [
                    {
                        id: editingInventoryItem.id,
                        opening: parseFloat(editOpeningValue) || 0,
                        lastUpdated: new Date().toISOString(),
                    },
                ],
                'update',
                'INVENTORY'
            );
            toast.success('Opening quantity updated successfully');
            setIsEditOpen(false);
            setEditingInventoryItem(null);
            updateAll();
        } catch (error) {
            toast.error('Failed to update opening quantity');
        } finally {
            setIsSubmitting(false);
        }
    };

    const allUniqueItems = Array.from(
        new Set((inventorySheet || []).map((i: any) => i.itemName).filter(Boolean))
    ).sort();

    return (
        <div className="flex flex-col gap-4 p-4">
            {/* Unified Professional Industrial Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between p-4 gap-4">
                    {/* Section 1: Title & Stats */}
                    <div className="flex items-center gap-4 min-w-[280px]">
                        <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 shadow-sm">
                            <Store size={28} className="text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                Inventory
                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">Live</span>
                            </h1>
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                {tableData.length} Unique Items Tracked
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Search & Filters */}
                    <div className="flex flex-1 items-center gap-2 bg-gray-50/50 p-1.5 rounded-xl border border-gray-100 min-w-[200px]">
                        <div className="relative flex-1 group min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary" size={18} />
                            <Input
                                placeholder="Search inventory items..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-10 pl-10 pr-4 border-none bg-transparent focus-visible:ring-0 shadow-none font-medium text-sm placeholder:text-gray-400 w-full"
                            />
                        </div>

                        {searchTerm && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSearchTerm('')}
                                className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 text-[11px] font-bold rounded-lg mr-2"
                            >
                                <X size={14} />
                                <span>Clear Search</span>
                            </Button>
                        )}
                    </div>

                    {/* Section 3: Actions */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateAll()}
                            className="gap-2 h-10 px-4 font-bold border-gray-200 hover:bg-primary/5 hover:border-primary/20 transition-all active:scale-95"
                        >
                            <RefreshCw size={16} className={inventoryLoading ? 'animate-spin' : ''} />
                            <span className="hidden xl:inline">Refresh</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Unified Professional Filter Bar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Calendar size={12} className="text-primary/70" />
                            From Date
                        </span>
                        <Input
                            type="date"
                            value={filterFromDate}
                            onChange={(e) => setFilterFromDate(e.target.value)}
                            className="w-40 h-9 font-medium text-xs rounded-lg border-gray-200 focus-visible:ring-primary focus-visible:border-primary"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Calendar size={12} className="text-primary/70" />
                            To Date
                        </span>
                        <Input
                            type="date"
                            value={filterToDate}
                            onChange={(e) => setFilterToDate(e.target.value)}
                            className="w-40 h-9 font-medium text-xs rounded-lg border-gray-200 focus-visible:ring-primary focus-visible:border-primary"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Store size={12} className="text-primary/70" />
                            Filter by Item
                        </span>
                        <Select value={filterItem || 'all'} onValueChange={(val) => setFilterItem(val === 'all' ? '' : val)}>
                            <SelectTrigger className="w-64 h-9 font-medium text-xs bg-white border-gray-200 rounded-lg focus-visible:ring-primary">
                                <SelectValue placeholder="All Items" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px] overflow-y-auto">
                                <div className="flex items-center border-b px-2 pb-2 pt-1 sticky top-0 bg-background z-10">
                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
                                    <input
                                        placeholder="Search items..."
                                        value={searchItemTerm}
                                        onChange={(e) => setSearchItemTerm(e.target.value)}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        className="flex h-8 w-full rounded-md border-0 bg-transparent py-2 text-xs outline-none placeholder:text-muted-foreground font-medium"
                                    />
                                </div>
                                <SelectItem value="all" className="text-xs font-semibold">All Items</SelectItem>
                                {allUniqueItems
                                    .filter(item => item.toLowerCase().includes(searchItemTerm.toLowerCase()))
                                    .map(item => (
                                        <SelectItem key={item} value={item} className="text-xs font-medium">{item}</SelectItem>
                                    ))
                                }
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {(filterFromDate || filterToDate || filterItem) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setFilterFromDate('');
                            setFilterToDate('');
                            setFilterItem('');
                            setSearchItemTerm('');
                        }}
                        className="h-9 px-3 text-xs font-bold text-destructive hover:bg-destructive/5 rounded-lg flex items-center gap-1.5 transition-all self-end"
                    >
                        <X size={14} />
                        Clear All Filters
                    </Button>
                )}
            </div>

            <DataTable
                data={tableData}
                columns={columns}
                dataLoading={inventoryLoading}
                searchFields={[]}
                className="h-[74dvh] rounded-2xl bg-white border border-gray-100 shadow-sm overflow-auto"
                tableClassName="min-w-[2050px] w-full [&_td]:py-3.5 [&_td]:px-4 [&_td]:h-auto [&_td]:text-[13px] [&_td]:font-medium [&_th]:py-4 [&_th]:px-4 [&_th]:h-auto [&_th]:text-[11px] [&_th]:font-bold [&_th]:tracking-wider [&_th]:uppercase [&_th]:bg-slate-50/80 [&_th]:text-slate-500 [&_th]:border-b [&_th]:border-slate-200/60 [&_tr]:border-slate-100 hover:[&_tr]:bg-slate-50/70 [&_tr]:transition-all [&_tr]:duration-200"
            />

            {/* Edit Opening Quantity Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Opening Quantity</DialogTitle>
                        <DialogDescription>
                            Update the opening quantity for <strong>{editingInventoryItem?.itemName}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="editOpening">Opening Qty</Label>
                            <Input
                                id="editOpening"
                                type="number"
                                value={editOpeningValue}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || parseFloat(val) >= 0) {
                                        setEditOpeningValue(val);
                                    }
                                }}
                                placeholder="0"
                                min="0"
                            />
                        </div>
                        <Button type="submit" className="w-full h-11 text-base font-bold mt-2" disabled={isSubmitting}>
                            {isSubmitting ? 'Updating...' : 'Update Quantity'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
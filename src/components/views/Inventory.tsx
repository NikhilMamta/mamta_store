import Heading from '../element/Heading';

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef } from '@tanstack/react-table';
import { Pill } from '../ui/pill';
import DataTable from '../element/DataTable';
import { Card, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Store, X, Calendar, RefreshCw, Search } from 'lucide-react';
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

interface InventoryTable {
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
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        itemName: '',
        groupHead: '',
        uom: '',
        opening: '',
    });

    const [filterDate, setFilterDate] = useState('');
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

            return {
                totalPrice,
                uom: i.uom || '',
                rate,
                currentStock,
                status: i.colorCode || '',
                indented,
                opening,
                itemName: i.itemName || '',
                groupHead: i.groupHead || '',
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
            const dateMatch = !filterDate || (item.lastUpdated && !isNaN(Date.parse(item.lastUpdated)) && new Date(item.lastUpdated).toLocaleDateString('en-CA') === filterDate);
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
        filterDate,
        filterItem,
    ]);

    const columns: ColumnDef<InventoryTable>[] = [
        {
            accessorKey: 'lastUpdated',
            id: 'lastUpdated',
            header: () => <div className="text-center">Last Updated</div>,
            cell: ({ row }) => {
                const date = row.original.lastUpdated;
                if (!date) return <div className="text-center">-</div>;
                return (
                    <div className="flex flex-col items-center justify-center text-center text-xs">
                        <span className="font-bold text-gray-900">
                            {new Date(date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                            }).replace(/ /g, '-')}
                        </span>
                        <span className="text-muted-foreground font-medium uppercase tracking-tighter">
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
            header: () => <div className="text-center">Item</div>,
            cell: ({ row }) => {
                return (
                    <div className="text-wrap max-w-40 text-center font-medium mx-auto">{row.original.itemName}</div>
                );
            },
        },
        {
            accessorKey: 'groupHead',
            id: 'groupHead',
            header: () => <div className="text-center">Group Head</div>,
            cell: ({ getValue }) => <div className="text-center">{getValue() as string}</div>
        },
        {
            accessorKey: 'uom',
            id: 'uom',
            header: () => <div className="text-center">UOM</div>,
            cell: ({ getValue }) => <div className="text-center">{getValue() as string}</div>
        },
        {
            accessorKey: 'rate',
            id: 'rate',
            header: () => <div className="text-center">Rate</div>,
            cell: ({ row }) => {
                return <div className="text-center">₹{row.original.rate}</div>;
            },
        },
        {
            accessorKey: 'status',
            id: 'status',
            header: () => <div className="text-center">Status</div>,
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
                    <div className="flex justify-center">
                        {content}
                    </div>
                );
            },
        },
        {
            accessorKey: 'indented',
            id: 'indented',
            header: () => <div className="text-center">Indented</div>,
            cell: ({ getValue }) => <div className="text-center font-medium">{getValue() as number}</div>
        },
        {
            accessorKey: 'approved',
            id: 'approved',
            header: () => <div className="text-center">Approved</div>,
            cell: ({ getValue }) => <div className="text-center font-medium">{getValue() as number}</div>
        },
        {
            accessorKey: 'opening',
            id: 'opening',
            header: () => <div className="text-center">Opening</div>,
            cell: ({ getValue }) => <div className="text-center">{getValue() as number}</div>
        },
        {
            accessorKey: 'purchaseQuantity',
            id: 'purchaseQuantity',
            header: () => <div className="text-center">Purchased</div>,
            cell: ({ getValue }) => <div className="text-center font-bold text-primary">{getValue() as number}</div>
        },
        {
            accessorKey: 'outQuantity',
            id: 'outQuantity',
            header: () => <div className="text-center">Issued</div>,
            cell: ({ getValue }) => <div className="text-center font-bold text-red-600">{getValue() as number}</div>
        },
        {
            accessorKey: 'currentStock',
            id: 'currentStock',
            header: () => <div className="text-center">Current Quantity</div>,
            cell: ({ getValue }) => <div className="text-center font-black text-lg">{getValue() as number}</div>
        },
        {
            accessorKey: 'totalPrice',
            id: 'totalPrice',
            header: () => <div className="text-center">Total Price</div>,
            cell: ({ row }) => {
                return <div className="text-center font-bold text-primary">₹{row.original.totalPrice}</div>;
            },
        },
    ];

    // Prepare options for ComboBox
    const allItems = Object.entries(masterSheet?.groupHeads || {}).flatMap(([group, items]) =>
        items.map((item) => ({ label: item, value: item, group }))
    );

    const uomOptions = masterSheet?.units || [];

    const handleItemChange = (val: string[]) => {
        const selectedItem = val[0] || '';
        const found = allItems.find((i) => i.value === selectedItem);
        setFormData((prev) => ({
            ...prev,
            itemName: selectedItem,
            groupHead: found?.group || prev.groupHead,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.itemName || !formData.groupHead || !formData.uom) {
            toast.error('Please fill all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            await postToSheet(
                [
                    {
                        lastUpdated: new Date().toISOString(),
                        groupHead: formData.groupHead,
                        itemName: formData.itemName,
                        uom: formData.uom,
                        opening: parseFloat(formData.opening as any) || 0,
                        currentStock: parseFloat(formData.opening as any) || 0,
                    },
                ],
                'insert',
                'INVENTORY'
            );
            toast.success('Inventory item added successfully');
            setIsFormOpen(false);
            setFormData({ itemName: '', groupHead: '', uom: '', opening: '' });
            updateAll();
        } catch (error) {
            toast.error('Failed to add inventory item');
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

                        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2 px-5 h-10 text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95">
                                    <Plus size={20} strokeWidth={3} />
                                    <span className="hidden md:inline">Add Item</span>
                                    <span className="md:hidden">Add</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Add Inventory Item</DialogTitle>
                                    <DialogDescription>
                                        Enter details to add a new item to the inventory.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="itemName">Item Name</Label>
                                        <ComboBox
                                            options={allItems}
                                            value={formData.itemName ? [formData.itemName] : []}
                                            onChange={handleItemChange}
                                            placeholder="Select Item..."
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="groupHead">Group Head</Label>
                                        <Input
                                            id="groupHead"
                                            value={formData.groupHead}
                                            onChange={(e) =>
                                                setFormData({ ...formData, groupHead: e.target.value })
                                            }
                                            placeholder="Group Head"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="uom">UOM</Label>
                                        <Select
                                            value={formData.uom}
                                            onValueChange={(val) =>
                                                setFormData({ ...formData, uom: val })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select UOM" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {uomOptions.map((unit) => (
                                                    <SelectItem key={unit} value={unit}>
                                                        {unit}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="opening">Opening Qty</Label>
                                        <Input
                                            id="opening"
                                            type="number"
                                            value={formData.opening}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || parseFloat(val) >= 0) {
                                                    setFormData({ ...formData, opening: val });
                                                }
                                            }}
                                            placeholder="0"
                                            min="0"
                                        />
                                    </div>
                                    <Button type="submit" className="w-full h-11 text-base font-bold mt-2" disabled={isSubmitting}>
                                        {isSubmitting ? 'Submitting...' : 'Submit'}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap gap-4 items-end bg-muted/10 p-3 rounded-2xl border border-muted-foreground/10">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted-foreground">Date</span>
                    <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-40 h-9" />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted-foreground">Item</span>
                    <Select value={filterItem || 'all'} onValueChange={(val) => setFilterItem(val === 'all' ? '' : val)}>
                        <SelectTrigger className="w-64 h-9 bg-background">
                            <SelectValue placeholder="All Items" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px] overflow-y-auto">
                            <div className="flex items-center border-b px-2 pb-2 pt-1 sticky top-0 bg-background z-10">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    placeholder="Search items..."
                                    value={searchItemTerm}
                                    onChange={(e) => setSearchItemTerm(e.target.value)}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="flex h-8 w-full rounded-md border-0 bg-transparent py-2 text-xs outline-none placeholder:text-muted-foreground"
                                />
                            </div>
                            <SelectItem value="all">All Items</SelectItem>
                            {allUniqueItems
                                .filter(item => item.toLowerCase().includes(searchItemTerm.toLowerCase()))
                                .map(item => (
                                    <SelectItem key={item} value={item}>{item}</SelectItem>
                                ))
                            }
                        </SelectContent>
                    </Select>
                </div>
                {(filterDate || filterItem) && (
                    <Button variant="ghost" onClick={() => { setFilterDate(''); setFilterItem(''); setSearchItemTerm(''); }} className="h-9 text-xs text-destructive hover:bg-destructive/10">
                        Clear Filters
                    </Button>
                )}
            </div>

            <DataTable
                data={tableData}
                columns={columns}
                dataLoading={inventoryLoading}
                searchFields={[]}
                className="h-[78dvh] rounded-2xl"
            />
        </div>
    );
};
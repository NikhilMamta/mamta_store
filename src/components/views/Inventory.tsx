import Heading from '../element/Heading';

import { useEffect, useState } from 'react';
import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef } from '@tanstack/react-table';
import { Pill } from '../ui/pill';
import DataTable from '../element/DataTable';
import { Card, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Store } from 'lucide-react';
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
        vendorRateUpdateSheet
    } = useSheets();
 
    const [tableData, setTableData] = useState<InventoryTable[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        itemName: '',
        groupHead: '',
        uom: '',
        opening: '',
    });
 
    useEffect(() => {
        // 1. Create a mapping of indentNumber -> itemName from indentSheet
        const indentToItem: Record<string, string> = {};
        indentSheet.forEach(row => {
            if (row.indentNumber && row.productName) {
                indentToItem[row.indentNumber] = row.productName.trim().toLowerCase();
            }
        });

        // 2. Calculate dynamic totals
        const indentTotals: Record<string, number> = {};
        indentSheet.forEach(curr => {
            const name = curr.productName?.trim().toLowerCase();
            if (name) {
                indentTotals[name] = (indentTotals[name] || 0) + (Number(curr.quantity) || 0);
            }
        });

        const approvedTotals: Record<string, number> = {};
        approvedIndentSheet.forEach(curr => {
            const name = indentToItem[curr.indentNumber];
            if (name) {
                approvedTotals[name] = (approvedTotals[name] || 0) + (Number(curr.approvedQuantity) || 0);
            }
        });

        const purchaseTotals: Record<string, number> = {};
        receivedSheet.forEach(curr => {
            const name = indentToItem[curr.indentNumber];
            if (name) {
                purchaseTotals[name] = (purchaseTotals[name] || 0) + (Number(curr.receivedQuantity) || 0);
            }
        });

        const outTotals: Record<string, number> = {};
        storeOutSheet.forEach(curr => {
            // Some store out records might have productName directly, some might have indentNumber
            const name = (curr.productName || (curr.indentNumber ? indentToItem[curr.indentNumber] : '') || '').trim().toLowerCase();
            if (name) {
                // 'approveQty' in storeOutSheet typically represents the issued quantity
                outTotals[name] = (outTotals[name] || 0) + (Number(curr.approveQty || curr.qty) || 0);
            }
        });

        // 3. Calculate latest rates from vendorRateUpdateSheet
        const latestRates: Record<string, number> = {};
        // Sort by timestamp (newest first) to easily get the latest rate
        const sortedVendorUpdates = [...vendorRateUpdateSheet].sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        sortedVendorUpdates.forEach(curr => {
            const name = indentToItem[curr.indentNumber];
            if (name && !latestRates[name] && curr.rate1) {
                latestRates[name] = Number(curr.rate1);
            }
        });

        setTableData(
            inventorySheet.map((i) => {
                const itemName = i.itemName?.trim().toLowerCase();
                const indented = itemName ? (indentTotals[itemName] || 0) : 0;
                const approved = itemName ? (approvedTotals[itemName] || 0) : 0;
                const purchased = itemName ? (purchaseTotals[itemName] || 0) : 0;
                const issued = itemName ? (outTotals[itemName] || 0) : 0;
                const opening = i.opening || 0;
                
                // Current Stock calculation: Opening + Purchased - Issued
                const currentStock = opening + purchased - issued;

                // Rate from Vendor Rate Update table
                const rate = itemName ? (latestRates[itemName] || i.individualRate || 0) : (i.individualRate || 0);
                const totalPrice = currentStock * rate;

                return {
                    totalPrice: totalPrice,
                    uom: i.uom || '',
                    rate: rate,
                    currentStock: currentStock,
                    status: i.colorCode || '',
                    indented: indented,
                    opening: opening,
                    itemName: i.itemName || '',
                    groupHead: i.groupHead || '',
                    purchaseQuantity: purchased,
                    approved: approved,
                    outQuantity: issued,
                };
            })
            .reverse()
        );
    }, [inventorySheet, indentSheet, approvedIndentSheet, receivedSheet, storeOutSheet, vendorRateUpdateSheet]);
    const columns: ColumnDef<InventoryTable>[] = [
        {
            accessorKey: 'itemName',
            header: 'Item',
            cell: ({ row }) => {
                return (
                    <div className="text-wrap max-w-40 text-center">{row.original.itemName}</div>
                );
            },
        },
        { accessorKey: 'groupHead', header: 'Group Head' },
        { accessorKey: 'uom', header: 'UOM' },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => {
                return <>&#8377;{row.original.rate}</>;
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const code = row.original.status?.toLowerCase() || '';
                if (row.original.currentStock === 0) {
                    return <Pill variant="reject">Out of Stock</Pill>;
                }
                if (code === 'red') {
                    return <Pill variant="pending">Low Stock</Pill>;
                }
                if (code === 'purple') {
                    return <Pill variant="primary">Excess</Pill>;
                }
                return <Pill variant="secondary">In Stock</Pill>;
            },
        },
        { accessorKey: 'indented', header: 'Indented' },
        { accessorKey: 'approved', header: 'Approved' },
        { accessorKey: 'opening', header: 'Opening' },
        { accessorKey: 'purchaseQuantity', header: 'Purchased' },
        { accessorKey: 'outQuantity', header: 'Issued' },
        { accessorKey: 'currentStock', header: 'Current Quantity' },
        {
            accessorKey: 'totalPrice',
            header: 'Total Price',

            cell: ({ row }) => {
                return <>&#8377;{row.original.totalPrice}</>;
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
                        groupHead: formData.groupHead,                    // Col A
                        itemName: formData.itemName,                       // Col B
                        uom: formData.uom,                                 // Col C
                        opening: parseFloat(formData.opening as any) || 0, // Col E
                        currentStock: parseFloat(formData.opening as any) || 0, // Initial current stock = opening
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
 
    return (
        <div className="flex flex-col gap-5 p-5">
            <Heading
                heading="Inventory"
                subtext="View Inventory"
                extraActions={
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 px-6 h-11 text-base font-bold shadow-md hover:shadow-lg transition-all active:scale-95">
                                <Plus size={22} strokeWidth={3} />
                                Form
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
                }
            >
                <Store size={40} className="text-primary" />
            </Heading>
 
            <DataTable
                data={tableData}
                columns={columns}
                dataLoading={inventoryLoading}
                searchFields={['itemName', 'groupHead', 'uom', 'status']}
                className="h-[75dvh]"
            />
        </div>
    );
};

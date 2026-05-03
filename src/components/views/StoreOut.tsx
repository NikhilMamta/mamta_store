import { type ColumnDef } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import { Button } from '../ui/button';
import { postToDB } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { ClipboardList, FileText, PackageSearch } from 'lucide-react';
import Heading from '../element/Heading';
import type { StoreOutData } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pill } from '../ui/pill';
import { formatDate } from '@/lib/utils';

interface StoreOutTableData {
    id: string;
    issueNo: string;
    requestedBy: string;
    product: string;
    category: string;
    qty: number;
    unit: string;
    storeOutStatus: string;
    slip?: string;
    wardName: string;
    floor: string;
    searialNumber?: number | string;
    storeOutActual?: string;
    originalRow: StoreOutData;
}

interface GroupedStoreOutStatusData {
    issueNo: string;
    indenterName: string;
    department: string;
    category: string;
    wardName: string;
    floor: string;
    slip?: string;
    items: StoreOutTableData[];
}

export default () => {
    const { storeOutData, storeOutLoading, updateStoreOutData, indentData, storeOutApprovalData } = useDatabase();

    const [pendingData, setPendingData] = useState<GroupedStoreOutStatusData[]>([]);
    const [historyData, setHistoryData] = useState<GroupedStoreOutStatusData[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<GroupedStoreOutStatusData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<GroupedStoreOutStatusData | null>(null);

    const mapRowToTableData = (row: any): StoreOutTableData => {
        // Smarter lookup for missing data from indentData and storeOutApprovalData
        const lookupId = (row.indentNumber || '').split(/[_/]/)[0].toLowerCase();
        
        const indentDetail = indentData?.find(i => {
            if (row.searialNumber && i.searialNumber) {
                return String(i.searialNumber) === String(row.searialNumber);
            }
            const itemBaseId = (i.indentNumber || '').split(/[_/]/)[0].toLowerCase();
            return lookupId === itemBaseId;
        });

        // Fallback to storeOutApprovalData (STORE OUT REQUEST)
        const requestDetail = !indentDetail ? storeOutApprovalData?.find(r => {
             const requestId = (r.issueNo || r.indentNumber || '').split(/[_/]/)[0].toLowerCase();
             return lookupId === requestId;
        }) : null;

        return {
            id: row.id,
            issueNo: row.indentNumber || 'N/A',
            requestedBy: row.requestedBy || indentDetail?.indenterName || requestDetail?.requestedBy || 'N/A',
            product: row.productName || row.product || row.itemName || row.item || indentDetail?.productName || requestDetail?.productName || requestDetail?.product || requestDetail?.category || 'N/A',
            category: indentDetail?.groupHead || requestDetail?.category || '',
            qty: Number(row.approveQty || 0),
            unit: indentDetail?.uom || requestDetail?.unit || '',
            storeOutStatus: row.status || 'Pending',
            slip: row.slip || '',
            wardName: indentDetail?.wardName || requestDetail?.wardName || '',
            floor: indentDetail?.floor || requestDetail?.floor || '',
            searialNumber: row.searialNumber,
            storeOutActual: row.timestamp ? formatDate(new Date(row.timestamp)) : '',
            originalRow: row,
        };
    };

    useEffect(() => {
        if (!storeOutData) return;

        const allItems = storeOutData.map(mapRowToTableData);
        const pendingItems = allItems.filter((row) => row.storeOutStatus?.toLowerCase() === 'pending');
        const historyItems = allItems.filter((row) => row.storeOutStatus?.toLowerCase() === 'approved' || row.storeOutStatus?.toLowerCase() === 'rejected');

        const groupItems = (items: StoreOutTableData[]) => {
            return items.reduce((acc, item) => {
                const baseId = (item.issueNo || '').split(/[_/]/)[0];
                if (!acc[baseId]) {
                    // Smart lookup for department
                    const lookupId = baseId.toLowerCase();
                    const indent = indentData?.find(i => {
                        const itemBaseId = (i.indentNumber || '').split(/[_/]/)[0].toLowerCase();
                        return lookupId === itemBaseId;
                    });

                    acc[baseId] = {
                        issueNo: baseId,
                        indenterName: item.requestedBy,
                        department: indent?.department || 'N/A',
                        category: item.category,
                        wardName: item.wardName,
                        floor: item.floor,
                        slip: item.slip,
                        items: [],
                    };
                }
                acc[baseId].items.push(item);
                return acc;
            }, {} as Record<string, GroupedStoreOutStatusData>);
        };

        setPendingData(Object.values(groupItems(pendingItems)).reverse());
        setHistoryData(Object.values(groupItems(historyItems)).reverse());
    }, [storeOutData, indentData]);

    const pendingColumns: ColumnDef<GroupedStoreOutStatusData>[] = [
        {
            id: 'actions',
            header: 'Action',
            cell: ({ row }) => (
                <Button size="sm" variant="outline" onClick={() => setSelectedGroup(row.original)}>
                    Action ({row.original.items.length})
                </Button>
            ),
        },
        { accessorKey: 'issueNo', header: 'Issue No.' },
        { accessorKey: 'indenterName', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'wardName', header: 'Ward Name' },
        {
            header: 'Products',
            cell: ({ row }) => (
                <div className="max-w-[200px] break-words text-xs">
                    {row.original.items.map(i => i.product).join(', ')}
                </div>
            )
        },
        {
            header: 'Slip',
            cell: ({ row }) => row.original.slip ? (
                <a href={row.original.slip} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
                    <FileText size={14} /> View Slip
                </a>
            ) : <span className="text-muted-foreground text-xs">No Slip</span>
        }
    ];

    const historyColumns: ColumnDef<GroupedStoreOutStatusData>[] = [
        {
            id: 'actions',
            header: 'View',
            cell: ({ row }) => (
                <Button size="sm" variant="outline" onClick={() => setSelectedHistory(row.original)}>
                    View ({row.original.items.length})
                </Button>
            ),
        },
        { accessorKey: 'issueNo', header: 'Issue No.' },
        { accessorKey: 'indenterName', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        {
            header: 'Products',
            cell: ({ row }) => (
                <div className="max-w-[200px] break-words text-xs">
                    {row.original.items.map(i => i.product).join(', ')}
                </div>
            )
        },
        {
            header: 'Slip',
            cell: ({ row }) => row.original.slip ? (
                <a href={row.original.slip} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
                    <FileText size={14} /> View Slip
                </a>
            ) : <span className="text-muted-foreground text-xs">No Slip</span>
        }
    ];

    return (
        <div className="w-full overflow-hidden">
            <Heading heading="Store Out" subtext="Finalize store out and update database inventory">
                <PackageSearch size={50} className="text-primary" />
            </Heading>

            <Dialog open={!!(selectedGroup || selectedHistory)} onOpenChange={(open) => {
                if (!open) {
                    setSelectedGroup(null);
                    setSelectedHistory(null);
                }
            }}>
                <div className="p-5">
                    <Tabs defaultValue="pending" className="w-full">
                        <TabsList className="mb-4">
                            <TabsTrigger value="pending">Pending ({pendingData.length})</TabsTrigger>
                            <TabsTrigger value="history">History ({historyData.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending">
                            <DataTable data={pendingData} columns={pendingColumns} searchFields={['issueNo', 'indenterName']} dataLoading={storeOutLoading} />
                        </TabsContent>
                        <TabsContent value="history">
                            <DataTable data={historyData} columns={historyColumns} searchFields={['issueNo', 'indenterName']} dataLoading={storeOutLoading} />
                        </TabsContent>
                    </Tabs>
                </div>

                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {selectedGroup && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Confirm Store Out - {selectedGroup.issueNo}</DialogTitle>
                                <DialogDescription>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
                                        <span className="font-semibold">{selectedGroup.indenterName}</span>
                                        <span>| Ward: {selectedGroup.wardName}</span>
                                        {selectedGroup.slip && (
                                            <>
                                                | Slip: <a href={selectedGroup.slip} target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">View</a>
                                            </>
                                        )}
                                    </div>
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                                <StoreOutStatusForm
                                    items={selectedGroup.items}
                                    onSuccess={() => {
                                        setSelectedGroup(null);
                                        setTimeout(() => updateStoreOutData(), 1000);
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {selectedHistory && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Store Out History - {selectedHistory.issueNo}</DialogTitle>
                                <DialogDescription>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
                                        <span className="font-semibold">{selectedHistory.indenterName}</span>
                                        <span>| Ward: {selectedHistory.wardName}</span>
                                    </div>
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <table className="w-full text-sm">
                                    <thead className="bg-primary">
                                        <tr className="border-b text-primary-foreground font-bold text-left">
                                            <th className="py-2 px-2">Product</th>
                                            <th className="py-2 px-2">Qty</th>
                                            <th className="py-2 px-2">Status</th>
                                            <th className="py-2 px-2">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedHistory.items.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0 border-muted/20">
                                                <td className="py-2 px-2">{item.product}</td>
                                                <td className="py-2 px-2">{item.qty} {item.unit}</td>
                                                <td className="py-2 px-2"><Pill variant="secondary">{item.storeOutStatus}</Pill></td>
                                                <td className="py-2 px-2">{item.storeOutActual || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const StoreOutStatusForm = ({ items, onSuccess }: { items: StoreOutTableData[], onSuccess: () => void }) => {
    const schema = z.object({
        updates: z.array(z.object({
            status: z.string().nonempty('Status is required'),
            id: z.any()
        }))
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            updates: items.map(item => ({
                status: '',
                id: item.id
            }))
        }
    });

    const handleCommonStatusChange = (status: string) => {
        items.forEach((_, index) => {
            form.setValue(`updates.${index}.status`, status);
        });
    };

    const onSubmit = async (values: z.infer<typeof schema>) => {
        try {
            const updatePayload = values.updates.map(update => ({
                id: update.id,
                status: update.status,
                timestamp: new Date().toISOString()
            }));

            // 1. Update store_out_approval table
            await postToDB(updatePayload, 'update', 'STORE OUT APPROVAL');

            // 2. Insert into final store_out log table
            const insertPayload = values.updates.map(update => {
                const originalItem = items.find(i => i.id === update.id)!;
                return {
                    indentNumber: originalItem.originalRow.indentNumber,
                    status: update.status,
                    planned9: new Date().toISOString().split('T')[0], // planned_9 in SQL
                    timestamp: new Date().toISOString(),
                    delay: 0
                };
            });
            await postToDB(insertPayload, 'insert', 'STORE OUT');

            toast.success(`Confirmed ${items.length} items and saved to store out log`);
            onSuccess();
        } catch (e) {
            console.error('Store Out Submit Error:', e);
            toast.error('Failed to update');
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {items.map((item, index) => (
                        <div key={item.id} className="border p-4 rounded-md bg-muted/20 space-y-3">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-semibold text-sm">{item.product}</span>
                                <span className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded">
                                    Approved Qty: {item.qty} {item.unit}
                                </span>
                            </div>

                            <FormField
                                control={form.control}
                                name={`updates.${index}.status`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Final Status</FormLabel>
                                        <Select
                                            onValueChange={(val) => {
                                                field.onChange(val);
                                                handleCommonStatusChange(val);
                                            }}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Approved">Approved</SelectItem>
                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                        </div>
                    ))}
                </div>
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                    {form.formState.isSubmitting ? <Loader size={16} color="white" /> : `Confirm ${items.length} Items`}
                </Button>
            </form>
        </Form>
    );
};

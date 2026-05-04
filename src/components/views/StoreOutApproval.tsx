import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useSheets } from '@/context/SheetsContext';
import { Button } from '../ui/button';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { postToSheet, uploadFileToSupabase } from '@/lib/fetchers';
import { generateStoreOutSlip } from '@/lib/pdfGenerator';
import { PackageCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Pill } from '../ui/pill';
import { DownloadOutlined } from "@ant-design/icons";
import * as XLSX from 'xlsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface StoreOutTableData {
    issueNo: string;
    issueDate: string;
    requestedBy: string;
    department: string;
    product: string;
    groupHead: string;
    qty: number;
    unit: string;
    status: string;
    planned: string;
    actual: string;
    approveQty: number;
    indenterName: string;
    indentType: string;
    wardName: string;
    searialNumber?: string | number;
    originalRow: any;
}

interface GroupedStoreOutData {
    issueNo: string;
    issueDate: string;
    requestedBy: string;
    department: string;
    wardName: string;
    items: StoreOutTableData[];
}

export default () => {
    const { storeOutApprovalSheet, storeOutSheet, indentSheet, poHistorySheet, indentLoading, updateStoreOutApprovalSheet, storeOutApprovalLoading, storeOutLoading } = useSheets();
    const { user } = useAuth();
    const [selectedGroup, setSelectedGroup] = useState<GroupedStoreOutData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<GroupedStoreOutData | null>(null);
    const [tableData, setTableData] = useState<GroupedStoreOutData[]>([]);
    const [historyData, setHistoryData] = useState<GroupedStoreOutData[]>([]);
    const [loading, setLoading] = useState(false);

    const mapRowToTableData = (row: any): StoreOutTableData => {
        // Smarter lookup for missing data from indentSheet
        // Prioritize indentNumber as the link, then issueNo
        const lookupId = (row.indentNumber || row.issueNo || '').split(/[_/]/)[0].toLowerCase();

        const indentDetail = indentSheet?.find(i => {
            if (row.searialNumber && i.searialNumber) {
                return String(i.searialNumber) === String(row.searialNumber);
            }
            const itemBaseId = (i.indentNumber || '').split(/[_/]/)[0].toLowerCase();
            return lookupId === itemBaseId;
        });

        return {
            issueNo: row.issueNo || row.indentNumber || 'N/A',
            issueDate: row.issueDate || formatDate(new Date(row.timestamp)),
            requestedBy: row.requestedBy || indentDetail?.indenterName || row.indenterName || 'N/A',
            department: row.department || row.dept || indentDetail?.department || 'N/A',
            product: row.productName || row.product || row.itemName || row.item || row.category || indentDetail?.productName || 'N/A',
            groupHead: row.category || indentDetail?.groupHead || '',
            qty: Number(row.qty || row.approveQty || 0),
            unit: row.unit || indentDetail?.uom || '',
            status: row.status || '',
            planned: row.planned7 || row.planned8 || '',
            actual: '',
            approveQty: Number(row.qty || row.approveQty || 0),
            indenterName: row.indenterName || indentDetail?.indenterName || '',
            indentType: row.indentType || indentDetail?.indentType || '',
            wardName: row.wardName || indentDetail?.wardName || '',
            searialNumber: row.searialNumber,
            originalRow: row
        };
    };

    useEffect(() => {
        if (!storeOutApprovalSheet) return;

        const allItems = storeOutApprovalSheet.map(mapRowToTableData);
        const pendingItems = allItems.filter((row) => row.status?.toLowerCase() === 'pending');
        const historyItems = allItems.filter((row) => row.status?.toLowerCase() === 'approved' || row.status?.toLowerCase() === 'rejected');

        const groupItems = (items: StoreOutTableData[]) => {
            return items.reduce((acc, item) => {
                const baseId = item.issueNo.split(/[_/]/)[0];
                if (!acc[baseId]) {
                    acc[baseId] = {
                        issueNo: baseId,
                        issueDate: item.issueDate,
                        requestedBy: item.requestedBy,
                        department: item.department,
                        wardName: item.wardName,
                        items: [],
                    };
                }
                acc[baseId].items.push(item);
                return acc;
            }, {} as Record<string, GroupedStoreOutData>);
        };

        setTableData(Object.values(groupItems(pendingItems)).reverse());
        setHistoryData(Object.values(groupItems(historyItems)).reverse());
    }, [storeOutApprovalSheet]);

    const onDownloadClick = async () => {
        setLoading(true);
        try {
            const workbook = XLSX.utils.book_new();
            const flatData = tableData.flatMap(group => group.items.map(item => ({
                'Issue No.': item.issueNo,
                'Requested By': item.requestedBy,
                'Department': item.department,
                'Item': item.product,
                'Date': item.issueDate,
                'Quantity': item.qty,
                'Unit': item.unit,
                'Ward': item.wardName,
                'S.No': item.searialNumber
            })));
            const worksheet = XLSX.utils.json_to_sheet(flatData);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Store Out Pending');
            XLSX.writeFile(workbook, `Store_Out_Pending_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success('Excel file downloaded successfully!');
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download Excel file');
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnDef<GroupedStoreOutData>[] = [
        {
            id: 'actions',
            header: 'Action',
            cell: ({ row }) => (
                <Button size="sm" variant="outline" onClick={() => setSelectedGroup(row.original)}>
                    Action ({row.original.items.length})
                </Button>
            )
        },
        { accessorKey: 'issueNo', header: 'Issue No.' },
        { accessorKey: 'issueDate', header: 'Date' },
        { accessorKey: 'requestedBy', header: 'Requested By' },
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
    ];

    const historyColumns: ColumnDef<GroupedStoreOutData>[] = [
        {
            id: 'actions',
            header: 'Action',
            cell: ({ row }) => (
                <Button size="sm" variant="outline" onClick={() => setSelectedHistory(row.original)}>
                    View ({row.original.items.length})
                </Button>
            )
        },
        { accessorKey: 'issueNo', header: 'Issue No.' },
        { accessorKey: 'issueDate', header: 'Date' },
        { accessorKey: 'requestedBy', header: 'Requested By' },
        { accessorKey: 'department', header: 'Department' },
        {
            header: 'Products',
            cell: ({ row }) => (
                <div className="max-w-[200px] break-words text-xs">
                    {row.original.items.map(i => i.product).join(', ')}
                </div>
            )
        },
    ];

    return (
        <div className="flex flex-col gap-5 h-full w-full max-w-full overflow-hidden">
            <Tabs defaultValue="pending" className="w-full flex-1 flex flex-col min-h-0">
                <Heading heading="Store Out Approval" subtext="Approve store out requests" tabs>
                    <PackageCheck size={50} className="text-primary" />
                </Heading>
                <TabsContent value="pending" className="flex-1 min-w-0 w-full overflow-hidden">
                    <DataTable
                        data={tableData}
                        columns={columns}
                        searchFields={['issueNo', 'department', 'requestedBy']}
                        dataLoading={storeOutApprovalLoading}
                        tableClassName="min-w-[1600px]"
                        extraActions={
                            <Button
                                variant="default"
                                onClick={onDownloadClick}
                                style={{
                                    background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "0 16px",
                                    fontWeight: "bold",
                                    boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                            >
                                <DownloadOutlined />
                                {loading ? "Downloading..." : "Download"}
                            </Button>
                        }
                    />
                </TabsContent>
                <TabsContent value="history" className="flex-1 min-w-0 w-full overflow-hidden">
                    <DataTable
                        data={historyData}
                        columns={historyColumns}
                        searchFields={['issueNo', 'department', 'requestedBy']}
                        dataLoading={indentLoading}
                        tableClassName="min-w-[1600px]"
                    />
                </TabsContent>
            </Tabs>

            <Dialog open={!!(selectedGroup || selectedHistory)} onOpenChange={(open) => {
                if (!open) {
                    setSelectedGroup(null);
                    setSelectedHistory(null);
                }
            }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {selectedGroup && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Approve Requests - {selectedGroup.issueNo}</DialogTitle>
                                <DialogDescription>
                                    {selectedGroup.requestedBy} | {selectedGroup.department} | {selectedGroup.wardName}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                                <StoreOutApprovalForm
                                    items={selectedGroup.items}
                                    onSuccess={() => {
                                        setSelectedGroup(null);
                                        setTimeout(() => updateStoreOutApprovalSheet(), 1000);
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {selectedHistory && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Approval History - {selectedHistory.issueNo}</DialogTitle>
                                <DialogDescription>{selectedHistory.requestedBy} | {selectedHistory.department}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <table className="w-full text-sm">
                                    <thead className="bg-primary">
                                        <tr className="border-b text-primary-foreground font-bold text-left">
                                            <th className="py-2">Product</th>
                                            <th className="py-2">Req Qty</th>
                                            <th className="py-2">Appr Qty</th>
                                            <th className="py-2">Status</th>
                                            <th className="py-2">S.No</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedHistory.items.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0 border-muted/20">
                                                <td className="py-2">{item.product}</td>
                                                <td className="py-2">{item.qty} {item.unit}</td>
                                                <td className="py-2">{item.approveQty} {item.unit}</td>
                                                <td className="py-2">
                                                    <Pill variant={item.status === 'Rejected' ? 'reject' : 'secondary'}>{item.status}</Pill>
                                                </td>
                                                <td className="py-2">{item.searialNumber || '-'}</td>
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

const StoreOutApprovalForm = ({ items, onSuccess }: { items: StoreOutTableData[], onSuccess: () => void }) => {
    const { storeOutSheet } = useSheets();
    const { user } = useAuth();
    const schema = z.object({
        approvals: z.array(z.object({
            searialNumber: z.union([z.string(), z.number()]),
            status: z.string().nonempty('Status is required'),
            approveQty: z.coerce.number().min(0, 'Quantity cannot be negative'),
            product: z.string(),
            originalRow: z.any()
        }))
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            approvals: items.map(item => ({
                searialNumber: item.searialNumber || '',
                status: '',
                approveQty: item.qty,
                product: item.product,
                originalRow: item.originalRow
            }))
        }
    });

    const onSubmit = async (values: z.infer<typeof schema>) => {
        try {
            // 0. Generate Store Out Slip PDF
            const firstItem = items[0];
            const pdfBlob = await generateStoreOutSlip({
                issueNo: firstItem.issueNo,
                date: formatDate(new Date()),
                areaOfUse: firstItem.originalRow.areaOfUse || 'N/A',
                indenterName: firstItem.indenterName,
                department: firstItem.department,
                wardName: firstItem.wardName,
                category: firstItem.groupHead,
                items: values.approvals.map(appr => ({
                    searialNumber: appr.searialNumber,
                    productName: appr.product,
                    quantity: appr.approveQty,
                    unit: appr.originalRow.uom || appr.originalRow.unit
                })),
                preparedBy: 'Nikhil Kumar Urnaw',
                approvedBy: 'Store Incharge'
            });

            // Upload PDF to Supabase 'slip' bucket
            const fileName = `Slip_${firstItem.issueNo}_${Date.now()}.pdf`;
            const slipUrl = await uploadFileToSupabase(pdfBlob, 'slip', fileName);

            // 1. Update the status in store_out_request table (which maps to STORE_OUT_REQUEST)
            const updatePayload = values.approvals.map(appr => ({
                id: appr.originalRow.id,
                status: appr.status,
                qty: appr.approveQty,
            }));

            await postToSheet(updatePayload, 'update', 'STORE_OUT_REQUEST');

            // 2. Insert into store_out_approval table for the final Store Out step
            // Only insert if the status was Approved
            const approvedItems = values.approvals.filter(a => a.status === 'Approved');
            if (approvedItems.length > 0) {
                const insertPayload = approvedItems.map(appr => ({
                    indentNumber: appr.originalRow.indentNumber || appr.originalRow.issueNo,
                    approveQty: appr.approveQty,
                    slip: slipUrl,
                    planned8: new Date().toISOString().split('T')[0], // Planned date for final store out
                    status: 'Pending', // Status is Pending for the next stage
                    timestamp: new Date().toISOString(),
                    delay: 0
                }));
                await postToSheet(insertPayload, 'insert', 'STORE_OUT_APPROVAL');
            }

            toast.success(`Approved ${items.length} items and generated slip`);
            onSuccess();
        } catch (error) {
            console.error('Approval error:', error);
            toast.error('Failed to update approval');
        }
    };

    const handleCommonStatusChange = (status: string) => {
        items.forEach((_, index) => {
            form.setValue(`approvals.${index}.status`, status);
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {items.map((item, index) => (
                        <div key={item.searialNumber || index} className="border p-4 rounded-md bg-muted/20 space-y-3">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-semibold text-sm">{item.product}</span>
                                <span className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded">S.No: {item.searialNumber} | Req Qty: {item.qty} {item.unit}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name={`approvals.${index}.status`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Status (Applying to all will sync)</FormLabel>
                                            <Select
                                                onValueChange={(val) => {
                                                    field.onChange(val);
                                                    handleCommonStatusChange(val);
                                                }}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Status" />
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
                                <FormField
                                    control={form.control}
                                    name={`approvals.${index}.approveQty`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Approve Qty</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="h-8" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                    {form.formState.isSubmitting ? <Loader size={16} color="white" /> : `Approve ${items.length} Items`}
                </Button>
            </form>
        </Form>
    );
};

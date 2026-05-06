import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DownloadOutlined } from "@ant-design/icons";
import * as XLSX from 'xlsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { postToSheet, uploadFile, uploadFileToSupabase } from '@/lib/fetchers';
import type { ReceivedSheet } from '@/types';
import { Truck, Eye } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Pill } from '../ui/pill';

interface RecieveItemsData {
    poDate: string;
    poNumber: string;
    vendor: string;
    indentNumber: string;
    product: string;
    uom: string;
    quantity: number;
    poCopy: string;
    searialNumber?: string | number;
    indentNumbers?: string[];
    products?: string[];
    _count?: number;
}

interface HistoryData {
    receiveStatus: string;
    poNumber: string;
    poDate: string;
    vendor: string;
    product: string;
    orderQuantity: number;
    uom: string;
    receivedDate: string;
    receivedQuantity: number;
    photoOfProduct: string;
    warrantyStatus: string;
    warrantyEndDate: string;
    billStatus: string;
    billNumber: string;
    billAmount: number;
    photoOfBill: string;
    anyTransport: string;
    transporterName: string;
    transportingAmount: number;
    indentNumbers?: string[];
    products?: string[];
    _count?: number;
    poCopy?: string;
    indentNumber?: string;
    timestamp?: string;
}

export default () => {
    const { indentSheet, receivedSheet, poApprovalSheet, poHistorySheet, updateAll, indentLoading, receivedLoading, poApprovalLoading } = useSheets();
    const { user } = useAuth();

    const [tableData, setTableData] = useState<RecieveItemsData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryData | null>(null);
    const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
    const [matchingHistoryItems, setMatchingHistoryItems] = useState<any[]>([]);

    useEffect(() => {
        if (selectedHistoryItem && openHistoryDialog) {
            // Find all receives for this PO
            const items = receivedSheet.filter(r => r.poNumber === selectedHistoryItem.poNumber).map(r => {
                const indent = indentSheet.find((i) =>
                    r.searialNumber ? String(i.searialNumber) === String(r.searialNumber) : i.indentNumber === r.indentNumber
                );
                return {
                    ...r,
                    product: indent?.productName || '',
                    uom: indent?.uom || ''
                };
            });
            setMatchingHistoryItems(items);
        }
    }, [selectedHistoryItem, openHistoryDialog, receivedSheet, indentSheet]);

    const [selectedIndent, setSelectedIndent] = useState<RecieveItemsData | null>(null);
    const [matchingIndents, setMatchingIndents] = useState<RecieveItemsData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Show items from PO APPROVAL table where status is 'Pending'
        const filteredIndents = poApprovalSheet.filter(
            (i) => i.status === 'Pending'
        );

        const grouped = filteredIndents.reduce((acc: { [key: string]: RecieveItemsData }, i) => {
            const indentDetail = indentSheet.find(indent => indent.indentNumber === i.indentNumber);
            const poHistoryDetail = poHistorySheet.find(history => history.indentNumber === i.indentNumber);
            
            const poNumber = poHistoryDetail?.poNumber || 'N/A';
            const qty = indentDetail?.qty || indentDetail?.approvedQuantity || indentDetail?.quantity || 0;
            const product = indentDetail?.productName || '';

            if (!acc[poNumber]) {
                acc[poNumber] = {
                    indentNumber: i.indentNumber,
                    indentNumbers: [i.indentNumber],
                    poNumber: poNumber,
                    uom: indentDetail?.uom || '',
                    poCopy: poHistoryDetail?.pdf || '',
                    vendor: poHistoryDetail?.partyName || '',
                    quantity: qty,
                    poDate: poHistoryDetail?.timestamp || '',
                    product: product,
                    products: [product],
                    searialNumber: indentDetail?.searialNumber,
                    _count: 1
                };
            } else {
                acc[poNumber].quantity += qty;
                if (!acc[poNumber].indentNumbers?.includes(i.indentNumber)) {
                    acc[poNumber].indentNumbers?.push(i.indentNumber);
                }
                if (!acc[poNumber].products?.includes(product)) {
                    acc[poNumber].products?.push(product);
                }
                acc[poNumber]._count = (acc[poNumber]._count || 0) + 1;
            }
            return acc;
        }, {});

        const finalData = Object.values(grouped).sort((a, b) => {
            const dateA = a.poDate ? new Date(a.poDate).getTime() : 0;
            const dateB = b.poDate ? new Date(b.poDate).getTime() : 0;
            return dateB - dateA;
        });
        console.log('ReceiveItems Grouped Table Data:', finalData);
        setTableData(finalData);
    }, [poApprovalSheet, indentSheet, poHistorySheet]);

    useEffect(() => {
        if (!receivedSheet) return;

        const grouped = receivedSheet.reduce((acc: { [key: string]: HistoryData }, r) => {
            const poNumber = r.poNumber || 'N/A';
            const indent = indentSheet.find((i) =>
                r.searialNumber ? String(i.searialNumber) === String(r.searialNumber) : i.indentNumber === r.indentNumber
            );
            
            const indentNo = r.indentNumber || '';
            const product = indent?.productName || '';
            const orderQty = indent?.qty || indent?.approvedQuantity || 0;
            const recQty = r.receivedQuantity || 0;
            const billAmt = r.billAmount || 0;
            const transAmt = r.transportingAmount || 0;

            if (!acc[poNumber]) {
                acc[poNumber] = {
                    receiveStatus: r.receivedStatus,
                    poNumber: poNumber,
                    poDate: formatDate(new Date(r.poDate)),
                    vendor: indent?.approvedVendorName || '',
                    product: product,
                    products: [product],
                    orderQuantity: orderQty,
                    uom: indent?.uom || '',
                    photoOfProduct: r.photoOfProduct,
                    receivedDate: formatDate(new Date(r.timestamp)),
                    receivedQuantity: recQty,
                    warrantyStatus: r.warrantyStatus,
                    warrantyEndDate: r.endDate ? formatDate(new Date(r.endDate)) : '',
                    billStatus: r.billStatus,
                    billNumber: r.billNumber,
                    billAmount: billAmt,
                    photoOfBill: r.photoOfBill,
                    anyTransport: r.anyTransportations,
                    transporterName: r.transporterName,
                    transportingAmount: transAmt,
                    indentNumber: indentNo,
                    indentNumbers: [indentNo],
                    poCopy: indent?.poCopy || '',
                    _count: 1,
                    timestamp: r.timestamp,
                };
            } else {
                acc[poNumber].orderQuantity += orderQty;
                acc[poNumber].receivedQuantity += recQty;
                acc[poNumber].billAmount += billAmt;
                acc[poNumber].transportingAmount += transAmt;
                
                if (!acc[poNumber].indentNumbers?.includes(indentNo)) {
                    acc[poNumber].indentNumbers?.push(indentNo);
                }
                if (!acc[poNumber].products?.includes(product)) {
                    acc[poNumber].products?.push(product);
                }
                acc[poNumber]._count = (acc[poNumber]._count || 0) + 1;

                // Update to latest timestamp in group
                if (r.timestamp && (!acc[poNumber].timestamp || new Date(r.timestamp) > new Date(acc[poNumber].timestamp!))) {
                    acc[poNumber].timestamp = r.timestamp;
                }
            }
            return acc;
        }, {} as Record<string, HistoryData & { timestamp?: string }>);

        setHistoryData(
            Object.values(grouped).sort((a, b) => {
                const dateA = (a as any).timestamp ? new Date((a as any).timestamp).getTime() : 0;
                const dateB = (b as any).timestamp ? new Date((b as any).timestamp).getTime() : 0;
                return dateB - dateA;
            })
        );
    }, [receivedSheet, indentSheet]);

    const handleDownload = (data: any[]) => {
        if (!data || data.length === 0) {
            toast.error("No data to download");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Receive Items");
        XLSX.writeFile(workbook, `receive-items-${Date.now()}.xlsx`);
    };

    const onDownloadClick = async () => {
        setLoading(true);
        try {
            await handleDownload(tableData);
            toast.success("File downloaded successfully");
        } catch (error) {
            toast.error("Failed to download file");
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnDef<RecieveItemsData>[] = [
        ...(user.receive_items
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<RecieveItemsData> }) => {
                        const indent = row.original;

                        return (
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedIndent(indent);
                                    }}
                                >
                                    Store In {indent._count && indent._count > 1 ? `(${indent._count})` : ''}
                                </Button>
                            </DialogTrigger>
                        );
                    },
                },
            ]
            : []),
        {
            accessorKey: 'poDate',
            header: 'PO Date',
            accessorFn: (x) => formatDate(new Date(x.poDate)),
        },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'vendor', header: 'Vendor' },
        {
            accessorKey: 'indentNumber',
            header: 'Indent No.',
            cell: ({ row }) => {
                const count = row.original._count || 1;
                const baseId = (row.original.indentNumber || '').split(/[_/]/)[0];
                return count > 1 ? (
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold border border-primary/20">
                        {baseId} ({count})
                    </span>
                ) : (
                    baseId
                );
            }
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }) => {
                const count = row.original._count || 1;
                return count > 1 ? (
                    <span className="text-muted-foreground italic text-xs">
                        Multiple Products
                    </span>
                ) : (
                    row.original.product
                );
            }
        },
        { accessorKey: 'uom', header: 'UOM' },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ row }) => {
                const count = row.original._count || 1;
                return (
                    <div className="text-center">
                        <div className="font-bold">{row.original.quantity}</div>
                        {count > 1 && (
                            <div className="text-[10px] text-muted-foreground">({count} Items)</div>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'poCopy',
            header: 'PO Copy',
            cell: ({ row }) => {
                const poCopy = row.original.poCopy;
                return poCopy ? (
                    <a href={poCopy} target="_blank">
                        PDF
                    </a>
                ) : (
                    <></>
                );
            },
        },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        {
            id: 'actions',
            header: 'Action',
            cell: ({ row }) => (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                        setSelectedHistoryItem(row.original);
                        setOpenHistoryDialog(true);
                    }}
                >
                    <Eye size={16} />
                </Button>
            ),
        },
        { accessorKey: 'poDate', header: 'PO Date' },
        { accessorKey: 'poNumber', header: 'PO Number' },
        {
            accessorKey: 'receiveStatus',
            header: 'Receive Status',
            cell: ({ row }) => {
                const status = row.original.receiveStatus;
                const variant = status === 'Received' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        { accessorKey: 'vendor', header: 'Vendor' },
        {
            accessorKey: 'indentNumber',
            header: 'Indent No.',
            cell: ({ row }) => {
                const count = row.original._count || 1;
                const baseId = (row.original.indentNumber || '').split(/[_/]/)[0];
                return count > 1 ? (
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold border border-primary/20">
                        {baseId} ({count})
                    </span>
                ) : (
                    baseId
                );
            }
        },
        { 
            accessorKey: 'product', 
            header: 'Product',
            cell: ({ row }) => {
                const count = row.original._count || 1;
                return count > 1 ? (
                    <span className="text-muted-foreground italic text-xs">
                        Multiple Products
                    </span>
                ) : (
                    <div className="max-w-[200px] truncate" title={row.original.product}>
                        {row.original.product}
                    </div>
                );
            }
        },
        { accessorKey: 'uom', header: 'UOM' },
        { accessorKey: 'receivedDate', header: 'Received Date' },
        { 
            accessorKey: 'receivedQuantity', 
            header: 'Rec Qty',
            cell: ({ row }) => {
                const count = row.original._count || 1;
                return (
                    <div className="text-center">
                        <div className="font-bold text-primary">{row.original.receivedQuantity}</div>
                        {count > 1 && (
                            <div className="text-[10px] text-muted-foreground">({count} Items)</div>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'photoOfProduct',
            header: 'Photo of Product',
            cell: ({ row }) => {
                const photo = row.original.photoOfProduct;
                return photo ? (
                    <a href={photo} target="_blank">
                        Product
                    </a>
                ) : (
                    <></>
                );
            },
        },
        { accessorKey: 'warrantyStatus', header: 'Warranty Status' },
        { accessorKey: 'warrantyEndDate', header: 'Warranty End Date' },
        { accessorKey: 'billStatus', header: 'Bill Status' },
        { accessorKey: 'billNumber', header: 'Bill Number' },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        {
            accessorKey: 'photoOfBill',
            header: 'Photo of Bill',
            cell: ({ row }) => {
                const photo = row.original.photoOfBill;
                return photo ? (
                    <a href={photo} target="_blank">
                        Bill
                    </a>
                ) : (
                    <></>
                );
            },
        },
        { accessorKey: 'anyTransport', header: 'Any Transport' },
        { accessorKey: 'transporterName', header: 'Transporter Name' },
        { accessorKey: 'transportingAmount', header: 'Transporting Amount' },
    ];

    // Updated Schema - status ko top level pe add kiya
    const schema = z
        .object({
            status: z.enum(['Received', 'Not Received']),
            items: z.array(
                z.object({
                    indentNumber: z.string(),
                    quantity: z.coerce.number().optional().default(0),
                    searialNumber: z.union([z.string(), z.number()]).optional(),
                })
            ),
            billReceived: z.enum(['Received', 'Not Received']).optional(),
            billAmount: z.coerce.number().optional(),
            photoOfBill: z.instanceof(File).optional(),
        })
        .superRefine((data, ctx) => {
            if (data.status === 'Received') {
                data.items.forEach((item, index) => {
                    if (item.quantity === undefined || item.quantity === 0) {
                        ctx.addIssue({
                            path: ['items', index, 'quantity'],
                            code: z.ZodIssueCode.custom,
                            message: 'Quantity required',
                        });
                    }
                });
            }

            if (data.billReceived === 'Received') {
                if (data.billAmount === undefined) {
                    ctx.addIssue({ path: ['billAmount'], code: z.ZodIssueCode.custom });
                }
            }
        });

    // Updated Form
    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            status: undefined,
            items: [],
            billAmount: undefined,
            photoOfBill: undefined,
            billReceived: undefined,
        },
    });

    const status = form.watch('status');
    const billReceived = form.watch('billReceived');

    // Updated useEffect for matching indents
    useEffect(() => {
        if (selectedIndent) {
            // Filter from poApprovalSheet to get items in this PO
            const matching: any[] = poApprovalSheet
                .filter(
                    (i) => {
                        const history = poHistorySheet.find(h => h.indentNumber === i.indentNumber);
                        return history?.poNumber === selectedIndent.poNumber && i.status === 'Pending';
                    }
                )
                .map((i) => {
                    const indent = indentSheet.find(indent => indent.indentNumber === i.indentNumber);
                    const history = poHistorySheet.find(h => h.indentNumber === i.indentNumber);
                    
                    const orderedQty = indent?.qty || indent?.approvedQuantity || indent?.quantity || 0;
                    const alreadyReceived = receivedSheet
                        .filter(r => r.indentNumber === i.indentNumber)
                        .reduce((sum, r) => sum + (Number(r.receivedQuantity) || 0), 0);

                    return {
                        indentNumber: i.indentNumber,
                        poNumber: history?.poNumber || '',
                        uom: indent?.uom || '',
                        poCopy: history?.pdf || '',
                        vendor: history?.partyName || '',
                        quantity: orderedQty,
                        pendingQuantity: Math.max(0, orderedQty - alreadyReceived),
                        poDate: history?.timestamp || '',
                        product: indent?.productName || '',
                        searialNumber: indent?.searialNumber,
                    };
                });

            setMatchingIndents(matching);

            // Initialize items array in form with ORDERED quantity (as requested)
            const initialItems = matching.map((indent) => ({
                indentNumber: indent.indentNumber,
                quantity: indent.quantity,
                searialNumber: indent.searialNumber,
            }));
            form.setValue('items', initialItems as any);
        } else if (!openDialog) {
            setMatchingIndents([]);
            form.reset({
                status: undefined,
                items: [],
                billAmount: undefined,
                photoOfBill: undefined,
                billReceived: undefined,
            });
        }
    }, [selectedIndent, openDialog, tableData]);

    // Updated onSubmit
    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            // Photo of bill upload to Supabase
            let billPhotoUrl = '';
            if (values.photoOfBill !== undefined) {
                try {
                    billPhotoUrl = await uploadFileToSupabase(
                        values.photoOfBill,
                        'bill' // Supabase bucket name
                    );
                } catch (err) {
                    console.error('Error uploading bill photo to Supabase:', err);
                    throw new Error('Failed to upload bill photo');
                }
            }

            const rows: Partial<ReceivedSheet>[] = values.items.map((item) => {
                const match = (matchingIndents as any[]).find(i =>
                    i.searialNumber ? String(i.searialNumber) === String(item.searialNumber) : i.indentNumber === item.indentNumber
                );
                
                let pDate = selectedIndent?.poDate;
                if (!pDate || pDate === '' || pDate === 'N/A') {
                    pDate = null as any;
                }

                return {
                    timestamp: new Date().toISOString(),
                    indentNumber: item.indentNumber,
                    poDate: pDate,
                    poNumber: selectedIndent?.poNumber,
                    vendor: selectedIndent?.vendor,
                    receivedStatus: values.status,
                    receivedQuantity: item.quantity,
                    uom: match?.uom,
                    billStatus: values.billReceived,
                    billAmount: values.billAmount,
                    photoOfBill: billPhotoUrl,
                    searialNumber: item.searialNumber,
                    planned6: formatDate(new Date()),
                    status: 'Pending' 
                };
            });

            await postToSheet(rows, 'insert', 'RECEIVED');

            // Update each indent and PO APPROVAL status
            for (const item of values.items) {
                const match = (matchingIndents as any[]).find(i =>
                    i.searialNumber ? String(i.searialNumber) === String(item.searialNumber) : i.indentNumber === item.indentNumber
                );
                
                const indentToUpdate = indentSheet.find(
                    (s) => s.searialNumber ? String(s.searialNumber) === String(item.searialNumber) : s.indentNumber === item.indentNumber
                );

                if (indentToUpdate && match) {
                    const alreadyReceived = receivedSheet
                        .filter(r => r.indentNumber === item.indentNumber)
                        .reduce((sum, r) => sum + (Number(r.receivedQuantity) || 0), 0);
                    
                    const newTotalReceived = alreadyReceived + (Number(item.quantity) || 0);
                    const isFullyReceived = newTotalReceived >= match.quantity;

                    const updatePayload = {
                        rowIndex: (indentToUpdate as any).rowIndex,
                        indentNumber: indentToUpdate.indentNumber,
                        actual5: formatDate(new Date()),
                        receiveStatus: isFullyReceived ? 'Received' : 'Partially Received',
                    };
                    await postToSheet([updatePayload], 'update', 'INDENT');

                    // Update PO APPROVAL table status
                    const approvalToUpdate = poApprovalSheet.find(a => a.indentNumber === item.indentNumber);
                    if (approvalToUpdate) {
                        const approvalUpdate = {
                            id: approvalToUpdate.id,
                            status: isFullyReceived ? 'Received' : 'Pending'
                        };
                        await postToSheet([approvalUpdate], 'update', 'PO APPROVAL');
                    }
                }
            }

            toast.success(`Items received for PO ${selectedIndent?.poNumber}`);
            setOpenDialog(false);
            setTimeout(() => updateAll(), 1000);
        } catch (error) {
            console.error('Submission error in ReceiveItems:', error);
            toast.error('Failed to receive items. Check console for details.');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div className="flex flex-col gap-5 h-full w-full max-w-full overflow-hidden">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Receive Items"
                        subtext="Receive items from purchase orders"
                        tabs
                    >
                        <Truck size={50} className="text-primary" />
                    </Heading>

                <TabsContent value="pending" className="flex-1 min-h-0 w-full overflow-hidden">
                    <div className="w-full h-full overflow-x-auto overflow-y-hidden">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['product', 'poNumber', 'indentNumber', 'vendor']}
                            dataLoading={poApprovalLoading}
                            className="h-[74dvh]"
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
                    </div>
                </TabsContent>

                <TabsContent value="history" className="flex-1 min-h-0 w-full overflow-hidden">
                    <div className="w-full h-full overflow-x-auto overflow-y-hidden">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={[
                                'receiveStatus',
                                'poNumber',
                                'indentNumber',
                                'product',
                                'vendor'
                            ]}
                            dataLoading={receivedLoading}
                            className="h-[74dvh]"
                        />
                    </div>
                </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Receive Items</DialogTitle>
                                    <DialogDescription>
                                        Receive items for PO Number{' '}
                                        <span className="font-medium">
                                            {selectedIndent.poNumber}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>

                                {/* PO Number Display */}
                                <div className="bg-primary/10 p-3 rounded-md">
                                    <p className="text-lg font-bold">
                                        PO Number: {selectedIndent.poNumber}
                                    </p>
                                </div>

                                {/* Common Receive Status Field - TOP ME */}
                                <div className="border-b pb-4">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Receiving Status (Common for all items)</FormLabel>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Set status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Received">
                                                                Received
                                                            </SelectItem>
                                                            <SelectItem value="Not Received">
                                                                Not Received
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Common fields */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold">Common Fields for All Items</h3>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="billReceived"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Bill Received</FormLabel>
                                                    <FormControl>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Set bill received" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Received">
                                                                    Received
                                                                </SelectItem>
                                                                <SelectItem value="Not Received">
                                                                    Not Received
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="billAmount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Bill Amount</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            disabled={billReceived !== 'Received'}
                                                            placeholder="Enter bill amount"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="photoOfBill"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Photo of Bill</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="file"
                                                            disabled={billReceived !== 'Received'}
                                                            onChange={(e) =>
                                                                field.onChange(e.target.files?.[0])
                                                            }
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Table for matching indents - NICHE */}
                                <div className="border rounded-md overflow-x-auto mt-6">
                                    <h3 className="font-semibold p-3 bg-muted">Items in this PO</h3>
                                    <table className="w-full">
                                        <thead className="bg-muted">
                                            <tr>
                                                <th className="p-2 text-left text-sm font-medium text-foreground">Indent Number</th>
                                                <th className="p-2 text-left text-sm font-medium text-foreground">Item Name</th>
                                                <th className="p-2 text-left text-sm font-medium text-foreground">Ordered Qty</th>
                                                <th className="p-2 text-left text-sm font-medium text-foreground">UOM</th>
                                                <th className="p-2 text-left text-sm font-medium text-foreground">Received Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matchingIndents.map((indent, index) => (
                                                <tr key={indent.searialNumber ? String(indent.searialNumber) : indent.indentNumber} className="border-t">
                                                    <td className="p-2 text-sm">{indent.indentNumber}</td>
                                                    <td className="p-2 text-sm">{indent.product}</td>
                                                    <td className="p-2 text-sm">{indent.quantity}</td>
                                                    <td className="p-2 text-sm">{indent.uom}</td>
                                                    <td className="p-2">
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.quantity`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            className="h-8"
                                                                            placeholder="Qty"
                                                                            disabled={status !== 'Received'}
                                                                            {...field}
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button type="submit" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        Store In
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>

            <Dialog open={openHistoryDialog} onOpenChange={setOpenHistoryDialog}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Receive History: {selectedHistoryItem?.poNumber}</DialogTitle>
                        <DialogDescription>
                            Itemized breakdown of all received goods for this PO
                        </DialogDescription>
                    </DialogHeader>

                    {selectedHistoryItem && (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Vendor</p>
                                    <p className="font-medium">{selectedHistoryItem.vendor}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Received Date</p>
                                    <p className="font-medium">{selectedHistoryItem.receivedDate}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Transporter</p>
                                    <p className="font-medium">{selectedHistoryItem.transporterName || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Bill No.</p>
                                    <p className="font-medium">{selectedHistoryItem.billNumber || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted text-muted-foreground">
                                        <tr>
                                            <th className="p-3 font-medium">Indent No.</th>
                                            <th className="p-3 font-medium">Product</th>
                                            <th className="p-3 font-medium text-center">Rec Qty</th>
                                            <th className="p-3 font-medium text-center">Bill Amount</th>
                                            <th className="p-3 font-medium text-center">Warranty</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {matchingHistoryItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 font-mono text-xs">{item.indentNumber}</td>
                                                <td className="p-3">{item.product}</td>
                                                <td className="p-3 text-center font-medium">{item.receivedQuantity} {item.uom}</td>
                                                <td className="p-3 text-center">₹{item.billAmount || 0}</td>
                                                <td className="p-3 text-center">
                                                    <Pill variant={item.warrantyStatus === 'Yes' ? 'primary' : 'secondary'}>
                                                        {item.warrantyStatus || 'No'}
                                                    </Pill>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-muted/50 font-bold">
                                        <tr>
                                            <td colSpan={2} className="p-3 text-right">Total:</td>
                                            <td className="p-3 text-center text-primary">{selectedHistoryItem.receivedQuantity}</td>
                                            <td className="p-3 text-center text-primary">₹{selectedHistoryItem.billAmount}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="flex justify-end gap-3">
                                {selectedHistoryItem.poCopy && (
                                    <Button variant="outline" asChild>
                                        <a href={selectedHistoryItem.poCopy} target="_blank">View PO Copy</a>
                                    </Button>
                                )}
                                <Button onClick={() => setOpenHistoryDialog(false)}>Close</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

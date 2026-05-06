import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import type { ColumnDef } from '@tanstack/react-table';
import { useSheets } from '@/context/SheetsContext';
import { Button } from '../ui/button';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { postToSheet } from '@/lib/fetchers';
import { PackageCheck, Package2, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Pill } from '../ui/pill';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { pdf } from '@react-pdf/renderer';
import POPdf, { type POPdfProps } from '../element/POPdf';
import { calculateGrandTotal, calculateSubtotal, calculateTotal, calculateTotalGst } from '@/lib/utils';
import { uploadFileToSupabase } from '@/lib/fetchers';

interface PoTableData {
    partyName: string;
    poNumber: string;
    quotationNumber: string;
    quotationDate: string;
    enquiryNumber: string;
    enquiryDate: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gstPercent: number;
    discountPercent: number;
    amount: number;
    totalPoAmount: number;
    preparedBy: string;
    approvedBy: string;
    pdf: string;
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
    status: string;
    actual: string;
    indentBy: string;
    indentNumber: string;
    originalRow: any;
    timestamp: string;
    _count?: number;
}

export default () => {
    const { poHistorySheet, updatePoHistorySheet, poHistoryLoading, masterSheet: details } = useSheets();
    const [openDialog, setOpenDialog] = useState(false);
    const [tableData, setTableData] = useState<PoTableData[]>([]);
    const [historyData, setHistoryData] = useState<PoTableData[]>([]);
    const [selectedItem, setSelectedItem] = useState<PoTableData | null>(null);
    const [openViewDialog, setOpenViewDialog] = useState(false);
    const [matchingItems, setMatchingItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (selectedItem && openViewDialog) {
            const items = poHistorySheet.filter(row => row.poNumber === selectedItem.poNumber);
            setMatchingItems(items);
        }
    }, [selectedItem, openViewDialog, poHistorySheet]);

    const getV = (row: any, ...keys: string[]) => {
        if (!row || typeof row !== 'object') return '';
        const rowKeys = Object.keys(row);

        for (const key of keys) {
            // 1. Exact match
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];

            // 2. Normalized match (ignore spaces, underscores, case)
            const normalizedTarget = key.toLowerCase().replace(/[\s_%-]/g, '');
            const match = rowKeys.find(k => k.toLowerCase().replace(/[\s_%-]/g, '') === normalizedTarget);
            if (match && row[match] !== undefined && row[match] !== null && row[match] !== '') return row[match];
        }
        return '';
    };

    const mapRowToTableData = (row: any): PoTableData => ({
        indentNumber: String(getV(row, 'Indent Number', 'indentNumber', 'indentnumber') || ''),
        partyName: String(getV(row, 'Party Name', 'partyName', 'party') || ''),
        poNumber: String(getV(row, 'PO Number', 'poNumber', 'ponumber') || ''),
        quotationNumber: String(getV(row, 'Quotation Number', 'quotationNumber') || ''),
        quotationDate: getV(row, 'Quotation Date', 'quotationDate') ? formatDate(new Date(getV(row, 'Quotation Date', 'quotationDate'))) : '',
        enquiryNumber: String(getV(row, 'Enquiry Number', 'enquiryNumber') || ''),
        enquiryDate: getV(row, 'Enquiry Date', 'enquiryDate') ? formatDate(new Date(getV(row, 'Enquiry Date', 'enquiryDate'))) : '',
        internalCode: String(getV(row, 'Internal Code', 'internalCode') || ''),
        product: String(getV(row, 'Product', 'product', 'productname') || ''),
        description: String(getV(row, 'Description', 'description') || ''),
        quantity: Number(getV(row, 'Quantity', 'quantity') || 0),
        unit: String(getV(row, 'Unit', 'unit', 'uom') || ''),
        rate: Number(getV(row, 'Rate', 'rate') || 0),
        gstPercent: Number(getV(row, 'GST %', 'gstPercent', 'gst') || 0),
        discountPercent: Number(getV(row, 'Discount %', 'discountPercent', 'discount') || 0),
        amount: Number(getV(row, 'Amount', 'amount') || 0),
        totalPoAmount: Number(getV(row, 'Total PO Amount', 'totalPoAmount') || 0),
        preparedBy: String(getV(row, 'Prepared By', 'preparedBy') || ''),
        approvedBy: String(getV(row, 'Approved By', 'approvedBy') || ''),
        pdf: String(getV(row, 'PDF', 'pdf') || ''),
        term1: String(getV(row, 'Term 1', 'term1') || ''),
        term2: String(getV(row, 'Term 2', 'term2') || ''),
        term3: String(getV(row, 'Term 3', 'term3') || ''),
        term4: String(getV(row, 'Term 4', 'term4') || ''),
        term5: String(getV(row, 'Term 5', 'term5') || ''),
        term6: String(getV(row, 'Term 6', 'term6') || ''),
        term7: String(getV(row, 'Term 7', 'term7') || ''),
        term8: String(getV(row, 'Term 8', 'term8') || ''),
        term9: String(getV(row, 'Term 9', 'term9') || ''),
        term10: String(getV(row, 'Term 10', 'term10') || ''),
        status: String(getV(row, 'Status', 'status') || ''),
        actual: String(getV(row, 'Actual', 'actual') || ''),
        indentBy: String(getV(row, 'Indent By', 'indentBy') || ''),
        timestamp: String(getV(row, 'timestamp', 'Timestamp') || ''),
        originalRow: row
    });

    useEffect(() => {
        updatePoHistorySheet();
    }, []);

    useEffect(() => {
        if (!poHistorySheet) return;

        // Filter: Keep ANY row that has at least one value
        const validRows = poHistorySheet.filter(row => {
            return Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
        });

        // Map all valid rows first
        const allMapped = validRows.map(mapRowToTableData);

        // Pending: Status is 'Pending' or empty
        const pending = allMapped.filter(item => 
            !item.status || 
            item.status.trim().toLowerCase() === 'pending' ||
            (item.status.trim().toLowerCase() !== 'approved' && item.status.trim().toLowerCase() !== 'rejected')
        );

        // History: Status is 'Approved' or 'Rejected'
        const history = allMapped.filter(item => item.status && (item.status.trim().toLowerCase() === 'approved' || item.status.trim().toLowerCase() === 'rejected'));

        // Helper for grouping
        const groupItems = (items: PoTableData[]) => {
            const map = new Map<string, PoTableData>();
            items.forEach(item => {
                const poNum = item.poNumber || 'N/A';
                if (!map.has(poNum)) {
                    map.set(poNum, { ...item, _count: 1 });
                } else {
                    const existing = map.get(poNum)!;
                    existing._count = (existing._count || 1) + 1;
                    if (typeof existing.quantity === 'number' && typeof item.quantity === 'number') {
                        existing.quantity += item.quantity;
                    }
                    // Update to latest timestamp in group
                    if (item.timestamp && (!existing.timestamp || new Date(item.timestamp) > new Date(existing.timestamp))) {
                        existing.timestamp = item.timestamp;
                    }
                }
            });
            return Array.from(map.values()).sort((a, b) => {
                const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return dateB - dateA;
            });
        };

        setTableData(groupItems(pending));
        setHistoryData(groupItems(history));
    }, [poHistorySheet]);

    const columns: ColumnDef<PoTableData>[] = [
        {
            id: 'actions',
            header: 'Action',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                            setSelectedItem(row.original);
                            setOpenViewDialog(true);
                        }}
                    >
                        <Eye size={16} />
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => {
                            setSelectedItem(row.original);
                            setOpenDialog(true);
                        }}
                    >
                        Approve {row.original._count && row.original._count > 1 ? `(${row.original._count})` : ''}
                    </Button>
                </div>
            ),
        },
        {
            accessorKey: 'timestamp',
            id: 'timestamp',
            header: 'Date',
            cell: ({ row }) => {
                const d = new Date(row.original.timestamp);
                return (
                    <div className="flex flex-col items-center justify-center min-w-[100px] gap-0.5">
                        <span className="text-sm font-bold text-foreground tabular-nums tracking-tight">
                            {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                            {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                    </div>
                );
            },
            size: 110,
        },
        { 
            accessorKey: 'partyName', 
            id: 'partyName',
            header: 'Party Name',
            cell: ({ getValue }) => <div className="text-center">{getValue() as string}</div>
        },
        { 
            accessorKey: 'poNumber', 
            id: 'poNumber',
            header: 'PO Number',
            cell: ({ getValue }) => <div className="text-center font-medium">{getValue() as string}</div>
        },
        {
            accessorKey: 'indentNumber',
            id: 'indentNumber',
            header: 'Indent No.',
            cell: ({ row }) => {
                const count = row.original._count || 1;
                const baseId = (row.original.indentNumber || '').split(/[_/]/)[0];
                return (
                    <div className="text-center">
                        {count > 1 ? (
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold border border-primary/20">
                                {baseId} ({count})
                            </span>
                        ) : (
                            baseId
                        )}
                    </div>
                );
            }
        },
        { 
            accessorKey: 'product', 
            id: 'product',
            header: 'Product',
            cell: ({ row }) => {
                const count = row.original._count || 1;
                return (
                    <div className="text-center">
                        {count > 1 ? (
                            <span className="text-muted-foreground italic text-xs">
                                Multiple Products
                            </span>
                        ) : (
                            <div className="max-w-[200px] truncate mx-auto" title={row.original.product}>
                                {row.original.product}
                            </div>
                        )}
                    </div>
                );
            }
        },
        { 
            accessorKey: 'description', 
            id: 'description',
            header: 'Description',
            cell: ({ getValue }) => <div className="text-center text-xs">{getValue() as string || '-'}</div>
        },
        { 
            accessorKey: 'quantity', 
            id: 'quantity',
            header: 'Qty',
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
            accessorKey: 'unit', 
            id: 'unit',
            header: 'Unit',
            cell: ({ getValue }) => <div className="text-center">{getValue() as string}</div>
        },
        { 
            accessorKey: 'rate', 
            id: 'rate',
            header: 'Rate',
            cell: ({ getValue }) => <div className="text-center font-medium">₹{getValue() as number}</div>
        },
        { 
            accessorKey: 'gstPercent', 
            id: 'gstPercent',
            header: 'GST %',
            cell: ({ getValue }) => <div className="text-center">{getValue() as number}%</div>
        },
        { 
            accessorKey: 'discountPercent', 
            id: 'discountPercent',
            header: 'Discount %',
            cell: ({ getValue }) => <div className="text-center">{getValue() as number}%</div>
        },
        { 
            accessorKey: 'amount', 
            id: 'amount',
            header: 'Amount',
            cell: ({ getValue }) => <div className="text-center font-bold">₹{getValue() as number}</div>
        },
        { 
            accessorKey: 'totalPoAmount', 
            id: 'totalPoAmount',
            header: 'Total PO Amount',
            cell: ({ getValue }) => <div className="text-center font-bold text-primary">₹{getValue() as number}</div>
        },
        { 
            accessorKey: 'preparedBy', 
            id: 'preparedBy',
            header: 'Prepared By',
            cell: ({ getValue }) => <div className="text-center text-xs">{getValue() as string}</div>
        },
        { 
            accessorKey: 'approvedBy', 
            id: 'approvedBy',
            header: 'Approved By',
            cell: ({ getValue }) => <div className="text-center text-xs">{getValue() as string}</div>
        },
        {
            accessorKey: 'pdf',
            id: 'pdf',
            header: 'PDF',
            cell: ({ row }) => {
                const url = row.original.pdf;
                return url ? (
                    <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline hover:text-blue-800 font-medium"
                    >
                        View
                    </a>
                ) : <span className="text-muted-foreground">-</span>;
            }
        },
    ];

    const historyColumns: ColumnDef<PoTableData>[] = [
        {
            id: 'actions',
            header: 'Action',
            cell: ({ row }) => (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                        setSelectedItem(row.original);
                        setOpenViewDialog(true);
                    }}
                >
                    <Eye size={16} />
                </Button>
            ),
        },
        ...columns.filter(c => c.id !== 'actions'),
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status;
                const variant = status === 'Rejected' ? 'reject' : status === 'Approved' ? 'primary' : 'secondary';
                return <Pill variant={variant}>{status}</Pill>;
            }
        },
    ];

    const schema = z.object({
        status: z.string().nonempty('Status is required'),
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            status: '',
        },
    });

    useEffect(() => {
        if (openDialog) {
            form.reset({
                status: '',
            });
        }
    }, [openDialog, form]);


    async function onSubmit(values: z.infer<typeof schema>) {
        if (!selectedItem) return;
        setLoading(true);

        try {
            // 1. Get all items for this base indent to update from po_history
            const baseIndent = (selectedItem.internalCode || selectedItem.indentNumber || '').split(/[_/]/)[0];
            const poItemsToUpdate = poHistorySheet.filter(p => 
                (p.internalCode || p.indentNumber || '').split(/[_/]/)[0] === baseIndent
            );
            const todayStr = new Date().toISOString().split('T')[0];

            // 2. REGENERATE PDF with the new approval status
            let updatedPdfUrl = selectedItem.pdf;
            
            try {
                const pdfProps: POPdfProps = {
                    companyLogo: window.location.origin + '/Mamta-logo.png',
                    companyName: details?.companyName || '',
                    companyPhone: details?.companyPhone || '',
                    companyGstin: details?.companyGstin || '',
                    companyPan: details?.companyPan || '',
                    companyAddress: details?.companyAddress || '',
                    billingAddress: details?.billingAddress || '',
                    destinationAddress: details?.destinationAddress || '', // Default to master address
                    supplierName: selectedItem.partyName,
                    supplierAddress: '', // Fallback or fetch if needed
                    supplierGstin: '', // Fallback or fetch if needed
                    orderNumber: selectedItem.poNumber,
                    orderDate: selectedItem.quotationDate ? formatDate(new Date(selectedItem.quotationDate)) : formatDate(new Date()),
                    quotationNumber: selectedItem.quotationNumber,
                    quotationDate: selectedItem.quotationDate,
                    enqNo: selectedItem.enquiryNumber,
                    enqDate: selectedItem.enquiryDate,
                    description: selectedItem.description,
                    items: poItemsToUpdate.map((item) => ({
                        internalCode: item.internalCode || item.indentNumber || '',
                        product: item.product,
                        description: item.description,
                        quantity: item.quantity,
                        unit: item.unit,
                        rate: item.rate,
                        gst: item.gstPercent,
                        discount: item.discountPercent,
                        amount: item.amount,
                    })),
                    total: calculateSubtotal(
                        poItemsToUpdate.map((item) => ({
                            quantity: item.quantity,
                            rate: item.rate,
                            discountPercent: item.discountPercent,
                        }))
                    ),
                    gstAmount: calculateTotalGst(
                        poItemsToUpdate.map((item) => ({
                            quantity: item.quantity,
                            rate: item.rate,
                            discountPercent: item.discountPercent,
                            gstPercent: item.gstPercent,
                        }))
                    ),
                    grandTotal: selectedItem.totalPoAmount,
                    terms: [
                        selectedItem.term1, selectedItem.term2, selectedItem.term3, selectedItem.term4, selectedItem.term5,
                        selectedItem.term6, selectedItem.term7, selectedItem.term8, selectedItem.term9, selectedItem.term10
                    ].filter(Boolean),
                    preparedBy: selectedItem.preparedBy,
                    approvedBy: selectedItem.approvedBy,
                    indentBy: selectedItem.indentBy,
                    finalApproved: values.status === 'Approved' ? 'Dr. Sunil Ramnani' : '',
                };

                const blob = await pdf(<POPdf {...pdfProps} />).toBlob();
                const file = new File([blob], `PO-${selectedItem.poNumber}-Approved.pdf`, {
                    type: 'application/pdf',
                });

                updatedPdfUrl = await uploadFileToSupabase(file, 'pdf');
                console.log('Updated PO PDF uploaded:', updatedPdfUrl);
            } catch (pdfErr) {
                console.error('PDF Regeneration failed, falling back to original URL:', pdfErr);
            }

            // 3. Prepare updates for PO HISTORY
            const updates = poItemsToUpdate.map(({ ...item }) => ({
                ...item,
                status: values.status,           // 'Approved' or 'Rejected'
                pdf: updatedPdfUrl               // Link to the new PDF with signature
            }));

            await postToSheet(updates, 'update', 'PO HISTORY');

            // 4. ALSO Save to PO APPROVAL table
            const approvalData = poItemsToUpdate.map(item => ({
                indentNumber: item.indentNumber,
                indentBy: selectedItem.indentBy,
                finalApproval: values.status === 'Approved' ? 'Dr. Sunil Ramnani' : '',
                planned5: todayStr,
                status: 'Pending'
            }));

            try {
                await postToSheet(approvalData, 'insert', 'PO APPROVAL');
            } catch (err) {
                console.error('PO APPROVAL table save failed:', err);
            }

            toast.success(`PO ${values.status} successfully`);
            setOpenDialog(false);
            updatePoHistorySheet();
        } catch (error) {
            console.error(error);
            toast.error('Failed to submit approval');
        } finally {
            setLoading(false);
        }
    }

    // if (poMasterLoading) return <div className="h-screen w-full grid place-items-center"><Loader color="red" /></div>;

    return (
        <div className="flex flex-col gap-5 h-full w-full max-w-full overflow-hidden">
            <Heading
                heading="PO Approval"
                subtext="Approve or Reject Purchase Orders"
            >
                <PackageCheck size={50} className="text-primary" />
            </Heading>

            <Tabs defaultValue="pending" className="w-full flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] shrink-0">
                    <TabsTrigger value="pending">Pending ({tableData.length})</TabsTrigger>
                    <TabsTrigger value="history">History ({historyData.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="flex-1 min-w-0 w-full overflow-hidden">
                    <DataTable 
                        columns={columns} 
                        data={tableData} 
                        searchFields={['partyName', 'poNumber']} 
                        tableClassName="min-w-[1600px]"
                    />
                </TabsContent>

                <TabsContent value="history" className="flex-1 min-w-0 w-full overflow-hidden">
                    <DataTable 
                        columns={historyColumns} 
                        data={historyData} 
                        searchFields={['partyName', 'poNumber']} 
                        tableClassName="min-w-[1600px]"
                    />
                </TabsContent>
            </Tabs>

            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Approve PO</DialogTitle>
                    </DialogHeader>
                    {selectedItem && (
                        <div className="grid grid-cols-2 gap-4 py-4 text-sm">
                            <div className="col-span-2 grid grid-cols-2 gap-4 border-b pb-4">
                                <div>
                                    <span className="font-semibold block text-xs text-muted-foreground">Party Name</span>
                                    {selectedItem.partyName}
                                </div>
                                <div>
                                    <span className="font-semibold block text-xs text-muted-foreground">PO Number</span>
                                    {selectedItem.poNumber}
                                </div>
                            </div>
                            <div className="col-span-2 border-b pb-4 max-h-[200px] overflow-y-auto">
                                <span className="font-semibold block text-xs text-muted-foreground mb-2">Items in this PO</span>
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-muted">
                                            <th className="border p-1 text-left">Product</th>
                                            <th className="border p-1 text-right">Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {poHistorySheet
                                            .filter(p => {
                                                const pBase = (p.internalCode || p.indentNumber || '').split(/[_/]/)[0];
                                                const sBase = (selectedItem.internalCode || selectedItem.indentNumber || '').split(/[_/]/)[0];
                                                return pBase === sBase && (!p.status || (p.status.trim().toLowerCase() !== 'approved' && p.status.trim().toLowerCase() !== 'rejected'));
                                            })
                                            .map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="border p-1 font-medium">{item.product}</td>
                                                    <td className="border p-1 text-right">{item.quantity} {item.unit}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="col-span-2 border-b pb-4 mt-2">
                                <span className="font-semibold block text-xs text-muted-foreground">Total PO Amount</span>
                                <span className="text-lg font-bold text-primary">{selectedItem.totalPoAmount}</span>
                            </div>

                            <div className="col-span-2 pt-4">
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="status"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Status</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select status" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Approved">Approved</SelectItem>
                                                            <SelectItem value="Rejected">Rejected</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="flex justify-end gap-2 pt-4">
                                            <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
                                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                                {form.formState.isSubmitting ? <Loader size={16} color="white" /> : "Submit"}
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            
            <Dialog open={openViewDialog} onOpenChange={setOpenViewDialog}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>PO Details: {selectedItem?.poNumber}</DialogTitle>
                        <DialogDescription>
                            Full breakdown of items in this purchase order
                        </DialogDescription>
                    </DialogHeader>

                    {selectedItem && (
                        <div className="space-y-6">
                            {/* Header Info */}
                            <div className="grid md:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Party Name</p>
                                    <p className="font-medium">{selectedItem.partyName}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</p>
                                    <Pill variant={selectedItem.status === "Approved" ? "primary" : selectedItem.status === "Rejected" ? "reject" : "secondary"}>
                                        {selectedItem.status || 'Pending'}
                                    </Pill>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Prepared By</p>
                                    <p className="font-medium">{selectedItem.preparedBy}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Approved By</p>
                                    <p className="font-medium">{selectedItem.approvedBy}</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted text-muted-foreground">
                                        <tr>
                                            <th className="p-3 font-medium">Indent No.</th>
                                            <th className="p-3 font-medium">Product</th>
                                            <th className="p-3 font-medium text-center">Qty</th>
                                            <th className="p-3 font-medium text-right">Rate</th>
                                            <th className="p-3 font-medium text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {matchingItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 font-mono text-xs">{item.internalCode || item.indentNumber}</td>
                                                <td className="p-3">{item.product}</td>
                                                <td className="p-3 text-center font-medium">{item.quantity}</td>
                                                <td className="p-3 text-right">₹{item.rate}</td>
                                                <td className="p-3 text-right font-semibold">₹{item.totalPoAmount || (item.quantity * item.rate)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-muted/50 font-bold">
                                        <tr>
                                            <td colSpan={4} className="p-3 text-right">Total Amount:</td>
                                            <td className="p-3 text-right text-primary">₹{selectedItem.totalPoAmount}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="flex justify-end gap-3">
                                {selectedItem.pdf && (
                                    <Button variant="outline" asChild>
                                        <a href={selectedItem.pdf} target="_blank">View PDF Copy</a>
                                    </Button>
                                )}
                                <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

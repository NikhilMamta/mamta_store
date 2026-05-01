import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
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
import { PackageCheck } from 'lucide-react';
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
import { uploadFile } from '@/lib/fetchers';

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
    originalRow: any;
}

export default () => {
    const { poHistorySheet, updatePoHistorySheet, poHistoryLoading, masterSheet: details } = useSheets();
    const [openDialog, setOpenDialog] = useState(false);
    const [tableData, setTableData] = useState<PoTableData[]>([]);
    const [historyData, setHistoryData] = useState<PoTableData[]>([]);
    const [selectedItem, setSelectedItem] = useState<PoTableData | null>(null);
    const [loading, setLoading] = useState(false);

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
        originalRow: row
    });

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

        // Grouping logic for pending (group by base Indent Number and concatenate products)
        const groupedMap = new Map<string, PoTableData>();
        pending.forEach(item => {
            const baseIndent = (item.internalCode || item.indentNumber || '').split(/[_/]/)[0];
            if (baseIndent) {
                if (!groupedMap.has(baseIndent)) {
                    groupedMap.set(baseIndent, { ...item });
                } else {
                    const existing = groupedMap.get(baseIndent)!;
                    const existingProducts = existing.product.split(', ').map(p => p.trim());
                    if (!existingProducts.includes(item.product.trim())) {
                        existing.product = `${existing.product}, ${item.product.trim()}`;
                    }
                }
            }
        });

        setTableData(Array.from(groupedMap.values()));
        setHistoryData(history);
    }, [poHistorySheet]);

    const columns: ColumnDef<PoTableData>[] = [
        {
            id: 'actions',
            header: 'Action',
            cell: ({ row }) => (
                <Button
                    size="sm"
                    onClick={() => {
                        setSelectedItem(row.original);
                        setOpenDialog(true);
                    }}
                >
                    Action
                </Button>
            )
        },
        { accessorKey: 'partyName', header: 'Party Name' },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'quotationNumber', header: 'Quotation Number' },
        { accessorKey: 'quotationDate', header: 'Quotation Date' },
        { accessorKey: 'enquiryNumber', header: 'Enquiry Number' },
        { accessorKey: 'enquiryDate', header: 'Enquiry Date' },
        { 
            accessorKey: 'internalCode', 
            header: 'Internal Code',
            cell: ({ getValue }) => (getValue() as string || '').split(/[_/]/)[0]
        },
        { 
            accessorKey: 'product', 
            header: 'Product',
            cell: ({ getValue }) => <div className="max-w-[300px] break-words whitespace-normal">{getValue() as string}</div>
        },
        { accessorKey: 'description', header: 'Description' },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'unit', header: 'Unit' },
        { accessorKey: 'rate', header: 'Rate' },
        { accessorKey: 'gstPercent', header: 'GST %' },
        { accessorKey: 'discountPercent', header: 'Discount %' },
        { accessorKey: 'amount', header: 'Amount' },
        { accessorKey: 'totalPoAmount', header: 'Total PO Amount' },
        { accessorKey: 'preparedBy', header: 'Prepared By' },
        { accessorKey: 'approvedBy', header: 'Approved By' },
        {
            accessorKey: 'pdf',
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

        // Format date as DD/MM/YYYY HH:mm:ss
        const formattedDate = formatDate(new Date());

        try {
            // NEW: Get all items for this base indent to update from po_history
            const baseIndent = (selectedItem.internalCode || selectedItem.indentNumber || '').split(/[_/]/)[0];
            const poItemsToUpdate = poHistorySheet.filter(p => 
                (p.internalCode || p.indentNumber || '').split(/[_/]/)[0] === baseIndent
            );
            const todayStr = new Date().toISOString().split('T')[0];

            const updates = poItemsToUpdate.map(({ ...item }) => ({
                ...item,
                status: values.status           // 'Approved' or 'Rejected'
            }));

            await postToSheet(updates, 'update', 'PO HISTORY');

            // --- ALSO Save to PO APPROVAL table ---
            const approvalData = poItemsToUpdate.map(item => ({
                indentNumber: item.indentNumber,
                indentBy: selectedItem.indentBy,
                finalApproval: values.status === 'Approved' ? 'Dr. Sunil Ramnani' : '',
                planned5: todayStr, // Use YYYY-MM-DD as approval date
                status: 'Pending' // Always save as Pending in this table
                // timestamp will be generated automatically by the database
            }));

            try {
                await postToSheet(approvalData, 'insert', 'PO APPROVAL');
            } catch (err) {
                console.error('PO APPROVAL table save failed:', err);
            }

            toast.success('Submitted successfully');
            setOpenDialog(false);
            // Refresh data
            updatePoHistorySheet();
        } catch (error) {
            console.error(error);
            toast.error('Failed to submit');
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

                <TabsContent value="pending" className="flex-1 min-h-0 w-full overflow-hidden">
                    <div className="w-full h-full overflow-x-auto overflow-y-hidden">
                        <DataTable columns={columns} data={tableData} searchFields={['partyName', 'poNumber']} />
                    </div>
                </TabsContent>

                <TabsContent value="history" className="flex-1 min-h-0 w-full overflow-hidden">
                    <div className="w-full h-full overflow-x-auto overflow-y-hidden">
                        <DataTable columns={historyColumns} data={historyData} searchFields={['partyName', 'poNumber']} />
                    </div>
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
        </div>
    );
};

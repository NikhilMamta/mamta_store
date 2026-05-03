import type { ColumnDef, Row } from '@tanstack/react-table';
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
import { useEffect, useState } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { postToDB } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Input } from '../ui/input';

interface RateApprovalData {
    id?: number;
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    comparisonSheet: string;
    vendors: [string, string, string][];
    date: string;
    searialNumber?: string | number;
    approvedVendorName?: string;
}

interface GroupedRateApprovalData {
    indentNo: string;
    indenter: string;
    department: string;
    comparisonSheet: string;
    date: string;
    items: RateApprovalData[];
}

interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    vendor: [string, string];
    date: string;
    searialNumber?: string | number;
}

interface GroupedHistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    date: string;
    items: HistoryData[];
}

export default () => {
    const { indentLoading, indentData, updateIndentData, vendorRateUpdateData, approvedIndentData, threePartyApprovalData, updateVendorRateUpdateData, updateThreePartyApprovalData } = useDatabase();
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<GroupedRateApprovalData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<GroupedHistoryData | null>(null);
    const [tableData, setTableData] = useState<GroupedRateApprovalData[]>([]);
    const [historyData, setHistoryData] = useState<GroupedHistoryData[]>([]);

    useEffect(() => {
        // Safety check: ensure sheets are loaded
        if (!indentData || !vendorRateUpdateData || !approvedIndentData) {
            console.log('RateApproval: TableNames not loaded yet');
            return;
        }

        const pendingApprovedIndents = approvedIndentData.filter(
            (ai) => ai.vendorType?.trim() === 'Three Party' && ai.status?.trim() === 'Pending'
        );

        const pendingIndentNumbers = new Set(pendingApprovedIndents.map(ai => ai.indentNumber));

        const pendingItems = indentData
            .filter((sheet) => pendingIndentNumbers.has(sheet.indentNumber))
            .map((sheet) => {
                const vendorUpdate = vendorRateUpdateData.find(
                    (vru) => vru.indentNumber === sheet.indentNumber && vru.status?.trim().toLowerCase() === 'pending'
                );
                
                const serialNo = sheet.searialNumber || sheet.serialNumber || (sheet.indentNumber?.includes('_') ? sheet.indentNumber.split('_').pop() : sheet.indentNumber?.includes('/') ? sheet.indentNumber.split('/').pop() : '-');
                
                return {
                    id: sheet.id,
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    comparisonSheet: sheet.comparisonSheet || '',
                    date: formatDate(new Date(sheet.timestamp)),
                    searialNumber: serialNo,
                    approvedVendorName: sheet.approvedVendorName || '',
                    vendors: vendorUpdate
                        ? [
                            [vendorUpdate.vendorName1 || '', vendorUpdate.rate1?.toString() || '0', vendorUpdate.paymentTerm1 || ''],
                            [vendorUpdate.vendorName2 || '', vendorUpdate.rate2?.toString() || '0', vendorUpdate.paymentTerm2 || ''],
                            [vendorUpdate.vendorName3 || '', vendorUpdate.rate3?.toString() || '0', vendorUpdate.paymentTerm3 || ''],
                        ] as [string, string, string][]
                        : [
                            [sheet.vendorName1 || '', sheet.rate1?.toString() || '0', sheet.paymentTerm1 || ''],
                            [sheet.vendorName2 || '', sheet.rate2?.toString() || '0', sheet.paymentTerm2 || ''],
                            [sheet.vendorName3 || '', sheet.rate3?.toString() || '0', sheet.paymentTerm3 || ''],
                        ] as [string, string, string][],
                };
            });

        console.log('RateApproval Pending Items:', pendingItems.length);

        const groupedPending = pendingItems.reduce((acc, item) => {
            const baseNo = item.indentNo.split('_')[0];
            if (!acc[baseNo]) {
                acc[baseNo] = {
                    indentNo: baseNo,
                    indenter: item.indenter,
                    department: item.department,
                    comparisonSheet: item.comparisonSheet,
                    date: item.date,
                    items: [],
                };
            }
            acc[baseNo].items.push(item);
            return acc;
        }, {} as Record<string, GroupedRateApprovalData>);

        setTableData(Object.values(groupedPending).reverse());

        // HISTORY TAB: Show data from three_party_approval table
        const historyItems = threePartyApprovalData
            .map((approval) => {
                const indent = indentData.find(i => i.indentNumber === approval.indentNumber);
                const serialNo = indent?.searialNumber || indent?.serialNumber || (approval.indentNumber?.includes('_') ? approval.indentNumber.split('_').pop() : approval.indentNumber?.includes('/') ? approval.indentNumber.split('/').pop() : '-');
                
                return {
                    indentNo: approval.indentNumber,
                    indenter: indent?.indenterName || '',
                    department: indent?.department || '',
                    product: indent?.productName || '',
                    date: new Date(approval.approvedDate || approval.timestamp).toDateString(),
                    searialNumber: serialNo,
                    vendor: [approval.approvedVendorName || '', approval.approvedRate?.toString() || '0'] as [string, string],
                };
            });

        const groupedHistory = historyItems.reduce((acc, item) => {
            if (!acc[item.indentNo]) {
                acc[item.indentNo] = {
                    indentNo: item.indentNo,
                    indenter: item.indenter,
                    department: item.department,
                    date: item.date,
                    items: [],
                };
            }
            acc[item.indentNo].items.push(item);
            return acc;
        }, {} as Record<string, GroupedHistoryData>);

        setHistoryData(Object.values(groupedHistory).reverse());
    }, [indentData, vendorRateUpdateData, approvedIndentData, threePartyApprovalData]);

    const columns: ColumnDef<GroupedRateApprovalData>[] = [
        ...(user.threePartyApprovalAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<GroupedRateApprovalData> }) => (
                        <Button
                            variant="outline"
                            onClick={() => setSelectedIndent(row.original)}
                        >
                            Approve ({row.original.items.length})
                        </Button>
                    ),
                },
            ]
            : []),
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => (
                <div className="font-medium text-xs sm:text-sm">
                    {(getValue() as string).split(/[_/]/)[0]}
                </div>
            ),
            size: 100,
        },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        {
            accessorKey: 'items',
            header: 'Products',
            cell: ({ row }) => (
                <div className="max-w-[200px] break-words whitespace-normal text-xs">
                    {row.original.items.map(i => i.product).join(', ')}
                </div>
            ),
        },
        { accessorKey: 'date', header: 'Date' },
        {
            accessorKey: 'comparisonSheet',
            header: 'Comp. Sheet',
            cell: ({ row }) => row.original.comparisonSheet ? (
                <a href={row.original.comparisonSheet} target="_blank" className="text-primary hover:underline">View</a>
            ) : '-',
        },
    ];

    const historyColumns: ColumnDef<GroupedHistoryData>[] = [
        { accessorKey: 'date', header: 'Date' },
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => (
                <div className="font-medium text-xs sm:text-sm">
                    {(getValue() as string).split(/[_/]/)[0]}
                </div>
            ),
        },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        {
            accessorKey: 'items',
            header: 'Products',
            cell: ({ row }) => (
                <div className="max-w-[200px] break-words whitespace-normal text-xs">
                    {row.original.items.map(i => i.product).join(', ')}
                </div>
            ),
        },
    ];

    return (
        <div>
            <Tabs defaultValue="pending">
                <Heading heading="Three Party Rate Approval" subtext="Approve rates for three party vendors" tabs>
                    <Users size={50} className="text-primary" />
                </Heading>
                <TabsContent value="pending">
                    <DataTable data={tableData} columns={columns} searchFields={['indentNo', 'department', 'indenter']} dataLoading={indentLoading} />
                </TabsContent>
                <TabsContent value="history">
                    <DataTable data={historyData} columns={historyColumns} searchFields={['indentNo', 'department', 'indenter']} dataLoading={indentLoading} />
                </TabsContent>
            </Tabs>

            <Dialog open={!!(selectedIndent || selectedHistory)} onOpenChange={(open) => {
                if (!open) {
                    setSelectedIndent(null);
                    setSelectedHistory(null);
                }
            }}>
                <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden">
                    {selectedIndent && (
                        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                            <DialogHeader className="p-6 bg-primary text-primary-foreground flex-none">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <DialogTitle className="text-2xl font-bold">Rate Approval - {selectedIndent.indentNo}</DialogTitle>
                                        <DialogDescription className="text-primary-foreground/80 font-medium mt-1">
                                            {selectedIndent.indenter} | {selectedIndent.department}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                            
                            <div className="flex-1 overflow-y-auto p-6">
                                <RateApprovalForm
                                    items={selectedIndent.items}
                                    onSuccess={() => {
                                        setSelectedIndent(null);
                                        setTimeout(() => {
                                            updateIndentData();
                                            updateVendorRateUpdateData();
                                            updateThreePartyApprovalData();
                                        }, 1000);
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {selectedHistory && (
                        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                            <DialogHeader className="p-6 bg-primary text-primary-foreground flex-none">
                                <div>
                                    <DialogTitle className="text-2xl font-bold">Approval History - {selectedHistory.indentNo}</DialogTitle>
                                    <DialogDescription className="text-primary-foreground/80 font-medium mt-1">
                                        {selectedHistory.indenter} | {selectedHistory.department} | {selectedHistory.date}
                                    </DialogDescription>
                                </div>
                            </DialogHeader>
                            
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="border rounded-lg overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50">
                                            <tr className="border-b text-primary font-bold text-left">
                                                <th className="px-4 py-3">S.No</th>
                                                <th className="px-4 py-3">Product</th>
                                                <th className="px-4 py-3">Approved Vendor</th>
                                                <th className="px-4 py-3">Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedHistory.items.map((item, idx) => (
                                                <tr key={idx} className="border-b last:border-0 border-muted/20 hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 font-medium">{item.searialNumber || '-'}</td>
                                                    <td className="px-4 py-3">{item.product}</td>
                                                    <td className="px-4 py-3">{item.vendor[0] || <span className="text-muted-foreground italic">Not specified</span>}</td>
                                                    <td className="px-4 py-3 font-bold text-base">₹{Number(item.vendor[1]).toLocaleString('en-IN')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <DialogFooter className="p-4 bg-muted/30 border-t flex-none">
                        <DialogClose asChild>
                            <Button variant="outline" className="px-8">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const RateApprovalForm = ({ items, onSuccess }: { items: RateApprovalData[], onSuccess: () => void }) => {
    const { vendorRateUpdateData, approvedIndentData, updateApprovedIndentData } = useDatabase();
    
    const schema = z.object({
        approvals: z.array(z.object({
            searialNumber: z.union([z.string(), z.number()]),
            vendorIndex: z.string().nonempty('Vendor selection is required'),
            product: z.string(),
            indentNumber: z.string(),
            vendors: z.array(z.object({
                vendorName: z.string(),
                rate: z.coerce.number(),
                paymentTerm: z.string()
            }))
        }))
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            approvals: items.map(item => {
                const vendors = item.vendors.map(v => ({
                    vendorName: v[0] || '',
                    rate: parseFloat(v[1]) || 0,
                    paymentTerm: v[2] || ''
                }));
                
                // Auto-select vendor if approvedVendorName matches one of our vendors
                let vendorIndex = '';
                if (item.approvedVendorName) {
                    const foundIndex = vendors.findIndex(v => v.vendorName === item.approvedVendorName);
                    if (foundIndex !== -1) {
                        vendorIndex = String(foundIndex);
                    }
                }

                return {
                    searialNumber: item.searialNumber || '',
                    vendorIndex: vendorIndex,
                    product: item.product,
                    indentNumber: item.indentNo,
                    vendors: vendors
                };
            })
        }
    });

    const onSubmit = async (values: z.infer<typeof schema>) => {
        try {
            const now = new Date();
            const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

            // Get unique indent numbers from the approvals
            const uniqueIndentNumbers = [...new Set(values.approvals.map(a => a.indentNumber))];

            // 1. Update INDENT table - set actual3, approved vendor details
            const indentPayload = values.approvals.map((appr) => {
                const originalItem = items.find(i => String(i.searialNumber) === String(appr.searialNumber)) || items[0];
                const vendorIndex = parseInt(appr.vendorIndex);
                const selectedVendor = appr.vendors[vendorIndex];

                return {
                    id: originalItem.id,
                    indentNumber: appr.indentNumber,
                    approvedVendorName: selectedVendor.vendorName,
                    approvedRate: selectedVendor.rate,
                    approvedPaymentTerm: selectedVendor.paymentTerm,
                };
            });

            await postToDB(indentPayload, 'update', 'INDENT');

            // 2. Update VENDOR_RATE_UPDATE table - set status to 'Approved'
            for (const indentNumber of uniqueIndentNumbers) {
                const vendorUpdateRecord = vendorRateUpdateData.find(
                    (vru) => vru.indentNumber === indentNumber && vru.status?.trim().toLowerCase() === 'pending'
                );

                if (vendorUpdateRecord && vendorUpdateRecord.id) {
                    await postToDB([{
                        id: vendorUpdateRecord.id,
                        status: 'Approved',
                    }], 'update', 'VENDOR RATE UPDATE');
                }
                
                const approvedIndentRecord = approvedIndentData.find(
                    (ai) => ai.indentNumber === indentNumber && ai.status?.trim().toLowerCase() === 'pending'
                );
                if (approvedIndentRecord && approvedIndentRecord.id) {
                    await postToDB([{
                        id: approvedIndentRecord.id,
                        status: 'Approved'
                    }], 'update', 'APPROVED INDENT');
                }
            }

            // 3. Insert into THREE_PARTY_APPROVAL table
            const threePartyPayload = values.approvals.map((appr) => {
                const vendorIndex = parseInt(appr.vendorIndex);
                const selectedVendor = appr.vendors[vendorIndex];

                return {
                    indent_number: appr.indentNumber,
                    approved_vendor_name: selectedVendor.vendorName,
                    approved_rate: selectedVendor.rate,
                    approved_payment_term: selectedVendor.paymentTerm,
                    approved_date: formattedDate,
                    status: 'Approved'
                };
            });

            await postToDB(threePartyPayload, 'insert', 'THREE PARTY APPROVAL');

            toast.success(`Approved ${items.length} items`);
            updateApprovedIndentData();
            onSuccess();
        } catch (error) {
            console.error('Approval failed:', error);
            toast.error('Failed to update');
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="space-y-8">
                    {items.map((item, index) => (
                        <div key={item.searialNumber || index} className="border rounded-2xl bg-white shadow-md overflow-hidden transition-all hover:shadow-lg">
                            <div className="bg-muted/50 p-4 border-b flex justify-between items-center">
                                <h3 className="font-bold text-xl text-primary">{item.product}</h3>
                                <div className="flex gap-2">
                                    <span className="text-xs font-bold bg-primary/10 text-primary px-4 py-1.5 rounded-full uppercase tracking-widest border border-primary/20">
                                        S.No: {item.searialNumber}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                <FormField
                                    control={form.control}
                                    name={`approvals.${index}.vendorIndex`}
                                    render={({ field }) => (
                                        <FormItem className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <FormLabel className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Compare & Select Vendor</FormLabel>
                                                {field.value === '' && (
                                                    <span className="text-xs text-red-500 animate-pulse font-medium">Selection Required *</span>
                                                )}
                                            </div>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 gap-4">
                                                    {[0, 1, 2].map((vIdx) => (
                                                        <div
                                                            key={vIdx}
                                                            className={`relative group flex flex-col md:flex-row items-start md:items-center gap-4 p-5 border-2 rounded-2xl transition-all duration-200 cursor-pointer ${field.value === `${vIdx}`
                                                                ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
                                                                : 'border-muted/40 hover:border-primary/40 hover:bg-slate-50 shadow-sm'
                                                                }`}
                                                            onClick={() => field.onChange(`${vIdx}`)}
                                                        >
                                                            <div className="flex items-center gap-4 min-w-0 flex-1 w-full">
                                                                <RadioGroupItem
                                                                    value={`${vIdx}`}
                                                                    id={`v-${index}-${vIdx}`}
                                                                    className="h-6 w-6 border-2 border-muted-foreground/30 text-primary"
                                                                />
                                                                
                                                                <div className="grid grid-cols-1 md:grid-cols-[1.5fr_0.8fr_1.2fr] gap-4 w-full items-end">
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`approvals.${index}.vendors.${vIdx}.vendorName`}
                                                                        render={({ field: vField }) => (
                                                                            <FormItem className="space-y-1">
                                                                                <FormLabel className="text-[10px] font-bold text-muted-foreground/70 uppercase">Vendor Name</FormLabel>
                                                                                <FormControl>
                                                                                    <Input 
                                                                                        {...vField} 
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                        className="h-10 bg-white/80 border-muted focus:bg-white transition-all font-semibold"
                                                                                        placeholder="Enter vendor name..."
                                                                                    />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`approvals.${index}.vendors.${vIdx}.rate`}
                                                                        render={({ field: vField }) => (
                                                                            <FormItem className="space-y-1">
                                                                                <FormLabel className="text-[10px] font-bold text-muted-foreground/70 uppercase">Rate (₹)</FormLabel>
                                                                                <FormControl>
                                                                                    <Input 
                                                                                        {...vField} 
                                                                                        type="number"
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                        className="h-10 bg-white/80 border-muted focus:bg-white transition-all font-bold text-primary"
                                                                                        placeholder="0.00"
                                                                                    />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`approvals.${index}.vendors.${vIdx}.paymentTerm`}
                                                                        render={({ field: vField }) => (
                                                                            <FormItem className="space-y-1">
                                                                                <FormLabel className="text-[10px] font-bold text-muted-foreground/70 uppercase">Payment Terms</FormLabel>
                                                                                <FormControl>
                                                                                    <Input 
                                                                                        {...vField} 
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                        className="h-10 bg-white/80 border-muted focus:bg-white transition-all text-xs"
                                                                                        placeholder="Payment details..."
                                                                                    />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="sticky bottom-0 pt-4 bg-transparent">
                    <Button type="submit" disabled={form.formState.isSubmitting} className="w-full h-14 text-lg font-bold shadow-xl hover:shadow-2xl transition-all">
                        {form.formState.isSubmitting ? <Loader size={20} color="white" /> : `Approve & Finalize ${items.length} Items`}
                    </Button>
                </div>
            </form>
        </Form>
    );
};

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
import { useSheets } from '@/context/SheetsContext';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { postToSheet } from '@/lib/fetchers';
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
    rowIndex: number;
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    comparisonSheet: string;
    vendors: [string, string, string][];
    date: string;
    searialNumber?: string | number;
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
    const { indentLoading, indentSheet, updateIndentSheet, vendorRateUpdateSheet, approvedIndentSheet, threePartyApprovalSheet, updateVendorRateUpdateSheet, updateThreePartyApprovalSheet } = useSheets();
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<GroupedRateApprovalData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<GroupedHistoryData | null>(null);
    const [tableData, setTableData] = useState<GroupedRateApprovalData[]>([]);
    const [historyData, setHistoryData] = useState<GroupedHistoryData[]>([]);

    useEffect(() => {
        // Safety check: ensure sheets are loaded
        if (!indentSheet || !vendorRateUpdateSheet || !approvedIndentSheet) {
            console.log('RateApproval: Sheets not loaded yet');
            return;
        }

        const pendingApprovedIndents = approvedIndentSheet.filter(
            (ai) => ai.vendorType?.trim() === 'Three Party' && ai.status?.trim() === 'Pending'
        );

        const pendingIndentNumbers = new Set(pendingApprovedIndents.map(ai => ai.indentNumber));

        const pendingItems = indentSheet
            .filter((sheet) => pendingIndentNumbers.has(sheet.indentNumber))
            .map((sheet) => {
                const vendorUpdate = vendorRateUpdateSheet.find(
                    (vru) => vru.indentNumber === sheet.indentNumber && vru.status?.trim().toLowerCase() === 'pending'
                );

                return {
                    rowIndex: (sheet as any).rowIndex,
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    comparisonSheet: sheet.comparisonSheet || '',
                    date: formatDate(new Date(sheet.timestamp)),
                    searialNumber: sheet.searialNumber,
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
        const historyItems = threePartyApprovalSheet
            .map((approval) => ({
                indentNo: approval.indentNumber,
                indenter: indentSheet.find(i => i.indentNumber === approval.indentNumber)?.indenterName || '',
                department: indentSheet.find(i => i.indentNumber === approval.indentNumber)?.department || '',
                product: indentSheet.find(i => i.indentNumber === approval.indentNumber)?.productName || '',
                date: new Date(approval.approvedDate || approval.timestamp).toDateString(),
                searialNumber: indentSheet.find(i => i.indentNumber === approval.indentNumber)?.searialNumber,
                vendor: [approval.approvedVendorName || '', approval.approvedRate?.toString() || '0'] as [string, string],
            }));

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
    }, [indentSheet, vendorRateUpdateSheet, approvedIndentSheet, threePartyApprovalSheet]);

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
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {selectedIndent && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Rate Approval - {selectedIndent.indentNo}</DialogTitle>
                                <DialogDescription>
                                    {selectedIndent.indenter} | {selectedIndent.department}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                                <RateApprovalForm
                                    items={selectedIndent.items}
                                    onSuccess={() => {
                                        setSelectedIndent(null);
                                        setTimeout(() => {
                                            updateIndentSheet();
                                            updateVendorRateUpdateSheet();
                                            updateThreePartyApprovalSheet();
                                        }, 1000);
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {selectedHistory && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Approval History - {selectedHistory.indentNo}</DialogTitle>
                                <DialogDescription>{selectedHistory.indenter} | {selectedHistory.department} | {selectedHistory.date}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <table className="w-full text-sm">
                                    <thead className="bg-primary">
                                        <tr className="border-b text-primary-foreground font-bold text-left">
                                            <th className="py-2">Product</th>
                                            <th className="py-2">Approved Vendor</th>
                                            <th className="py-2">Rate</th>
                                            <th className="py-2">S.No</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedHistory.items.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0 border-muted/20">
                                                <td className="py-2">{item.product}</td>
                                                <td className="py-2">{item.vendor[0] || '-'}</td>
                                                <td className="py-2">₹{item.vendor[1] || '0'}</td>
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

const RateApprovalForm = ({ items, onSuccess }: { items: RateApprovalData[], onSuccess: () => void }) => {
    const { indentSheet, vendorRateUpdateSheet } = useSheets();
    const schema = z.object({
        approvals: z.array(z.object({
            searialNumber: z.union([z.string(), z.number()]),
            vendorIndex: z.string().nonempty('Vendor selection is required'),
            product: z.string(),
            indentNumber: z.string()
        }))
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            approvals: items.map(item => ({
                searialNumber: item.searialNumber || '',
                vendorIndex: '',
                product: item.product,
                indentNumber: item.indentNo
            }))
        }
    });

    const onSubmit = async (values: z.infer<typeof schema>) => {
        try {
            const now = new Date();
            const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const formattedDateTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

            // Get unique indent numbers from the approvals
            const uniqueIndentNumbers = [...new Set(values.approvals.map(a => a.indentNumber))];

            console.log('🔍 Debug - Items received:', items);
            console.log('🔍 Debug - Values to submit:', values);

            // 1. Update INDENT table - set actual3, approved vendor details
            const indentPayload = values.approvals.map((appr, index) => {
                // Try to find by searialNumber first, fallback to index
                let originalItem = items.find(i => String(i.searialNumber) === String(appr.searialNumber));
                
                // If not found by searialNumber, try by index
                if (!originalItem) {
                    console.warn(`⚠️ Item with searialNumber ${appr.searialNumber} not found, using index ${index}`);
                    originalItem = items[index];
                }

                if (!originalItem) {
                    console.error(`❌ Could not find item for approval ${index}`);
                    throw new Error(`Item not found for approval`);
                }

                const vendorIndex = parseInt(appr.vendorIndex);
                if (isNaN(vendorIndex) || !originalItem.vendors || !originalItem.vendors[vendorIndex]) {
                    console.error(`❌ Invalid vendor selection for item ${originalItem.product}`);
                    throw new Error(`Invalid vendor selection for ${originalItem.product}`);
                }

                const selectedVendor = originalItem.vendors[vendorIndex];

                console.log(`✅ Processing: ${originalItem.product}, Vendor: ${selectedVendor[0]}`);

                return {
                    rowIndex: originalItem.rowIndex,
                    indentNumber: appr.indentNumber,
                    actual3: formattedDateTime,
                    approvedVendorName: selectedVendor[0] || '',
                    approvedRate: parseFloat(selectedVendor[1]) || 0,
                    approvedPaymentTerm: selectedVendor[2] || '',
                };
            });

            console.log('📝 Step 1: Updating INDENT table:', indentPayload);
            await postToSheet(indentPayload, 'update', 'INDENT');
            console.log('✅ INDENT table updated successfully');

            // 2. Update VENDOR_RATE_UPDATE table - set status to 'Approved'
            for (const indentNumber of uniqueIndentNumbers) {
                const vendorUpdateRecord = vendorRateUpdateSheet.find(
                    (vru) => vru.indentNumber === indentNumber && vru.status?.trim().toLowerCase() === 'pending'
                );

                if (vendorUpdateRecord && vendorUpdateRecord.id) {
                    console.log('📝 Step 2: Updating VENDOR_RATE_UPDATE status to Approved:', indentNumber);
                    await postToSheet([{
                        id: vendorUpdateRecord.id,
                        status: 'Approved',
                        planned3: formattedDateTime,
                    }], 'update', 'VENDOR RATE UPDATE');
                    console.log('✅ VENDOR_RATE_UPDATE status updated successfully');
                }
                
                const approvedIndentRecord = approvedIndentSheet.find(
                    (ai) => ai.indent_number === indentNumber && ai.status?.trim().toLowerCase() === 'pending'
                );
                if (approvedIndentRecord && approvedIndentRecord.id) {
                    await postToSheet([{
                        id: approvedIndentRecord.id,
                        status: 'Approved'
                    }], 'update', 'APPROVED INDENT');
                }
            }

            // 3. Insert into THREE_PARTY_APPROVAL table
            const threePartyPayload = values.approvals.map((appr, index) => {
                let originalItem = items.find(i => String(i.searialNumber) === String(appr.searialNumber));
                if (!originalItem) originalItem = items[index];
                
                if (!originalItem) {
                    throw new Error(`Item not found`);
                }

                const vendorIndex = parseInt(appr.vendorIndex);
                const selectedVendor = originalItem.vendors?.[vendorIndex] || ['', '0', ''];

                return {
                    indent_number: appr.indentNumber,
                    approved_vendor_name: selectedVendor[0] || '',
                    approved_rate: parseFloat(selectedVendor[1]) || 0,
                    approved_payment_term: selectedVendor[2] || '',
                    approved_date: formattedDate,
                    planned_4: formattedDate,
                    status: 'Approved'
                };
            });

            console.log('📝 Step 3: Inserting into THREE_PARTY_APPROVAL table:', threePartyPayload);
            await postToSheet(threePartyPayload, 'insert', 'THREE PARTY APPROVAL');

            toast.success(`Approved ${items.length} items`);
            updateApprovedIndentSheet();
            onSuccess();
        } catch (error) {
            console.error('Approval failed:', error);
            toast.error('Failed to update');
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                console.error("Form errors:", errors);
                toast.error("Please select a vendor for all items");
            })} className="space-y-6">
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                    {items.map((item, index) => (
                        <div key={item.searialNumber || index} className="border p-4 rounded-md bg-muted/20 space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-semibold text-sm text-primary">{item.product}</span>
                                <span className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded">S.No: {item.searialNumber}</span>
                            </div>
                            <FormField
                                control={form.control}
                                name={`approvals.${index}.vendorIndex`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold">Select Vendor</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col gap-3">
                                                {item.vendors.map((vendor, i) => {
                                                    const vendorName = vendor[0] || 'N/A';
                                                    const vendorRate = vendor[1] || '0';
                                                    const vendorPayment = vendor[2] || 'N/A';
                                                    
                                                    return (
                                                    <div
                                                        key={i}
                                                        onClick={() => field.onChange(`${i}`)}
                                                        className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${field.value === `${i}`
                                                            ? 'border-blue-500 bg-blue-50/50'
                                                            : 'border-muted/40 hover:border-blue-200 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <RadioGroupItem
                                                                value={`${i}`}
                                                                id={`v-${item.searialNumber}-${i}`}
                                                                className="h-5 w-5 border-2 border-muted-foreground/30 text-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-blue-600"
                                                            />
                                                            <span className="text-sm font-semibold text-foreground">
                                                                {vendorName}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="font-bold text-base">₹{vendorRate}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {vendorPayment}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );})}
                                            </RadioGroup>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
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

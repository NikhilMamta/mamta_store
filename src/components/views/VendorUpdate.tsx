import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
    DialogHeader,
    DialogFooter,
    DialogClose,
} from '../ui/dialog';
import { postToSheet, uploadFile, fetchVendors } from '@/lib/fetchers';
import { z } from 'zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { UserCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { formatDate } from '@/lib/utils';

interface VendorUpdateData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    vendorType: 'Three Party' | 'Regular';
    vendorName?: string;
    searialNumber?: string | number;
}
interface GroupedVendorUpdateData {
    indentNo: string;
    indenter: string;
    department: string;
    vendorType: 'Three Party' | 'Regular';
    items: VendorUpdateData[];
}

interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    rate: number;
    vendorType: 'Three Party' | 'Regular';
    date: string;
    vendorName?: string;
    searialNumber?: string | number;
}

interface GroupedHistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    date: string;
    items: HistoryData[];
}

const ThreePartyFields = ({ index, form, vendors, options }: any) => {
    const { fields } = useFieldArray({ control: form.control, name: `updates.${index}.vendors` });

    return (
        <Tabs defaultValue="0" className="border rounded-md p-3 bg-background">
            <TabsList className="bg-muted overflow-x-auto h-9 w-full justify-start">
                {fields.map((_, i) => <TabsTrigger key={i} value={`${i}`} className="px-2 text-[10px]">V{i + 1}</TabsTrigger>)}
            </TabsList>
            {fields.map((field, vIndex) => (
                <TabsContent key={field.id} value={`${vIndex}`} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3 pt-3 items-end">
                    <FormField
                        control={form.control}
                        name={`updates.${index}.vendors.${vIndex}.vendorName`}
                        render={({ field }) => (
                            <FormItem className="min-w-0">
                                <FormLabel className="text-[10px]">Vendor {vIndex + 1}</FormLabel>
                                <Select
                                    onValueChange={(val) => {
                                        field.onChange(val);
                                        form.getValues('updates').forEach((_: any, i: number) => {
                                            form.setValue(`updates.${i}.vendors.${vIndex}.vendorName`, val);
                                        });
                                    }}
                                    value={field.value}
                                >
                                    <FormControl>
                                        <SelectTrigger className="h-8 text-xs w-full overflow-hidden">
                                            <div className="truncate text-left flex-1">
                                                <SelectValue placeholder="Vendor" />
                                            </div>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {vendors?.map((v: any, i: number) => <SelectItem key={i} value={v.vendorName}>{v.vendorName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`updates.${index}.vendors.${vIndex}.rate`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px]">Rate</FormLabel>
                                <FormControl><Input type="number" {...field} className="h-8 text-xs" /></FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`updates.${index}.vendors.${vIndex}.paymentTerm`}
                        render={({ field }) => (
                            <FormItem className="min-w-0">
                                <FormLabel className="text-[10px]">Term</FormLabel>
                                <Select
                                    onValueChange={(val) => {
                                        field.onChange(val);
                                        form.getValues('updates').forEach((_: any, i: number) => {
                                            form.setValue(`updates.${i}.vendors.${vIndex}.paymentTerm`, val);
                                        });
                                    }}
                                    value={field.value}
                                >
                                    <FormControl>
                                        <SelectTrigger className="h-8 text-xs w-full overflow-hidden">
                                            <div className="truncate text-left flex-1">
                                                <SelectValue placeholder="Term" />
                                            </div>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {options?.paymentTerms?.map((term: string, i: number) => <SelectItem key={i} value={term}>{term}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                </TabsContent>
            ))}
        </Tabs>
    );
};

const VendorUpdateForm = ({ items, vendorType, vendors, options, onSuccess }: any) => {
    const { indentSheet, approvedIndentSheet, updateIndentSheet, updateApprovedIndentSheet, vendorRateUpdateSheet, updateVendorRateUpdateSheet } = useSheets();
    const [vendorSearch, setVendorSearch] = useState('');

    const regularSchema = z.object({
        updates: z.array(z.object({
            searialNumber: z.union([z.string(), z.number()]),
            vendorName: z.string().optional(),
            rate: z.coerce.number().optional(),
            paymentTerm: z.string().optional(),
            product: z.string(),
            indentNumber: z.string()
        }))
    });

    const threePartySchema = z.object({
        comparisonSheet: z.any().optional(),
        updates: z.array(z.object({
            searialNumber: z.union([z.string(), z.number()]),
            product: z.string(),
            indentNumber: z.string(),
            vendors: z.array(z.object({
                vendorName: z.string().optional(),
                rate: z.coerce.number().optional(),
                paymentTerm: z.string().optional(),
            })).max(10).min(1),
        }))
    });

    const isThreeParty = vendorType === 'Three Party';
    const form = useForm<any>({
        resolver: zodResolver(isThreeParty ? threePartySchema : regularSchema),
        defaultValues: {
            comparisonSheet: undefined,
            updates: items.map((item: any) => ({
                searialNumber: item.searialNumber || '',
                product: item.product,
                indentNumber: item.indentNo,
                vendorName: '',
                rate: undefined,
                paymentTerm: '',
                vendors: isThreeParty ? Array.from({ length: 10 }, () => ({ vendorName: '', rate: undefined, paymentTerm: '' })) : []
            }))
        }
    });

    const onSubmit = async (values: any) => {
        try {
            let commonUrl = '';
            if (isThreeParty && values.comparisonSheet) {
                commonUrl = await uploadFile(values.comparisonSheet, import.meta.env.VITE_COMPARISON_SHEET_FOLDER);
            }

            const now = formatDate(new Date());
            const indentNumber = items[0]?.indentNo;

            // 1. Prepare payload for INDENT table update (set actual2 date)
            const indentPayload = values.updates.map((update: any) => {
                // Find the item from indentSheet directly using serialNumber
                const sheetItem = indentSheet.find(s => String(s.searialNumber) === String(update.searialNumber));
                const rowIndex = sheetItem?.rowIndex;

                if (!rowIndex && rowIndex !== 0) {
                    console.warn(`Could not find rowIndex for serialNumber: ${update.searialNumber}`);
                }

                if (isThreeParty) {
                    const partyPayload: any = {
                        rowIndex,
                        indentNumber: update.indentNumber || '',
                        actual2: now,
                        status: 'Approved',
                        comparisonSheet: commonUrl || ''
                    };
                    
                    if (update.vendors && Array.isArray(update.vendors)) {
                        update.vendors.forEach((v: any, i: number) => {
                            if (v.vendorName) {
                                partyPayload[`vendorName${i + 1}`] = v.vendorName || '';
                                partyPayload[`rate${i + 1}`] = (v.rate || 0).toString();
                                partyPayload[`paymentTerm${i + 1}`] = v.paymentTerm || '';
                            }
                        });
                    }
                    return partyPayload;
                } else {
                    return {
                        rowIndex,
                        indentNumber: update.indentNumber || '',
                        actual2: now,
                        status: 'Approved',
                        vendorName1: update.vendorName || '',
                        rate1: (update.rate || 0).toString(),
                        paymentTerm1: update.paymentTerm || '',
                        approvedVendorName: update.vendorName || '',
                        approvedRate: update.rate || 0,
                        approvedPaymentTerm: update.paymentTerm || '',
                    };
                }
            });

            // 2. Prepare payloads for VENDOR_RATE_UPDATE table (one per item)
            const vendorRateUpdatePayloads = values.updates.map((update: any) => {
                const payload: any = {
                    timestamp: now,
                    indent_number: update.indentNumber || '',
                    comparison_sheet: commonUrl || '',
                    delay: 'None',
                    planned_3: now,
                    status: 'Approved',
                };

                if (isThreeParty) {
                    if (update.vendors && Array.isArray(update.vendors)) {
                        update.vendors.forEach((v: any, vIndex: number) => {
                            if (v.vendorName && vIndex < 3) {
                                payload[`vendor_name_${vIndex + 1}`] = v.vendorName || '';
                                payload[`rate_${vIndex + 1}`] = v.rate || 0;
                                payload[`payment_term_${vIndex + 1}`] = v.paymentTerm || '';
                            }
                        });
                    }
                } else {
                    payload.vendor_name_1 = update.vendorName || '';
                    payload.rate_1 = update.rate || 0;
                    payload.payment_term_1 = update.paymentTerm || '';
                }
                return payload;
            });

            console.log('📦 Final vendorRateUpdatePayloads count:', vendorRateUpdatePayloads.length);

            // Execute all updates
            console.log('📝 Step 1: Updating INDENT table...');
            await postToSheet(indentPayload, 'update', 'INDENT');
            console.log('✅ INDENT table updated successfully');

            console.log('📝 Step 2: Inserting into VENDOR_RATE_UPDATE table...');
            try {
                await postToSheet(vendorRateUpdatePayloads, 'insert', 'VENDOR RATE UPDATE');
                console.log('✅ VENDOR_RATE_UPDATE table inserted successfully');
            } catch (vendorError) {
                console.error('⚠️ VENDOR_RATE_UPDATE insert failed, but continuing:', vendorError);
            }
                
                // Update ALL approved_indent records sharing this base indent number
                const baseIndentNo = indentNumber.split(/[_/]/)[0];
                const aiUpdates = approvedIndentSheet
                    .filter((record: any) => (record.indentNumber || '').split(/[_/]/)[0] === baseIndentNo && record.status === 'Pending')
                    .map((record: any) => ({
                        id: record.id,
                        status: 'Approved',
                    }));
                
                if (aiUpdates.length > 0) {
                    console.log(`📝 Step 3: Updating ${aiUpdates.length} APPROVED_INDENT status records...`);
                    await postToSheet(aiUpdates, 'update', 'APPROVED INDENT');
                    console.log('✅ APPROVED_INDENT statuses updated successfully');
                } else {
                    console.warn('⚠️ No pending approved indent records found for:', baseIndentNo);
                }

                toast.success(`Updated ${items.length} items successfully`);
                onSuccess();
            } catch (error: any) {
                console.error('❌ Error during database operations:', error);
                const errorMessage = error?.message || error?.error?.message || 'Unknown error occurred';
                console.error('Error details:', errorMessage);
                
                if (!errorMessage.includes('Failed to update:')) {
                    toast.error(`Failed to update: ${errorMessage}`);
                }
                throw error;
            }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {isThreeParty && (
                    <div className="border-b pb-4 mb-4">
                        <FormField
                            control={form.control}
                            name="comparisonSheet"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-bold">Comparison Sheet (Entire Indent)</FormLabel>
                                    <FormControl><Input type="file" onChange={(e) => field.onChange(e.target.files?.[0])} className="h-9" /></FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                )}

                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                    {items.map((item: any, index: number) => (
                        <div key={item.searialNumber || index} className="border p-4 rounded-md bg-muted/20 space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-semibold text-sm text-primary">{item.product}</span>
                                <span className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded">Qty: {item.quantity} {item.uom} | S.No: {item.searialNumber}</span>
                            </div>

                            {!isThreeParty ? (
                                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-4 items-end">
                                     <FormField
                                         control={form.control}
                                         name={`updates.${index}.vendorName`}
                                         render={({ field }) => (
                                             <FormItem className="min-w-0">
                                                 <FormLabel className="text-xs">Vendor</FormLabel>
                                                 <Select
                                                     onValueChange={(val) => {
                                                         field.onChange(val);
                                                         form.getValues('updates').forEach((_: any, i: number) => {
                                                             form.setValue(`updates.${i}.vendorName`, val);
                                                         });
                                                     }}
                                                     value={field.value}
                                                     onOpenChange={(open) => !open && setVendorSearch("")}
                                                 >
                                                     <FormControl>
                                                         <SelectTrigger className="h-9 w-full overflow-hidden">
                                                             <div className="truncate text-left flex-1">
                                                                 <SelectValue placeholder="Vendor" />
                                                             </div>
                                                         </SelectTrigger>
                                                     </FormControl>
                                                     <SelectContent>
                                                         <div className="px-2 py-1">
                                                             <Input placeholder="Search..." className="h-8" value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} />
                                                         </div>
                                                         <div className="max-h-[150px] overflow-y-auto">
                                                             {vendors?.filter((v: any) => v.vendorName.toLowerCase().includes(vendorSearch.toLowerCase())).map((v: any, i: number) => (
                                                                 <SelectItem key={i} value={v.vendorName}>{v.vendorName}</SelectItem>
                                                             ))}
                                                         </div>
                                                     </SelectContent>
                                                 </Select>
                                             </FormItem>
                                         )}
                                     />
                                     <FormField
                                         control={form.control}
                                         name={`updates.${index}.rate`}
                                         render={({ field }) => (
                                             <FormItem>
                                                 <FormLabel className="text-xs">Rate</FormLabel>
                                                 <FormControl><Input type="number" {...field} className="h-9" /></FormControl>
                                             </FormItem>
                                         )}
                                     />
                                     <FormField
                                         control={form.control}
                                         name={`updates.${index}.paymentTerm`}
                                         render={({ field }) => (
                                             <FormItem className="min-w-0">
                                                 <FormLabel className="text-xs">Term</FormLabel>
                                                 <Select
                                                     onValueChange={(val) => {
                                                         field.onChange(val);
                                                         form.getValues('updates').forEach((_: any, i: number) => {
                                                             form.setValue(`updates.${i}.paymentTerm`, val);
                                                         });
                                                     }}
                                                     value={field.value}
                                                 >
                                                     <FormControl>
                                                         <SelectTrigger className="h-9 w-full overflow-hidden">
                                                             <div className="truncate text-left flex-1">
                                                                 <SelectValue placeholder="Terms" />
                                                             </div>
                                                         </SelectTrigger>
                                                     </FormControl>
                                                     <SelectContent>
                                                         {options?.paymentTerms?.map((term: string, i: number) => <SelectItem key={i} value={term}>{term}</SelectItem>)}
                                                     </SelectContent>
                                                 </Select>
                                             </FormItem>
                                         )}
                                     />
                                </div>
                            ) : (
                                <ThreePartyFields index={index} form={form} vendors={vendors} options={options} />
                            )}
                        </div>
                    ))}
                </div>

                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                    {form.formState.isSubmitting ? <Loader size={16} color="white" /> : `Update ${items.length} Items`}
                </Button>
            </form>
        </Form>
    );
};

export default () => {
    const { indentSheet, indentLoading, updateIndentSheet, updateApprovedIndentSheet, approvedIndentSheet, masterSheet: options, vendorRateUpdateSheet, updateVendorRateUpdateSheet } = useSheets();
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<GroupedVendorUpdateData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<GroupedHistoryData | null>(null);
    const [historyData, setHistoryData] = useState<GroupedHistoryData[]>([]);
    const [tableData, setTableData] = useState<GroupedVendorUpdateData[]>([]);
    const [vendors, setVendors] = useState([]);
    const [vendorsLoading, setVendorsLoading] = useState(true);

    useEffect(() => {
        if (options?.vendors) {
            setVendors(options.vendors);
            setVendorsLoading(false);
        } else {
            const loadVendors = async () => {
                setVendorsLoading(true);
                const vendorsList = await fetchVendors();
                setVendors(vendorsList);
                setVendorsLoading(false);
            };
            loadVendors();
        }
    }, [options]);

    useEffect(() => {
        // PENDING TAB: Show data where vendor_rate_update status is 'Pending' or doesn't exist yet
        const pendingVendorUpdates = vendorRateUpdateSheet.filter(
            (vru) => vru.status?.trim().toLowerCase() === 'pending' || !vru.status
        );

        const pendingIndentNumbers = new Set(pendingVendorUpdates.map(vru => vru.indentNumber));

        // Get all approved indents that need vendor update
        const pendingApprovedIndents = approvedIndentSheet.filter(
            (approved) => approved.status?.trim().toLowerCase() === 'pending' && approved.vendorType === 'Regular'
        );

        const pendingItems = indentSheet
            .filter((sheet) => {
                // Check if this indent has pending vendor rate update OR needs vendor update
                const hasPendingVendorUpdate = pendingIndentNumbers.has(sheet.indentNumber);
                const hasPendingApproval = pendingApprovedIndents.some(
                    (approved) => approved.indentNumber === sheet.indentNumber
                );
                // Show in pending if it has pending vendor update OR needs vendor update (not in vendorRateUpdateSheet yet)
                return hasPendingVendorUpdate || (hasPendingApproval && !pendingIndentNumbers.has(sheet.indentNumber));
            })
            .map((sheet, idx) => {
                // Get vendorType from approvedIndentSheet if not in indentSheet
                const approvedRecord = pendingApprovedIndents.find(
                    (approved) => approved.indentNumber === sheet.indentNumber
                );
                
                // Use vendorType from approved_indent first, then indent_sheet, then default to 'Regular'
                const vendorType = (approvedRecord?.vendorType || sheet.vendorType || 'Regular') as VendorUpdateData['vendorType'];
                
                console.log(`📋 Indent ${sheet.indentNumber} - VendorType:`, vendorType);
                
                return {
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    quantity: sheet.approvedQuantity,
                    uom: sheet.uom,
                    vendorType: vendorType,
                    vendorName: sheet.approvedVendorName || sheet.vendorName1 || '',
                    searialNumber: sheet.searialNumber,
                    rowIndex: (sheet as any).rowIndex ?? idx,
                    timestamp: sheet.timestamp,
                };
            });

        const groupedPending = pendingItems.reduce((acc, item) => {
            const baseNo = item.indentNo.split(/[_/]/)[0];
            if (!acc[baseNo]) {
                acc[baseNo] = {
                    indentNo: baseNo,
                    indenter: item.indenter,
                    department: item.department,
                    vendorType: item.vendorType,
                    date: item.timestamp, // Store raw timestamp
                    items: [],
                };
            }
            // Update to latest timestamp in group
            if (item.timestamp && (!acc[baseNo].date || new Date(item.timestamp) > new Date(acc[baseNo].date))) {
                acc[baseNo].date = item.timestamp;
            }
            acc[baseNo].items.push(item);
            return acc;
        }, {} as Record<string, GroupedVendorUpdateData & { date: string }>);

        setTableData(
            Object.values(groupedPending).sort((a, b) => {
                const latestA = Math.max(...a.items.map(i => (i as any).timestamp ? new Date((i as any).timestamp).getTime() : 0));
                const latestB = Math.max(...b.items.map(i => (i as any).timestamp ? new Date((i as any).timestamp).getTime() : 0));
                return latestB - latestA;
            })
        );

        // HISTORY TAB: Show data where vendor_rate_update status is 'Approved'
        const approvedVendorUpdates = vendorRateUpdateSheet.filter(
            (vru) => vru.status?.trim().toLowerCase() === 'approved'
        );

        const approvedIndentNumbers = new Set(approvedVendorUpdates.map(vru => vru.indentNumber));

        const historyItems = indentSheet
            .filter((sheet) => {
                // Check if this indent has an approved vendor rate update
                return approvedIndentNumbers.has(sheet.indentNumber);
            })
            .map((sheet) => ({
                date: formatDate(new Date(sheet.actual2)),
                indentNo: sheet.indentNumber,
                indenter: sheet.indenterName,
                department: sheet.department,
                product: sheet.productName,
                quantity: sheet.quantity,
                uom: sheet.uom,
                rate: sheet.approvedRate || 0,
                vendorType: sheet.vendorType as HistoryData['vendorType'],
                vendorName: sheet.approvedVendorName || sheet.vendorName1 || '',
                searialNumber: sheet.searialNumber,
                timestamp: sheet.timestamp,
                actual2: sheet.actual2, // This is often used as the vendor update date
            }));

        const groupedHistory = historyItems.reduce((acc, item) => {
            const baseNo = item.indentNo.split(/[_/]/)[0];
            if (!acc[baseNo]) {
                acc[baseNo] = {
                    indentNo: baseNo,
                    indenter: item.indenter,
                    department: item.department,
                    date: item.date,
                    items: [],
                };
            }
            acc[baseNo].items.push(item);
            return acc;
        }, {} as Record<string, GroupedHistoryData>);

        setHistoryData(
            Object.values(groupedHistory).sort((a, b) => {
                const latestA = Math.max(...a.items.map(i => {
                    const ts = (i as any).actual2 || (i as any).timestamp;
                    return ts ? new Date(ts).getTime() : 0;
                }));
                const latestB = Math.max(...b.items.map(i => {
                    const ts = (i as any).actual2 || (i as any).timestamp;
                    return ts ? new Date(ts).getTime() : 0;
                }));
                return latestB - latestA;
            })
        );
    }, [indentSheet, approvedIndentSheet, vendorRateUpdateSheet]);

    const columns: ColumnDef<GroupedVendorUpdateData>[] = [
        ...(user.updateVendorAction
            ? [
                {
                    header: 'Action',
                    id: 'action',
                    cell: ({ row }: { row: Row<GroupedVendorUpdateData> }) => (
                        <div className="flex justify-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedIndent(row.original)}
                                className="h-8 text-xs font-bold border-primary/20 text-primary hover:bg-primary/5"
                            >
                                Update ({row.original.items.length})
                            </Button>
                        </div>
                    ),
                    size: 100,
                },
            ]
            : []),
        {
            accessorKey: 'date',
            id: 'date',
            header: () => <div className="text-center">Date</div>,
            cell: ({ getValue }) => {
                const val = getValue() as string;
                if (!val) return <div className="text-center">-</div>;
                const d = new Date(val);
                return (
                    <div className="flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-bold text-foreground">
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
            accessorKey: 'indentNo',
            id: 'indentNo',
            header: () => <div className="text-center">Indent No.</div>,
            cell: ({ getValue }) => (
                <div className="font-bold text-xs sm:text-sm text-center">
                    {(getValue() as string).split(/[_/]/)[0]}
                </div>
            ),
            size: 100,
        },
        { 
            accessorKey: 'indenter', 
            id: 'indenter',
            header: () => <div className="text-center">Indenter</div>,
            cell: ({ getValue }) => <div className="text-xs font-medium text-center">{(getValue() as string)}</div>,
            size: 140 
        },
        { 
            accessorKey: 'department', 
            id: 'department',
            header: () => <div className="text-center">Department</div>,
            cell: ({ getValue }) => <div className="text-xs text-center">{(getValue() as string) || '-'}</div>,
            size: 130 
        },
        {
            accessorKey: 'items',
            id: 'products',
            header: () => <div className="text-center">Products</div>,
            cell: ({ row }) => (
                <div className="max-w-[250px] mx-auto text-center break-words whitespace-normal text-xs leading-tight">
                    {row.original.items.map(i => i.product).join(', ')}
                </div>
            ),
            size: 250,
        },
        {
            accessorKey: 'vendorType',
            id: 'vendorType',
            header: () => <div className="text-center">Vendor Type</div>,
            cell: ({ row }) => {
                const vendorType = row.original.vendorType || 'Regular';
                const variant = vendorType === 'Regular' ? 'primary' : 'secondary';
                return (
                    <div className="flex justify-center">
                        <Pill variant={variant}>{vendorType}</Pill>
                    </div>
                );
            },
            size: 120,
        },
    ];

    const historyColumns: ColumnDef<GroupedHistoryData>[] = [
        ...(user.updateVendorAction ? [
            {
                id: 'action_history',
                header: () => <div className="text-center">Action</div>,
                cell: ({ row }: { row: Row<GroupedHistoryData> }) => (
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedHistory(row.original)}
                            className="h-8 text-xs font-bold border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                            View ({row.original.items.length})
                        </Button>
                    </div>
                ),
                size: 100,
            },
        ] : []),
        {
            accessorKey: 'date',
            id: 'date_history',
            header: () => <div className="text-center">Date</div>,
            cell: ({ getValue }) => (
                <div className="text-xs font-medium text-center">
                    {getValue() as string}
                </div>
            ),
            size: 110,
        },
        {
            accessorKey: 'indentNo',
            id: 'indentNo_history',
            header: () => <div className="text-center">Indent No.</div>,
            cell: ({ getValue }) => (
                <div className="font-bold text-xs sm:text-sm text-center">
                    {(getValue() as string).split(/[_/]/)[0]}
                </div>
            ),
            size: 100,
        },
        { 
            accessorKey: 'indenter', 
            id: 'indenter_history',
            header: () => <div className="text-center">Indenter</div>,
            cell: ({ getValue }) => <div className="text-xs font-medium text-center">{(getValue() as string)}</div>,
            size: 140 
        },
        { 
            accessorKey: 'department', 
            id: 'department_history',
            header: () => <div className="text-center">Department</div>,
            cell: ({ getValue }) => <div className="text-center text-xs">{(getValue() as string) || '-'}</div>,
            size: 130 
        },
        {
            accessorKey: 'items',
            id: 'products_history',
            header: () => <div className="text-center">Products</div>,
            cell: ({ row }) => (
                <div className="max-w-[250px] mx-auto text-center break-words whitespace-normal text-xs leading-tight">
                    {row.original.items.map(i => i.product).join(', ')}
                </div>
            ),
            size: 250,
        },
    ];

    return (
        <div>
            <Dialog open={!!(selectedIndent || selectedHistory)} onOpenChange={(open) => {
                if (!open) {
                    setSelectedIndent(null);
                    setSelectedHistory(null);
                }
            }}>
                <Tabs defaultValue="pending">
                    <Heading heading="Vendor Rate Update" subtext="Update vendors for Regular and Three Party indents" tabs>
                        <UserCheck size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['indentNo', 'department', 'indenter']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['indentNo', 'department', 'indenter']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                </Tabs>

                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {selectedIndent && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Update Vendor Rates - {selectedIndent.indentNo}</DialogTitle>
                                <DialogDescription>
                                    {selectedIndent.indenter} | {selectedIndent.department} | {selectedIndent.vendorType}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6 py-4">
                                <VendorUpdateForm
                                    items={selectedIndent.items}
                                    vendorType={selectedIndent.vendorType}
                                    vendors={vendors}
                                    options={options}
                                    onSuccess={() => {
                                        setSelectedIndent(null);
                                        setTimeout(() => {
                                            updateIndentSheet();
                                            updateApprovedIndentSheet();
                                            updateVendorRateUpdateSheet();
                                        }, 1000);
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {selectedHistory && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Indent History - {selectedHistory.indentNo}</DialogTitle>
                                <DialogDescription>
                                    {selectedHistory.indenter} | {selectedHistory.department} | {selectedHistory.date}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <table className="w-full text-sm">
                                    <thead className="bg-primary">
                                        <tr className="border-b text-primary-foreground font-bold">
                                            <th className="text-left py-2">Product</th>
                                            <th className="text-left py-2">Qty</th>
                                            <th className="text-left py-2">Rate</th>
                                            <th className="text-left py-2">Vendor</th>
                                            <th className="text-left py-2">S.No</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedHistory.items.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0">
                                                <td className="py-2">{item.product}</td>
                                                <td className="py-2">{item.quantity} {item.uom}</td>
                                                <td className="py-2">₹{item.rate}</td>
                                                <td className="py-2">{item.vendorName}</td>
                                                <td className="py-2">{item.searialNumber || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

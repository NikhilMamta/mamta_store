import { useDatabase } from '@/context/DatabaseContext';
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
import { postToDB, uploadFileToSupabase, fetchVendors } from '@/lib/fetchers';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

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
        <Tabs defaultValue="0" className="border rounded-lg p-4 bg-background shadow-sm">
            <TabsList className="bg-muted/50 overflow-x-auto h-10 w-full justify-start p-1">
                {fields.map((_, i) => (
                    <TabsTrigger 
                        key={i} 
                        value={`${i}`} 
                        className="px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-primary"
                    >
                        Vendor {i + 1}
                    </TabsTrigger>
                ))}
            </TabsList>
            {fields.map((field, vIndex) => (
                <TabsContent 
                    key={field.id} 
                    value={`${vIndex}`} 
                    className="grid grid-cols-1 md:grid-cols-[3.5fr_1.5fr_2fr] gap-4 pt-4 items-end animate-in fade-in-50 duration-200"
                >
                    <FormField
                        control={form.control}
                        name={`updates.${index}.vendors.${vIndex}.vendorName`}
                        render={({ field }) => (
                            <FormItem className="min-w-0">
                                <FormLabel className="text-xs font-semibold text-muted-foreground">Select Vendor {vIndex + 1}</FormLabel>
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
                                        <SelectTrigger className="h-10 text-sm w-full overflow-hidden bg-white">
                                            <div className="truncate text-left flex-1">
                                                <SelectValue placeholder="Select Vendor" />
                                            </div>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {vendors?.map((v: any, i: number) => (
                                            <SelectItem key={i} value={v.vendorName}>{v.vendorName}</SelectItem>
                                        ))}
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
                                <FormLabel className="text-xs font-semibold text-muted-foreground">Rate (₹)</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="number" 
                                        {...field} 
                                        className="h-10 text-sm bg-white" 
                                        placeholder="0.00"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`updates.${index}.vendors.${vIndex}.paymentTerm`}
                        render={({ field }) => (
                            <FormItem className="min-w-0">
                                <FormLabel className="text-xs font-semibold text-muted-foreground">Payment Term</FormLabel>
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
                                        <SelectTrigger className="h-10 text-sm w-full overflow-hidden bg-white">
                                            <div className="truncate text-left flex-1">
                                                <SelectValue placeholder="Select Term" />
                                            </div>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {options?.paymentTerms?.map((term: string, i: number) => (
                                            <SelectItem key={i} value={term}>{term}</SelectItem>
                                        ))}
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
    const { indentData, approvedIndentData, updateIndentData, updateApprovedIndentData, vendorRateUpdateData, updateVendorRateUpdateData } = useDatabase();
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
                try {
                    commonUrl = await uploadFileToSupabase(values.comparisonSheet, 'pdf');
                } catch (err) {
                    console.error("Supabase Storage upload error:", err);
                    toast.error("Failed to upload comparison sheet to Supabase.");
                    return;
                }
            }

            const now = formatDate(new Date());
            const indentNumber = items[0]?.indentNo;

            // 1. Prepare payload for INDENT table update (set actual2 date)
            const indentPayload = values.updates.map((update: any) => {
                // Find the item from indentData directly using serialNumber
                const sheetItem = indentData.find(s => String(s.searialNumber) === String(update.searialNumber));
                const id = sheetItem?.id;

                if (!id) {
                    console.warn(`Could not find id for serialNumber: ${update.searialNumber}`);
                }

                if (isThreeParty) {
                    const partyPayload: any = {
                        id,
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
                        id,
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
                    status: isThreeParty ? 'Pending' : 'Approved',
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
            await postToDB(indentPayload, 'update', 'INDENT');
            console.log('✅ INDENT table updated successfully');

            console.log('📝 Step 2: Inserting into VENDOR_RATE_UPDATE table...');
            try {
                await postToDB(vendorRateUpdatePayloads, 'insert', 'VENDOR RATE UPDATE');
                console.log('✅ VENDOR_RATE_UPDATE table inserted successfully');
            } catch (vendorError) {
                console.error('⚠️ VENDOR_RATE_UPDATE insert failed, but continuing:', vendorError);
            }
                
                // Update ALL approved_indent records sharing this base indent number
                const baseIndentNo = indentNumber.split(/[_/]/)[0];
                const aiUpdates = approvedIndentData
                    .filter((record: any) => (record.indentNumber || '').split(/[_/]/)[0] === baseIndentNo && record.status === 'Pending')
                    .map((record: any) => ({
                        id: record.id,
                        status: 'Approved',
                    }));
                
                if (aiUpdates.length > 0) {
                    console.log(`📝 Step 3: Updating ${aiUpdates.length} APPROVED_INDENT status records...`);
                    await postToDB(aiUpdates, 'update', 'APPROVED INDENT');
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

                <div className="space-y-6">
                    {items.map((item: any, index: number) => (
                        <div key={item.searialNumber || index} className="border p-4 rounded-md bg-muted/20 space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-semibold text-sm text-primary">{item.product}</span>
                                <span className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded">Qty: {item.quantity} {item.uom} | S.No: {item.searialNumber}</span>
                            </div>

                            {!isThreeParty ? (
                                <div className="grid grid-cols-1 md:grid-cols-[3.5fr_1.5fr_2fr] gap-6 items-end p-2">
                                     <FormField
                                         control={form.control}
                                         name={`updates.${index}.vendorName`}
                                         render={({ field }) => (
                                             <FormItem className="min-w-0">
                                                 <FormLabel className="text-xs font-semibold text-muted-foreground">Select Vendor</FormLabel>
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
                                                         <SelectTrigger className="h-10 w-full overflow-hidden bg-white">
                                                             <div className="truncate text-left flex-1">
                                                                 <SelectValue placeholder="Search or select vendor" />
                                                             </div>
                                                         </SelectTrigger>
                                                     </FormControl>
                                                     <SelectContent>
                                                         <div className="px-2 py-2">
                                                             <Input 
                                                                placeholder="Search vendors..." 
                                                                className="h-9" 
                                                                value={vendorSearch} 
                                                                onChange={(e) => setVendorSearch(e.target.value)} 
                                                             />
                                                         </div>
                                                         <div className="max-h-[200px] overflow-y-auto">
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
                                                 <FormLabel className="text-xs font-semibold text-muted-foreground">Rate (₹)</FormLabel>
                                                 <FormControl>
                                                     <Input 
                                                        type="number" 
                                                        {...field} 
                                                        className="h-10 bg-white" 
                                                        placeholder="0.00"
                                                     />
                                                 </FormControl>
                                             </FormItem>
                                         )}
                                     />
                                     <FormField
                                         control={form.control}
                                         name={`updates.${index}.paymentTerm`}
                                         render={({ field }) => (
                                             <FormItem className="min-w-0">
                                                 <FormLabel className="text-xs font-semibold text-muted-foreground">Payment Term</FormLabel>
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
                                                         <SelectTrigger className="h-10 w-full overflow-hidden bg-white">
                                                             <div className="truncate text-left flex-1">
                                                                 <SelectValue placeholder="Select term" />
                                                             </div>
                                                         </SelectTrigger>
                                                     </FormControl>
                                                     <SelectContent>
                                                         {options?.paymentTerms?.map((term: string, i: number) => (
                                                            <SelectItem key={i} value={term}>{term}</SelectItem>
                                                         ))}
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
    const { indentData, indentLoading, updateIndentData, updateApprovedIndentData, approvedIndentData, masterData: options, vendorRateUpdateData, updateVendorRateUpdateData } = useDatabase();
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
        const pendingVendorUpdates = vendorRateUpdateData.filter(
            (vru) => vru.status?.trim().toLowerCase() === 'pending' || !vru.status
        );

        const pendingIndentNumbers = new Set(pendingVendorUpdates.map(vru => vru.indentNumber));

        // Get all approved indents that need vendor update
        const pendingApprovedIndents = approvedIndentData.filter(
            (approved) => approved.status?.trim().toLowerCase() === 'pending' && approved.vendorType === 'Regular'
        );

        const pendingItems = indentData
            .filter((sheet) => {
                // Check if this indent has pending vendor rate update OR needs vendor update
                const hasPendingVendorUpdate = pendingIndentNumbers.has(sheet.indentNumber);
                const hasPendingApproval = pendingApprovedIndents.some(
                    (approved) => approved.indentNumber === sheet.indentNumber
                );
                // Show in pending if it has pending vendor update OR needs vendor update (not in vendorRateUpdateData yet)
                return hasPendingVendorUpdate || (hasPendingApproval && !pendingIndentNumbers.has(sheet.indentNumber));
            })
            .map((sheet, idx) => {
                // Get vendorType from approvedIndentData if not in indentData
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
                    searialNumber: sheet.searialNumber || sheet.serialNumber || (sheet.indentNumber?.includes('_') ? sheet.indentNumber.split('_').pop() : sheet.indentNumber?.includes('/') ? sheet.indentNumber.split('/').pop() : '-'),
                    id: sheet.id || idx,
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
                    items: [],
                };
            }
            acc[baseNo].items.push(item);
            return acc;
        }, {} as Record<string, GroupedVendorUpdateData>);

        setTableData(Object.values(groupedPending).reverse());

        // HISTORY TAB: Show data where vendor_rate_update status is 'Approved'
        const approvedVendorUpdates = vendorRateUpdateData.filter(
            (vru) => vru.status?.trim().toLowerCase() === 'approved'
        );

        const approvedIndentNumbers = new Set(approvedVendorUpdates.map(vru => vru.indentNumber));

        const historyItems = indentData
            .filter((sheet) => {
                // Check if this indent has an approved vendor rate update
                return approvedIndentNumbers.has(sheet.indentNumber);
            })
            .map((sheet) => {
                const vru = vendorRateUpdateData.find(v => v.indentNumber === sheet.indentNumber && v.status?.trim().toLowerCase() === 'approved');
                return {
                    date: vru ? formatDate(new Date(vru.timestamp)) : (sheet.timestamp ? formatDate(new Date(sheet.timestamp)) : 'N/A'),
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    quantity: sheet.quantity,
                    uom: sheet.uom,
                    rate: vru?.rate1 || sheet.approvedRate || 0,
                    vendorType: sheet.vendorType as HistoryData['vendorType'],
                    vendorName: vru?.vendorName1 || sheet.approvedVendorName || sheet.vendorName1 || '',
                    searialNumber: sheet.searialNumber || sheet.serialNumber || (sheet.indentNumber?.includes('_') ? sheet.indentNumber.split('_').pop() : sheet.indentNumber?.includes('/') ? sheet.indentNumber.split('/').pop() : '-'),
                };
            });

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

        setHistoryData(Object.values(groupedHistory).reverse());
    }, [indentData, approvedIndentData, vendorRateUpdateData]);

    const columns: ColumnDef<GroupedVendorUpdateData>[] = [
        ...(user.updateVendorAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<GroupedVendorUpdateData> }) => (
                        <Button
                            variant="outline"
                            onClick={() => setSelectedIndent(row.original)}
                        >
                            Update ({row.original.items.length})
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
        {
            accessorKey: 'vendorType',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const vendorType = row.original.vendorType || 'Regular';
                const variant = vendorType === 'Regular' ? 'primary' : 'secondary';
                return <Pill variant={variant}>{vendorType}</Pill>;
            },
        },
    ];

    const historyColumns: ColumnDef<GroupedHistoryData>[] = [
        ...(user.updateVendorAction ? [
            {
                header: 'Action',
                cell: ({ row }: { row: Row<GroupedHistoryData> }) => (
                    <Button
                        variant="outline"
                        onClick={() => setSelectedHistory(row.original)}
                    >
                        View ({row.original.items.length})
                    </Button>
                ),
            },
        ] : []),
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

                <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden rounded-xl">
                    {selectedIndent && (
                        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                            <DialogHeader className="p-6 bg-primary text-primary-foreground flex-none">
                                <DialogTitle className="text-2xl font-bold">Update Vendor Rates - {selectedIndent.indentNo}</DialogTitle>
                                <DialogDescription className="text-primary-foreground/80 font-medium">
                                    {selectedIndent.indenter} | {selectedIndent.department} | {selectedIndent.vendorType}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <VendorUpdateForm
                                    items={selectedIndent.items}
                                    vendorType={selectedIndent.vendorType}
                                    vendors={vendors}
                                    options={options}
                                    onSuccess={() => {
                                        setSelectedIndent(null);
                                        setTimeout(() => {
                                            updateIndentData();
                                            updateApprovedIndentData();
                                            updateVendorRateUpdateData();
                                        }, 1000);
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {selectedHistory && (
                        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                            <DialogHeader className="p-6 bg-primary text-primary-foreground flex-none">
                                <DialogTitle className="text-2xl font-bold">Indent History - {selectedHistory.indentNo}</DialogTitle>
                                <DialogDescription className="text-primary-foreground/80 font-medium">
                                    {selectedHistory.indenter} | {selectedHistory.department} | {selectedHistory.date}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <div className="border rounded-lg overflow-hidden shadow-sm">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="font-bold text-primary">S.No</TableHead>
                                                <TableHead className="font-bold text-primary">Product</TableHead>
                                                <TableHead className="font-bold text-primary">Qty</TableHead>
                                                <TableHead className="font-bold text-primary">Rate</TableHead>
                                                <TableHead className="font-bold text-primary">Vendor</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedHistory.items.map((item, idx) => (
                                                <TableRow key={idx} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="py-3 font-medium">{item.searialNumber || '-'}</TableCell>
                                                    <TableCell className="py-3">{item.product}</TableCell>
                                                    <TableCell className="py-3">{item.quantity} {item.uom}</TableCell>
                                                    <TableCell className="py-3">₹{Number(item.rate).toLocaleString('en-IN')}</TableCell>
                                                    <TableCell className="py-3">{item.vendorName || <span className="text-muted-foreground italic text-xs">Not specified</span>}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="p-6 bg-muted/20 border-t flex-none">
                        <DialogClose asChild>
                            <Button variant="outline" className="px-8">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

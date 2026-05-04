import { ChevronsRightLeft, FilePlus2, Pencil, Save, Trash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { z } from 'zod';
import { Button } from '../ui/button';
import { SidebarTrigger } from '../ui/sidebar';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import type { PoHistorySheet, PoMasterSheet } from '@/types';
import { postToSheet, uploadFile, uploadFileToSupabase, postToPoHistory, fetchVendorDetails } from '@/lib/fetchers';
import { useEffect, useState } from 'react';
import { useSheets } from '@/context/SheetsContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
    calculateGrandTotal,
    calculateSubtotal,
    calculateTotal,
    calculateTotalGst,
    cn,
    formatDate,
} from '@/lib/utils';
import { toast } from 'sonner';
import { ClipLoader as Loader } from 'react-spinners';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '../ui/textarea';
import { pdf } from '@react-pdf/renderer';
import POPdf, { type POPdfProps } from '../element/POPdf';

function generatePoNumber(poNumbers: string[], today = new Date()): string {
    // Step 1: Get financial year from today's date
    const fyStart = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
    const fy = `${(fyStart % 100).toString().padStart(2, '0')}-${((fyStart + 1) % 100).toString().padStart(2, '0')}`;

    const prefix = `MSH/STORES/${fy}/`;

    // Step 2: Extract numbers for curre nt financial year
    const numbersInFY = poNumbers
        .filter((po) => po && typeof po === 'string' && po.includes(`/${fy}/`))
        .map((po) => {
            const match = po.match(/\/(\d+)(?:-\d+)?$/); // gets '80' from '80-2'
            return match ? parseInt(match[1], 10) : null;
        })
        .filter((n): n is number => n !== null);

    // Step 3: Determine next number
    const next = numbersInFY.length > 0 ? Math.max(...numbersInFY) + 1 : 1;

    return `${prefix}${next}`;
}

function incrementPoRevision(poNumber: string, allPOs: PoMasterSheet[]): string {
    const parts = poNumber.split('/');
    const lastSegment = parts[parts.length - 1];

    const [mainSeq, _] = lastSegment.split('-');
    const baseKey = [...parts.slice(0, -1), mainSeq].join('/');

    let maxRevision = 0;

    for (const po of allPOs) {
        const poParts = po.poNumber.split('/');
        const poLastSegment = poParts[poParts.length - 1];
        const [poSeq, poRev] = poLastSegment.split('-');

        const poBaseKey = [...poParts.slice(0, -1), poSeq].join('/');
        if (poBaseKey === baseKey) {
            const revision = poRev ? parseInt(poRev, 10) : 0;
            if (revision > maxRevision) {
                maxRevision = revision;
            }
        }
    }

    return `${baseKey}-${maxRevision + 1}`;
}

function filterUniquePoNumbers(data: PoMasterSheet[]): PoMasterSheet[] {
    const seen = new Set<string>();
    const result: PoMasterSheet[] = [];

    for (const po of data) {
        if (!seen.has(po.poNumber)) {
            seen.add(po.poNumber);
            result.push(po);
        }
    }

    return result;
}

export default () => {
    const {
        indentSheet,
        poMasterSheet,
        updateIndentSheet,
        updatePoMasterSheet,
        masterSheet: details,
        threePartyApprovalSheet,
        approvedIndentSheet,
        poHistorySheet,
        updatePoHistorySheet,
        updateThreePartyApprovalSheet
    } = useSheets();
    const [readOnly, setReadOnly] = useState(-1);
    const [mode, setMode] = useState<'create' | 'revise'>('create');
    const [isEditingDestination, setIsEditingDestination] = useState(false);
    const [destinationAddress, setDestinationAddress] = useState('');
    const [pendingIndentNumbers, setPendingIndentNumbers] = useState<Set<string>>(new Set());

    // Initialize destination address from details
    useEffect(() => {
        if (details?.destinationAddress) {
            setDestinationAddress(details.destinationAddress);
        }
    }, [details]);

    // Calculate pending indent numbers (same logic as Pending POs page)
    useEffect(() => {
        const indentNumbers = new Set<string>();

        // 1. Filter Approved Indents from APPROVED_INDENT table where status is 'Approved'
        approvedIndentSheet
            .filter((approved) => approved.status?.trim().toLowerCase() === 'approved')
            .forEach((approved) => {
                const fullNo = (approved.indentNumber || '').trim();
                if (fullNo) {
                    indentNumbers.add(fullNo);
                }
            });


        console.log(`Dropdown Debug: Found ${indentNumbers.size} indents from approved_indent.`, [...indentNumbers]);
        setPendingIndentNumbers(indentNumbers);
    }, [indentSheet, threePartyApprovalSheet, approvedIndentSheet, poHistorySheet]);

    const schema = z.object({
        poNumber: z.string().nonempty(),
        poDate: z.coerce.date(),
        supplierName: z.string().nonempty(),
        supplierAddress: z.string().nonempty(),
        gstin: z.string().nonempty(),
        indentNumber: z.string().optional(),
        quotationNumber: z.string().optional().default(''),
        quotationDate: z.coerce.date().optional(),
        ourEnqNo: z.string().optional().default(''),
        enquiryDate: z.coerce.date().optional(),
        description: z.string().optional().default(''), // Made optional
        indents: z
            .array(
                z.object({
                    indentNumber: z.string().nonempty(),
                    gst: z.coerce.number(),
                    discount: z.coerce.number().default(0).optional(),
                    searialNumber: z.union([z.string(), z.number()]).optional(),
                })
            ),
        terms: z.array(z.string().nonempty()).max(10),
        indentBy: z.string().optional(),
        preparedBy: z.string().optional(),
        approvedBy: z.string().optional(),
    });


    type FormData = z.infer<typeof schema>;
    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            poNumber: generatePoNumber(poMasterSheet.map((p) => p.poNumber)),
            poDate: new Date(),
            supplierName: '',
            supplierAddress: '',
            indentBy: 'Raja Sandekar',
            preparedBy: 'Nikhil Kumar Urawn',
            approvedBy: 'Pawan Sahu',
            gstin: '',
            indentNumber: '',
            quotationNumber: '',
            quotationDate: new Date(),
            ourEnqNo: '',
            enquiryDate: undefined,
            indents: [],
            terms: details?.defaultTerms || [],
        },
    });

    useEffect(() => {
        if (details) {
            form.setValue('terms', details.defaultTerms);
        }
    }, [details]);

    const indents = form.watch('indents');
    const indentNumber = form.watch('indentNumber');
    const vendor = form.watch('supplierName');
    const poDate = form.watch('poDate');
    const poNumber = form.watch('poNumber');

    const termsArray = useFieldArray({
        control: form.control,
        // @ts-ignore
        name: 'terms',
    });

    const itemsArray = useFieldArray({
        control: form.control,
        // @ts-ignore
        name: 'indents',
    });

    useEffect(() => {
        if (mode === 'create') {
            form.setValue(
                'poNumber',
                generatePoNumber(
                    poMasterSheet.map((p) => p.poNumber),
                    poDate
                )
            );
        }
    }, [poDate, poMasterSheet, mode]);

    useEffect(() => {
        if (mode === 'revise') {
            form.reset({
                poNumber: '',
                poDate: undefined,
                supplierName: '',
                supplierAddress: '',
                indentBy: '',
                preparedBy: '',
                approvedBy: '',
                gstin: '',
                quotationNumber: '',
                quotationDate: undefined,
                ourEnqNo: '',
                enquiryDate: undefined,
                indents: [],
                terms: [],
            });
        } else {
            form.reset({
                poNumber: generatePoNumber(poMasterSheet.map((p) => p.poNumber)),
                poDate: new Date(),
                supplierName: '',
                supplierAddress: '',
                indentBy: 'Raja Sandekar',
                preparedBy: 'Nikhil Kumar Urawn',
                approvedBy: 'Pawan Sahu',
                gstin: '',
                quotationNumber: '',
                quotationDate: new Date(),
                ourEnqNo: '',
                enquiryDate: undefined,
                indents: [],
                terms: details?.defaultTerms || [],
            });
        }
    }, [mode]);

    useEffect(() => {
        // Only auto-fill address/GSTIN from vendor selection when NO indent number is selected
        // (if indent is selected, it already handles vendor details from master table)
        if (vendor && mode === 'create' && !indentNumber) {
            const vendorDetails = details?.vendors.find((v) => v.vendorName === vendor);
            if (vendorDetails) {
                form.setValue('supplierAddress', vendorDetails?.address || '');
                form.setValue('gstin', vendorDetails?.gstin || '');
            }
        }
    }, [vendor, details]);

    // Auto-fill logic moved to handleIndentSelect for better reliability and direct Supabase connection.
    // Removed old useEffect to avoid race conditions and overwriting of fetched data.

    useEffect(() => {
        if (vendor && mode === 'create' && !indentNumber) {
            // Check if this indent is in the pending list
            const items = indentSheet.filter(
                (i) => pendingIndentNumbers.has(i.indentNumber) && i.approvedVendorName === vendor
            );

            // Find vendor details from master table and fill address & GSTIN
            if (vendor && details?.vendors) {
                const vendorDetails = details.vendors.find(
                    (v) => v.vendorName && v.vendorName.toLowerCase() === vendor.toLowerCase()
                );

                if (vendorDetails) {
                    form.setValue('supplierAddress', vendorDetails.address || '');
                    form.setValue('gstin', vendorDetails.gstin || '');
                }
            }

            form.setValue(
                'indents',
                items.map((i) => ({
                    indentNumber: i.indentNumber,
                    gst: 18,
                    discount: 0,
                    searialNumber: i.searialNumber,
                }))
            );
        }
    }, [vendor, indentNumber, mode, pendingIndentNumbers, details]);

    // Auto-fill supplier details when supplierName changes manually (not triggered by indent selection)
    useEffect(() => {
        if (mode === 'create' && !indentNumber) {
            const supplierName = form.getValues('supplierName');

            if (supplierName && details?.vendors) {
                const vendorDetails = details.vendors.find(
                    (v) => v.vendorName && v.vendorName.toLowerCase() === supplierName.toLowerCase()
                );

                if (vendorDetails) {
                    form.setValue('supplierAddress', vendorDetails.address || '');
                    form.setValue('gstin', vendorDetails.gstin || '');
                }
            }
        }
    }, [form.watch('supplierName')]);


    useEffect(() => {
        const po = poMasterSheet.find((p) => p.poNumber === poNumber)!;
        if (mode === 'revise' && po) {
            const vendor = details?.vendors.find((v) => v.vendorName === po.partyName);
            form.setValue('poDate', po.timestamp ? new Date(po.timestamp) : new Date());
            form.setValue('supplierName', po.partyName);
            form.setValue('supplierAddress', vendor?.address || '');
            form.setValue('preparedBy', po.preparedBy);
            form.setValue('approvedBy', po.approvedBy);
            form.setValue('gstin', vendor?.gstin || '');
            form.setValue('quotationNumber', po.quotationNumber);
            form.setValue('quotationDate', po.quotationDate ? new Date(po.quotationDate) : new Date());
            form.setValue('description', po.description);
            form.setValue('ourEnqNo', po.enquiryNumber);
            form.setValue('enquiryDate', po.enquiryDate ? new Date(po.enquiryDate) : new Date());
            form.setValue('indentBy', po.indentBy || '');
            form.setValue(
                'indents',
                poMasterSheet
                    .filter((p) => p.poNumber === po.poNumber)
                    .map((po) => ({
                        indentNumber: po.internalCode,
                        gst: po.gst,
                        discount: po.discount,
                    }))
            );
            const terms = [];
            for (let i = 0; i < 10; i++) {
                const term = po[`term${i + 1}` as keyof PoMasterSheet] as string;
                if (term !== '') {
                    terms.push(term);
                }
            }
            form.setValue('terms', terms);
        }
    }, [poNumber]);

    const handleDestinationEdit = () => {
        setIsEditingDestination(true);
    };

    const handleDestinationSave = () => {
        setIsEditingDestination(false);
        toast.success('Destination address updated');
    };

    const handleDestinationCancel = () => {
        setDestinationAddress(details?.destinationAddress || '');
        setIsEditingDestination(false);
    };
    // Helper to find indent across sheets
    const findIndentWithFallback = (id: string, serial?: number | string) => {
        const hasSerial = serial !== undefined && serial !== null && String(serial).trim() !== '';
        const targetBaseId = (id || '').split(/[_/]/)[0].toLowerCase();

        // 1. Search in master Indent Sheet
        let found = indentSheet.find((i) => {
            if (hasSerial && i.searialNumber) return String(i.searialNumber) === String(serial);
            const itemBaseId = (i.indentNumber || '').split(/[_/]/)[0].toLowerCase();
            return itemBaseId === targetBaseId;
        });

        // 2. Search in Approved Indent Sheet (often contains updated quantities)
        const approved = approvedIndentSheet.find((i) => {
            if (hasSerial && i.searialNumber) return String(i.searialNumber) === String(serial);
            const itemBaseId = (i.indentNumber || '').split(/[_/]/)[0].toLowerCase();
            return itemBaseId === targetBaseId;
        });

        // 3. Search in Three Party Approval (contains the final approved rate and vendor)
        const tpa = threePartyApprovalSheet.find((i) => {
            const itemBaseId = (i.indentNumber || '').split(/[_/]/)[0].toLowerCase();
            return itemBaseId === targetBaseId;
        });

        if (found || approved || tpa) {
            // Merge data from all sources
            const merged = {
                ...(found || {}),
                ...(approved || {}),
                ...(tpa || {}),
            } as any;

            // Ensure we use the correct field names
            return {
                ...merged,
                indentNumber: found?.indentNumber || approved?.indentNumber || tpa?.indentNumber || id,
                productName: merged.productName || merged.product || '',
                specifications: merged.specifications || merged.description || '',
                approvedQuantity: Number(approved?.approvedQuantity || found?.approvedQuantity || found?.quantity || 0),
                approvedRate: Number(tpa?.approvedRate || merged.approvedRate || merged.rate || found?.approvedRate || 0),
                uom: merged.uom || merged.unit || '',
                indenterName: merged.indenterName || found?.indenterName || '',
                department: merged.department || found?.department || '',
                groupHead: merged.groupHead || merged.category || found?.groupHead || '',
                searialNumber: merged.searialNumber || serial,
            };
        }

        return found;
    };

    // Direct auto-fill handler — called immediately on indent selection
    const handleIndentSelect = async (selectedIndentNumber: string) => {
        if (!selectedIndentNumber) {
            console.log('No indent number selected, clearing form fields.');
            form.setValue('indentNumber', '');
            form.setValue('supplierName', '');
            form.setValue('supplierAddress', '');
            form.setValue('gstin', '');
            form.setValue('indents', []);
            return;
        }

        const selectedBase = selectedIndentNumber.split(/[_/]/)[0].toLowerCase();
        console.log('Selected Indent Number (Full):', selectedIndentNumber);
        console.log('Selected Base:', selectedBase);

        // Update the main indentNumber field immediately
        form.setValue('indentNumber', selectedIndentNumber);

        // 1. Filter all items for this indent number (handling hidden suffixes)
        const items = indentSheet.filter(
            (i) => (i.indentNumber || '').split(/[_/]/)[0].toLowerCase() === selectedBase
        );

        // Fallback: If not in indentSheet, check approvedIndentSheet
        if (items.length === 0) {
            console.log('No items in indentSheet, checking approvedIndentSheet...');
            const approvedItems = approvedIndentSheet.filter(
                (i) => (i.indentNumber || '').split(/[_/]/)[0].toLowerCase() === selectedBase
            );
            if (approvedItems.length > 0) {
                items.push(...(approvedItems as any[]));
            }
        }

        console.log(`Found ${items.length} items for ${selectedIndentNumber}`);

        // 2. Determine the vendor name for this indent from all possible sources
        let vendorName = '';

        // Source A: Approved vendor in the collected items
        if (items.length > 0) {
            const firstWithVendor = items.find(i => i.approvedVendorName && i.approvedVendorName.trim() !== '');
            if (firstWithVendor) {
                vendorName = (firstWithVendor.approvedVendorName || '').trim();
                console.log('Vendor name found in items:', vendorName);
            }
        }

        // Source B: Three Party Approval sheet
        if (!vendorName) {
            const tpa = threePartyApprovalSheet.find(
                (t) => (t.indentNumber || '').split(/[_/]/)[0].toLowerCase() === selectedBase
            );
            if (tpa) {
                vendorName = (tpa.approvedVendorName || '').trim();
                if (vendorName) console.log('Vendor name found in threePartyApprovalSheet:', vendorName);
            }
        }

        console.log('Final vendor name:', vendorName);

        // 3. Auto-fill supplier name and indent by
        form.setValue('supplierName', vendorName);

        const firstWithIndenter = items.find(i => (i as any).indenterName && (i as any).indenterName.trim() !== '');
        if (firstWithIndenter) {
            form.setValue('indentBy', (firstWithIndenter as any).indenterName);
        }

        // 4. Fetch vendor details
        if (vendorName) {
            try {
                const vendorDetails = await fetchVendorDetails(vendorName);
                if (vendorDetails) {
                    form.setValue('supplierAddress', vendorDetails.address || '');
                    form.setValue('gstin', vendorDetails.gstin || '');
                } else {
                    const localVendor = details?.vendors.find(
                        (v) => v.vendorName && v.vendorName.trim().toLowerCase() === vendorName.toLowerCase()
                    );
                    if (localVendor) {
                        form.setValue('supplierAddress', localVendor.address || '');
                        form.setValue('gstin', localVendor.gstin || '');
                    }
                }
            } catch (err) {
                console.error('Error fetching vendor details:', err);
            }
        }

        // 5. Populate items table - Use FULL indentNumber for precise lookup
        if (items.length > 0) {
            console.log(`Populating PO items table with ${items.length} rows.`);
            form.setValue(
                'indents',
                items.map((i) => ({
                    indentNumber: i.indentNumber, // KEEP FULL NUMBER (e.g. 123_1)
                    gst: 18,
                    discount: 0,
                    searialNumber: i.searialNumber,
                }))
            );
        } else {
            console.error('Critical: Indent selected from dropdown but not found in any sheet.');
            form.setValue('indents', []);
        }

        console.log('--- handleIndentSelect finished ---');
    };

    const getCurrentFormattedDateTime = () => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    async function onSubmit(values: FormData) {
        try {
            const poNumber =
                mode === 'create'
                    ? values.poNumber
                    : incrementPoRevision(values.poNumber, poMasterSheet);
            const grandTotal = calculateGrandTotal(
                values.indents.map((indent) => {
                    // Precise match using searialNumber if available
                    const value = findIndentWithFallback(indent.indentNumber, indent.searialNumber as any);

                    return {
                        quantity: value?.approvedQuantity || 0,
                        rate: value?.approvedRate || 0,
                        discountPercent: indent?.discount || 0,
                        gstPercent: indent.gst,
                    };
                })
            );

            const pdfProps: POPdfProps = {
                companyLogo: window.location.origin + '/Mamta-logo.png',
                companyName: details?.companyName || '',
                companyPhone: details?.companyPhone || '',
                companyGstin: details?.companyGstin || '',
                companyPan: details?.companyPan || '',
                companyAddress: details?.companyAddress || '',
                billingAddress: details?.billingAddress || '',
                destinationAddress: destinationAddress, // Use the editable destination address
                supplierName: values.supplierName,
                supplierAddress: values.supplierAddress,
                supplierGstin: values.gstin,
                orderNumber: poNumber,
                orderDate: formatDate(values.poDate),
                quotationNumber: values.quotationNumber,
                quotationDate: values.quotationDate ? formatDate(values.quotationDate) : '',
                enqNo: values.ourEnqNo,
                enqDate: values.enquiryDate ? formatDate(values.enquiryDate) : '',
                description: values.description,
                items: values.indents.map((item) => {
                    // Precise match using searialNumber
                    const indent = findIndentWithFallback(item.indentNumber, item.searialNumber)!;

                    return {
                        internalCode: indent.indentNumber,
                        product: indent.productName,
                        description: indent.specifications,
                        quantity: indent.approvedQuantity,
                        unit: indent.uom,
                        rate: indent.approvedRate,
                        gst: item.gst || 0,
                        discount: item.discount || 0,
                        amount: calculateTotal(
                            indent.approvedRate,
                            item.gst || 0,
                            item.discount || 0,
                            indent.approvedQuantity
                        ),
                    };
                }),
                total: calculateSubtotal(
                    values.indents.map((indent) => {
                        const value = findIndentWithFallback(indent.indentNumber, indent.searialNumber);
                        return {
                            quantity: value?.approvedQuantity || 0,
                            rate: value?.approvedRate || 0,
                            discountPercent: indent?.discount || 0,
                        };
                    })
                ),
                gstAmount: calculateTotalGst(
                    values.indents.map((indent) => {
                        const value = findIndentWithFallback(indent.indentNumber, indent.searialNumber);
                        return {
                            quantity: value?.approvedQuantity || 0,
                            rate: value?.approvedRate || 0,
                            discountPercent: indent?.discount || 0,
                            gstPercent: indent.gst,
                        };
                    })
                ),
                grandTotal: grandTotal,
                terms: values.terms,
                preparedBy: values.preparedBy,
                approvedBy: values.approvedBy,
                indentBy: values.indentBy,
                finalApproved: '',
            };

            const blob = await pdf(<POPdf {...pdfProps} />).toBlob();
            const file = new File([blob], `PO-${poNumber}.pdf`, {
                type: 'application/pdf',
            });
            const email = details?.vendors.find((v) => v.vendorName === values.supplierName)?.email;

            let url = '';
            try {
                // Upload to Supabase Bucket 'pdf' as requested
                url = await uploadFileToSupabase(file, 'pdf');

                if (email) {
                    console.log(`PO PDF uploaded to Supabase: ${url}. Email sending to ${email} would happen here.`);
                    toast.success('PO created and PDF saved to Supabase');
                } else {
                    toast.success('PO created and PDF saved to Supabase');
                }
            } catch (uploadError) {
                console.error("Supabase Storage upload error:", uploadError);
                toast.error("Failed to upload PDF to Supabase.");
                // URL remains empty but we proceed to save the record
            }

            // Also save to PO HISTORY table for historical tracking (Supabase Only)
            const historyRows: PoHistorySheet[] = values.indents.map((v) => {
                const indent = findIndentWithFallback(v.indentNumber, v.searialNumber)!;

                return {
                    timestamp: getCurrentFormattedDateTime(),
                    partyName: values.supplierName,
                    poNumber,
                    indentNumber: v.indentNumber,
                    internalCode: v.indentNumber,
                    product: indent?.productName || '',
                    description: values.description || '',
                    quantity: indent?.approvedQuantity || 0,
                    unit: indent?.uom || '',
                    rate: indent?.approvedRate || 0,
                    gstPercent: v.gst,
                    discountPercent: v.discount || 0,
                    amount: calculateTotal(
                        indent?.approvedRate || 0,
                        v.gst,
                        v.discount || 0,
                        indent?.approvedQuantity || 0
                    ),
                    totalPoAmount: grandTotal,
                    preparedBy: values.preparedBy,
                    approvedBy: values.approvedBy,
                    pdf: url, // This is the Supabase public URL
                    quotationNumber: values.quotationNumber,
                    quotationDate: values.quotationDate ? formatDate(values.quotationDate) : '',
                    enquiryNumber: values.ourEnqNo,
                    enquiryDate: values.enquiryDate ? formatDate(values.enquiryDate) : '',
                    indentBy: values.indentBy,
                    term1: values.terms[0] || '',
                    term2: values.terms[1] || '',
                    term3: values.terms[2] || '',
                    term4: values.terms[3] || '',
                    term5: values.terms[4] || '',
                    term6: values.terms[5] || '',
                    term7: values.terms[6] || '',
                    term8: values.terms[7] || '',
                    term9: values.terms[8] || '',
                    term10: values.terms[9] || '',
                    status: 'Pending',
                    planned4: formatDate(new Date()), // Automatically generate date for planned_4
                };
            });

            try {
                // Save to PO_HISTORY table (Maps to po_history in Supabase)
                await postToPoHistory(historyRows);

                // Note: No need to update actual4 in INDENT table if it doesn't exist in Supabase schema.
                // The dropdown logic already filters out indents that have a matching record in po_history.
            } catch (histErr) {
                console.error('PO HISTORY save failed:', histErr);
            }
            toast.success(`Successfully ${mode}d purchase order`);
            form.reset();
            setTimeout(() => {
                updatePoMasterSheet();
                updateIndentSheet();
                updateThreePartyApprovalSheet();
                updatePoHistorySheet();
            }, 1000);
        } catch (e) {
            console.log(e);
            toast.error(`Failed to ${mode} purchase order`);
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div className="grid place-items-center w-full bg-gradient-to-br from-green-100 via-amber-50 to-green-50 rounder-md">
            <div className="flex justify-between p-5 w-full">
                <div className="flex gap-2 items-center">
                    <FilePlus2 size={50} className="text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold text-primary">Create or Revise PO</h1>
                        <p className="text-muted-foreground text-sm">
                            Create purchase order for indends or revise previous orders
                        </p>
                    </div>
                </div>
                <SidebarTrigger />
            </div>
            <div className="sm:p-4 max-w-6xl">
                <div className="w-full">
                    <Tabs
                        defaultValue="create"
                        onValueChange={(v) => setMode(v === 'create' ? v : 'revise')}
                    >
                        <TabsList className="h-10 w-full rounded-none">
                            <TabsTrigger value="create">Create</TabsTrigger>
                            <TabsTrigger value="revise">Revise</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit, onError)}
                        className="flex flex-col items-center"
                    >
                        <div className="space-y-4 p-4 w-full bg-white shadow-md rounded-sm">
                            <div className="flex items-center justify-center gap-4 bg-gradient-to-br from-green-100 via-amber-50 to-green-50 rounded py-8">
                                <img
                                    src="/Mamta-logo.png"
                                    alt="Company Logo"
                                    className="w-40 h-40 object-contain"
                                />
                                <div className="text-center">
                                    <h1 className="text-2xl font-bold">{details?.companyName}</h1>
                                    <div>
                                        <p className="text-sm">{details?.companyAddress}</p>
                                        <p className="text-sm">Phone No: +{details?.companyPhone}</p>
                                    </div>
                                </div>
                            </div>
                            <hr />
                            <h2 className="text-center font-bold text-lg">Purchase Order</h2>
                            <hr />

                            <div className="grid gap-5 px-4 py-2 text-foreground/80">
                                <div className="grid grid-cols-2 gap-x-5">
                                    <FormField
                                        control={form.control}
                                        name="poNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                {mode === 'create' ? (
                                                    <>
                                                        <FormLabel>PO Number</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                className="h-9"
                                                                readOnly
                                                                placeholder="Enter PO number"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </>
                                                ) : (
                                                    <FormControl>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormLabel>PO Number</FormLabel>
                                                            <FormControl>
                                                                <SelectTrigger
                                                                    size="sm"
                                                                    className="w-full"
                                                                >
                                                                    <SelectValue placeholder="Select PO" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {filterUniquePoNumbers(
                                                                    poMasterSheet
                                                                ).map((i, k) => (
                                                                    <SelectItem
                                                                        key={k}
                                                                        value={i.poNumber}
                                                                    >
                                                                        {i.poNumber}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormControl>
                                                )}
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="poDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>PO Date</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        className="h-9"
                                                        type="date"
                                                        value={
                                                            field.value
                                                                ? field.value
                                                                    .toISOString()
                                                                    .split('T')[0]
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            field.onChange(
                                                                e.target.value
                                                                    ? new Date(e.target.value)
                                                                    : undefined
                                                            )
                                                        }
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-x-5">
                                    <FormField
                                        control={form.control}
                                        name="indentNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                {mode === 'create' ? (
                                                    <FormControl>
                                                        <Select
                                                            onValueChange={(v) => {
                                                                field.onChange(v);
                                                                handleIndentSelect(v);
                                                            }}
                                                            value={field.value}
                                                        >
                                                            <FormLabel>Indent Number</FormLabel>
                                                            <FormControl>
                                                                <SelectTrigger
                                                                    size="sm"
                                                                    className="w-full"
                                                                >
                                                                    <SelectValue placeholder="Select Indent Number" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {[...pendingIndentNumbers].map((indentNo, k) => (
                                                                    <SelectItem key={k} value={indentNo}>
                                                                        {indentNo}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormControl>
                                                ) : (
                                                    <>
                                                        <FormLabel>Indent Number</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                className="h-9"
                                                                readOnly
                                                                placeholder="Indent Number"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </>
                                                )}
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="supplierName"
                                        render={({ field }) => (
                                            <FormItem>
                                                {mode === 'create' ? (
                                                    indentNumber ? (
                                                        // Indent selected → show auto-filled read-only Input
                                                        <>
                                                            <FormLabel>Supplier Name</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    className="h-9 bg-muted/50"
                                                                    readOnly
                                                                    placeholder="Auto-filled from indent"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </>
                                                    ) : (
                                                        // No indent selected → show Select dropdown
                                                        <FormControl>
                                                            <Select
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                            >
                                                                <FormLabel>Supplier Name</FormLabel>
                                                                <FormControl>
                                                                    <SelectTrigger
                                                                        size="sm"
                                                                        className="w-full"
                                                                    >
                                                                        <SelectValue placeholder="Select supplier" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {[
                                                                        ...new Map(
                                                                            indentSheet
                                                                                .filter(
                                                                                    (i) =>
                                                                                        i.approvedVendorName !== '' &&
                                                                                        pendingIndentNumbers.has(i.indentNumber)
                                                                                )
                                                                                .map((i) => [i.approvedVendorName, i])
                                                                        ).values()
                                                                    ].map((i, k) => (
                                                                        <SelectItem key={k} value={i.approvedVendorName}>
                                                                            {i.approvedVendorName}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormControl>
                                                    )
                                                ) : (
                                                    <>
                                                        <FormLabel>Supplier Name</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                className="h-9"
                                                                readOnly
                                                                placeholder="Enter supplier name"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </>
                                                )}
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-x-5">
                                    <FormField
                                        control={form.control}
                                        name="supplierAddress"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Supplier Address</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        className="h-9"
                                                        readOnly={mode === 'revise'}
                                                        placeholder="Enter supplier address"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="gstin"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>GSTIN</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        className="h-9"
                                                        readOnly={mode === 'revise'}
                                                        placeholder="Enter GSTIN"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-x-5">
                                    <FormField
                                        control={form.control}
                                        name="quotationNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Quotation Number</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        className="h-9"
                                                        placeholder="Enter Quotation number"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="quotationDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Quotation Date</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        className="h-9"
                                                        type="date"
                                                        value={
                                                            field.value
                                                                ? field.value
                                                                    .toISOString()
                                                                    .split('T')[0]
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            field.onChange(
                                                                e.target.value
                                                                    ? new Date(e.target.value)
                                                                    : undefined
                                                            )
                                                        }
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-x-5">
                                    <FormField
                                        control={form.control}
                                        name="ourEnqNo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Our Enq No.</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        className="h-9"
                                                        placeholder="Enter Our Enq No."
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="enquiryDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Enquiry Date</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        className="h-9"
                                                        type="date"
                                                        value={
                                                            field.value
                                                                ? field.value
                                                                    .toISOString()
                                                                    .split('T')[0]
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            field.onChange(
                                                                e.target.value
                                                                    ? new Date(e.target.value)
                                                                    : undefined
                                                            )
                                                        }
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <hr />

                            <div className="grid md:grid-cols-3 gap-3">
                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-primary/10 px-5 py-2">
                                        <CardTitle className="text-center">
                                            Our Commercial Details
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 text-sm">
                                        <p>
                                            <span className="font-medium">GSTIN</span>{' '}
                                            {details?.companyGstin}
                                        </p>
                                        <p>
                                            <span className="font-medium">Pan No.</span>{' '}
                                            {details?.companyPan}
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-primary/10 px-5 py-2">
                                        <CardTitle className="text-center">
                                            Billing Address
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 text-sm">
                                        <p>M/S {details?.companyName}</p>
                                        <p>{details?.billingAddress}</p>
                                    </CardContent>
                                </Card>
                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-primary/10 px-5 py-2">
                                        <CardTitle className="text-center flex items-center justify-between">
                                            Destination Address
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={isEditingDestination ? handleDestinationSave : handleDestinationEdit}
                                                className="h-6 w-6 p-0 hover:bg-gray-200"
                                            >
                                                {isEditingDestination ? (
                                                    <Save size={14} className="text-green-600" />
                                                ) : (
                                                    <Pencil size={14} className="text-gray-600" />
                                                )}
                                            </Button>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 text-sm">
                                        <p>M/S {details?.companyName}</p>
                                        {isEditingDestination ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input
                                                    value={destinationAddress}
                                                    onChange={(e) => setDestinationAddress(e.target.value)}
                                                    className="h-7 text-sm"
                                                    placeholder="Enter destination address"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleDestinationSave();
                                                        } else if (e.key === 'Escape') {
                                                            handleDestinationCancel();
                                                        }
                                                    }}
                                                    autoFocus
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleDestinationCancel}
                                                    className="h-6 w-6 p-0 hover:bg-red-100"
                                                >
                                                    <Trash size={12} className="text-red-500" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <p>{destinationAddress}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <hr />

                            <div>
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Enter message"
                                                    className="resize-y" // or "resize-y" to allow vertical resizing
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <hr />

                            <div className="mx-4 grid">
                                <div className="rounded-[3px] w-full min-w-full overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-primary text-primary-foreground font-bold">
                                            <TableRow>
                                                <TableHead>S.No.</TableHead>
                                                <TableHead>S/N</TableHead>
                                                <TableHead>Internal Code</TableHead>
                                                <TableHead>Product</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead>Unit</TableHead>
                                                <TableHead>Rate</TableHead>
                                                <TableHead>GST (%)</TableHead>
                                                <TableHead>Discount (%)</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {itemsArray.fields.map((field, index) => {
                                                const value = indents[index];
                                                const indent = findIndentWithFallback(value.indentNumber, value.searialNumber);
                                                return (
                                                    <TableRow key={field.id}>
                                                        {/* Actual Serial Number from Sheet */}
                                                        <TableCell>{indent?.searialNumber || '-'}</TableCell>
                                                        {/* Index */}
                                                        <TableCell>{index + 1}</TableCell>
                                                        <TableCell>
                                                            {indent?.indentNumber?.split(/[_/]/)[0]}
                                                        </TableCell>
                                                        <TableCell>{indent?.productName}</TableCell>
                                                        <TableCell>
                                                            {indent?.specifications || (
                                                                <span className="text-muted-foreground">
                                                                    No Description
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {indent?.approvedQuantity}
                                                        </TableCell>
                                                        <TableCell>{indent?.uom}</TableCell>
                                                        <TableCell>
                                                            {indent?.approvedRate}
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField
                                                                control={form.control}
                                                                name={`indents.${index}.gst`}
                                                                render={({ field: indentField }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                className="rounded-sm h-9 w-20 p-0 text-center"
                                                                                {...indentField}
                                                                                onChange={(e) => indentField.onChange(Number(e.target.value))}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField
                                                                control={form.control}
                                                                name={`indents.${index}.discount`} // Assuming productName is in your schema
                                                                render={({
                                                                    field: indentField,
                                                                }) => (
                                                                    <FormItem className="flex justify-center items-center">
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                className="rounded-sm h-9 max-w-15 p-0 text-center"
                                                                                max="100"
                                                                                {...indentField}
                                                                            />
                                                                        </FormControl>{' '}
                                                                        %
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {calculateTotal(
                                                                indent?.approvedRate || 0,
                                                                value.gst,
                                                                value.discount || 0,
                                                                indent?.approvedQuantity || 0
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    itemsArray.remove(index);
                                                                }}
                                                            >
                                                                <Trash
                                                                    size={20}
                                                                    className="text-red-300"
                                                                />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="flex justify-end p-4">
                                    <div className="w-80 rounded-[3px] bg-primary/5">
                                        <p className="flex px-7 py-2 justify-between">
                                            <span>Total:</span>
                                            <span className="text-end">
                                                {calculateSubtotal(
                                                    indents.map((indent) => {
                                                        const value = findIndentWithFallback(indent.indentNumber, indent.searialNumber);
                                                        return {
                                                            quantity: value?.approvedQuantity || 0,
                                                            rate: value?.approvedRate || 0,
                                                            discountPercent: indent?.discount || 0,
                                                        };
                                                    })
                                                )}
                                            </span>
                                        </p>
                                        <hr />
                                        <p className="flex px-7 py-2 justify-between">
                                            <span>GST Amount:</span>
                                            <span className="text-end">
                                                {calculateTotalGst(
                                                    indents.map((indent) => {
                                                        const value = findIndentWithFallback(indent.indentNumber, indent.searialNumber);
                                                        return {
                                                            quantity: value?.approvedQuantity || 0,
                                                            rate: value?.approvedRate || 0,
                                                            discountPercent: indent?.discount || 0,
                                                            gstPercent: indent.gst,
                                                        };
                                                    })
                                                )}
                                            </span>
                                        </p>
                                        <hr />
                                        <p className="flex px-7 py-2 justify-between font-bold">
                                            <span>Grand Total:</span>
                                            <span className="text-end">
                                                {calculateGrandTotal(
                                                    indents.map((indent) => {
                                                        const value = findIndentWithFallback(indent.indentNumber, indent.searialNumber);
                                                        return {
                                                            quantity: value?.approvedQuantity || 0,
                                                            rate: value?.approvedRate || 0,
                                                            discountPercent: indent?.discount || 0,
                                                            gstPercent: indent.gst,
                                                        };
                                                    })
                                                )}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <hr />

                            <div>
                                <p className="text-sm px-3 font-semibold">THE ABOVE</p>
                                <div>
                                    {termsArray.fields.map((field, index) => {
                                        const write = readOnly === index;
                                        return (
                                            <div className="flex items-center" key={field.id}>
                                                <span className="px-3">{index + 1}.</span>
                                                <FormField
                                                    control={form.control}
                                                    name={`terms.${index}`}
                                                    render={({ field: termField }) => (
                                                        <FormItem className="w-full">
                                                            <FormControl>
                                                                <Input
                                                                    className={cn(
                                                                        'border-transparent rounded-xs h-6 shadow-none',
                                                                        !write
                                                                            ? ''
                                                                            : 'border-b border-b-foreground'
                                                                    )}
                                                                    readOnly={!write}
                                                                    {...termField}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (write) {
                                                            setReadOnly(-1);
                                                        } else if (readOnly === -1) {
                                                            setReadOnly(index);
                                                        } else {
                                                            toast.error(
                                                                `Please save term ${readOnly + 1} before editing`
                                                            );
                                                        }
                                                    }}
                                                >
                                                    {!write ? (
                                                        <Pencil size={20} />
                                                    ) : (
                                                        <Save size={20} />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (readOnly === index) setReadOnly(-1);
                                                        termsArray.remove(index);
                                                    }}
                                                >
                                                    <Trash className="text-red-300" size={20} />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="w-full flex justify-end p-3">
                                    <Button
                                        className="w-50"
                                        variant="outline"
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (termsArray.fields.length < 11) {
                                                if (readOnly === -1) {
                                                    // @ts-ignore
                                                    termsArray.append('');
                                                    setReadOnly(termsArray.fields.length);
                                                } else {
                                                    toast.error(
                                                        `Please save term ${readOnly + 1} before creating`
                                                    );
                                                }
                                            } else {
                                                toast.error('Only 10 terms are allowed');
                                            }
                                        }}
                                    >
                                        Add Term
                                    </Button>
                                </div>
                            </div>

                            <hr />

                            <div className="text-center flex justify-between gap-5 px-7 items-center">
                                <FormField
                                    control={form.control}
                                    name="indentBy"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col justify-center items-center w-full">
                                            <FormLabel>Indent By</FormLabel>
                                            <FormControl>
                                                <Input
                                                    className="h-9 w-full text-center"
                                                    placeholder="Indent By"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="preparedBy"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col justify-center items-center w-full">
                                            <FormLabel>Prepared By</FormLabel>
                                            <FormControl>
                                                <Input
                                                    className="h-9 w-full text-center"
                                                    placeholder="Purchase Order Prepared By"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="approvedBy"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col justify-center items-center w-full">
                                            <FormLabel>Approved By</FormLabel>
                                            <FormControl>
                                                <Input
                                                    className="h-9 w-full text-center"
                                                    placeholder="Purchase Order Approved By"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                {/* Final Approved Field Removed from UI */}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 p-3 w-full max-w-6xl bg-background m-5 shadow-md rounded-md">
                            <Button type="reset" variant="outline" onClick={() => form.reset()}>
                                Reset
                            </Button>

                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && (
                                    <Loader size={20} color="white" aria-label="Loading Spinner" />
                                )}
                                Save And Send PO
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    );
};
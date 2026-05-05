



import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { ClipLoader as Loader } from 'react-spinners';
import { ClipboardList, Trash, Search, Plus, Paperclip } from 'lucide-react'; // Plus ko import karo
import { postToSheet, submitToMaster, uploadFile } from '@/lib/fetchers';
import { supabase } from '@/lib/supabase';
import type { IndentSheet, StoreOutSheet, InventorySheet } from '@/types';
import { useSheets } from '@/context/SheetsContext';
import Heading from '../element/Heading';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDate } from '@/lib/utils';


export default () => {
    const { indentSheet: sheet, storeOutSheet, storeOutApprovalSheet, inventorySheet, updateIndentSheet, updateStoreOutSheet, updateInventorySheet, updateStoreOutApprovalSheet, masterSheet: options } = useSheets();
    const [indentSheet, setIndentSheet] = useState<IndentSheet[]>([]);
    const [searchTermGroupHead, setSearchTermGroupHead] = useState("");
    const [searchTermProductName, setSearchTermProductName] = useState("");
    const [newProductName, setNewProductName] = useState<{ [key: number]: string }>({});
    const [showAddProduct, setShowAddProduct] = useState<{ [key: number]: boolean }>({});
    const [localProducts, setLocalProducts] = useState<{ [key: string]: string[] }>({});
    const [searchTermCategory, setSearchTermCategory] = useState("");
    const [searchTermWard, setSearchTermWard] = useState("");
    
    // Compute all products and their mapping to group heads
    const { allProducts, productToGroupHeadMap } = useMemo(() => {
        const productMap: Record<string, string> = {};
        const masterGroupHeads = options?.groupHeads || {};
        
        // Process master sheet data
        Object.entries(masterGroupHeads).forEach(([groupHead, products]) => {
            products.forEach(product => {
                if (!productMap[product]) {
                    productMap[product] = groupHead;
                }
            });
        });
        
        // Process local products
        Object.entries(localProducts).forEach(([groupHead, products]) => {
            products.forEach(product => {
                if (!productMap[product]) {
                    productMap[product] = groupHead;
                }
            });
        });
        
        return {
            allProducts: Object.keys(productMap).sort(),
            productToGroupHeadMap: productMap
        };
    }, [options, localProducts]);


    useEffect(() => {
        setIndentSheet(sheet);
    }, [sheet]);


    const schema = z.object({
        indenterName: z.string().optional(),
        indentApproveBy: z.string().optional(),
        indentType: z.enum(['Purchase', 'Store Out'], { required_error: 'Select a status' }),
        products: z
            .array(
                z.object({
                    groupHead: z.string().optional(),
                    productName: z.string().optional(),
                    quantity: z.coerce.number().gt(0, 'Must be greater than 0'),
                    uom: z.string().optional(),
                    areaOfUse: z.string().optional(),
                    wardName: z.string().optional(),
                    attachment: z.instanceof(File).optional(),
                    specifications: z.string().optional(),
                    // New fields for Store Out
                    floor: z.string().optional(),
                    category: z.string().optional(),
                    department: z.string().optional(),
                    issueDate: z.string().optional(),
                    requestedBy: z.string().optional(),
                })
            )
            .min(1, 'At least one product is required'),
    }).superRefine((data, ctx) => {
        if (data.indentType === 'Purchase') {
            if (!data.indenterName) ctx.addIssue({ code: 'custom', message: 'Required', path: ['indenterName'] });
            if (!data.indentApproveBy) ctx.addIssue({ code: 'custom', message: 'Required', path: ['indentApproveBy'] });

            data.products.forEach((p, i) => {
                if (!p.groupHead) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'groupHead'] });
                if (!p.productName) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'productName'] });
                if (!p.uom) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'uom'] });
                if (!p.areaOfUse) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'areaOfUse'] });
                if (!p.department) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'department'] });
            });
        } else if (data.indentType === 'Store Out') {
            data.products.forEach((p, i) => {
                if (!p.wardName) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'wardName'] });
                if (!p.category) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'category'] });
                if (!p.productName) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'productName'] });
                if (!p.uom) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'uom'] });
                if (!p.department) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'department'] });
            });
        }
    });


    const [searchParams] = useSearchParams();
    const typeParam = searchParams.get('type');
    const itemParam = searchParams.get('item');
    const uomParam = searchParams.get('uom');
    const groupParam = searchParams.get('group');

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            indenterName: '',
            indentApproveBy: '',
            indentType: (typeParam as any) || 'Purchase',
            products: itemParam ? [
                {
                    productName: itemParam || '',
                    uom: uomParam || '',
                    groupHead: groupParam || '',
                    category: groupParam || '',
                    quantity: 1 as any,
                    areaOfUse: '',
                    wardName: '',
                    specifications: '',
                    floor: '',
                    department: '',
                    issueDate: new Date().toISOString().split('T')[0],
                    requestedBy: '',
                    attachment: undefined,
                }
            ] : [
                {
                    attachment: undefined,
                    uom: '',
                    productName: '',
                    specifications: '',
                    quantity: 1,
                    areaOfUse: '',
                    groupHead: '',
                    // Initialize Store Out specific fields to avoid uncontrolled warnings
                    wardName: '',
                    category: '',
                    department: '',
                    issueDate: new Date().toISOString().split('T')[0],
                },
            ],
        },
    });


    const products = form.watch('products');
    const indentType = form.watch('indentType');
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'products',
    });

    useEffect(() => {
        if (indentType === 'Purchase') {
            form.setValue('indentApproveBy', 'Dr Sunil Ramnani');
        } else if (indentType === 'Store Out') {
            form.setValue('indentApproveBy', 'Store Incharge');
        }
    }, [indentType, form]);


    /**
     * Get the next Store Out base number by querying Supabase directly.
     * Avoids stale-state race conditions – always reads the freshest data.
     * Format returned: 'SO-XXXX'
     */
    const getNextIssueBase = async (): Promise<string> => {
        const prefix = 'SO-';
        const { data, error } = await supabase
            .from('store_out_request')
            .select('issue_no')
            .ilike('issue_no', `${prefix}%`)
            .order('id', { ascending: false })
            .limit(200);

        if (error) throw new Error(`Failed to fetch existing issue numbers: ${error.message}`);

        let maxNumber = 0;
        if (data && data.length > 0) {
            for (const row of data) {
                if (!row.issue_no?.startsWith(prefix)) continue;
                const base = row.issue_no.split(/[_/]/)[0]; // strip _N or /N suffix
                const num = parseInt(base.replace(prefix, ''), 10);
                if (!isNaN(num) && num > maxNumber) maxNumber = num;
            }
        }
        return `${prefix}${String(maxNumber + 1).padStart(4, '0')}`;
    };

    /**
     * Get the next Purchase indent base number by querying Supabase directly.
     * Format returned: 'SI-XXXX'
     */
    const getNextIndentBase = async (): Promise<string> => {
        const prefix = 'SI-';
        const { data, error } = await supabase
            .from('indent')
            .select('indent_number')
            .ilike('indent_number', `${prefix}%`)
            .order('id', { ascending: false })
            .limit(200);

        if (error) {
            console.error('[getNextIndentBase] Supabase error, falling back to context:', error);
            // Graceful fallback to cached context
            if (!indentSheet?.length) return `${prefix}0001`;
            const maxNumber = indentSheet
                .map((row: any) => {
                    const val = row.indentNumber || '';
                    if (!val.startsWith(prefix)) return 0;
                    const base = val.split(/[_/]/)[0];
                    const num = parseInt(base.replace(prefix, ''), 10);
                    return isNaN(num) ? 0 : num;
                })
                .reduce((max: number, n: number) => Math.max(max, n), 0);
            return `${prefix}${String(maxNumber + 1).padStart(4, '0')}`;
        }

        let maxNumber = 0;
        if (data && data.length > 0) {
            for (const row of data) {
                if (!row.indent_number?.startsWith(prefix)) continue;
                const base = row.indent_number.split(/[_/]/)[0];
                const num = parseInt(base.replace(prefix, ''), 10);
                if (!isNaN(num) && num > maxNumber) maxNumber = num;
            }
        }
        return `${prefix}${String(maxNumber + 1).padStart(4, '0')}`;
    };




    // Better approach using image tag
    const submitProductToMasterSheet = (productName: string, groupHead: string) => {
        const MASTER_SHEET_URL = 'https://script.google.com/a/macros/jjspl.in/s/AKfycbyybfRgC2y9wLktUTQ9fTqp-qGMleFrj1c3pQJbLEQiMWr9-hNEaZyoqkWpeV9HF9Az/exec';

        const params = new URLSearchParams({
            sheetName: 'Items And Location',
            productName: productName,
            groupHead: groupHead
        });

        // Use image tag trick (no CORS issue)
        const img = new Image();
        img.src = `${MASTER_SHEET_URL}?${params.toString()}`;

        return Promise.resolve(true);
    };

    // Update addNewProductLocally - sync version
    const addNewProductLocally = (index: number, groupHead: string) => {
        const productName = newProductName[index]?.trim();

        if (!productName) {
            toast.error('Please enter a product name');
            return;
        }

        if (!groupHead) {
            toast.error('Please select a group head first');
            return;
        }

        // Add to local state
        setLocalProducts(prev => ({
            ...prev,
            [groupHead]: [...(prev[groupHead] || []), productName]
        }));

        // Set the value in form
        form.setValue(`products.${index}.productName`, productName);

        // Reset states
        setNewProductName(prev => ({ ...prev, [index]: '' }));
        setShowAddProduct(prev => ({ ...prev, [index]: false }));

        // Submit to master sheet
        submitProductToMasterSheet(productName, groupHead);

        toast.success('Product added successfully');
    };

    async function onSubmit(data: z.infer<typeof schema>) {
        const now = new Date();
        const day = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' });
        const month = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: '2-digit' });
        const year = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric' });
        const time = now.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const timestamp = `${day}/${month}/${year} ${time}`;
        const issueDate = `${day}/${month}/${year}`;

        // ─── STORE OUT PATH ───────────────────────────────────────────────────────
        if (data.indentType === 'Store Out') {
            const MAX_ATTEMPTS = 3;
            let attempt = 0;

            while (attempt < MAX_ATTEMPTS) {
                try {
                    // 1. Always get a fresh base number directly from DB
                    const baseNumber = await getNextIssueBase();

                    // 2. Build rows with snake_case column names the table expects
                    const rows = data.products.map((product, idx) => ({
                        timestamp: timestamp,
                        issue_no: `${baseNumber}_${idx + 1}`,
                        product_name: product.productName || '',
                        issue_date: product.issueDate
                            ? formatDate(new Date(product.issueDate))
                            : issueDate,
                        indenter_name: data.indenterName || '',
                        indent_type: 'Store Out',
                        approval_needed: data.indentApproveBy || '',
                        requested_by: data.indenterName || '',
                        floor: product.floor || '',
                        ward_name: product.wardName || '',
                        qty: Number(product.quantity) || 0,
                        unit: product.uom || '',
                        department: product.department || '',
                        category: product.category || '',
                        area_of_use: product.areaOfUse || '',
                        planned_7: timestamp,
                        status: 'Pending',
                    }));

                    console.log('=== STORE OUT REQUEST SUBMISSION ===', JSON.stringify(rows, null, 2));

                    // 3. Insert directly via Supabase (bypasses postToSheet to control error code)
                    const { error: insertError } = await supabase
                        .from('store_out_request')
                        .insert(rows);

                    if (insertError) {
                        // Unique-constraint violation → increment and retry
                        if (insertError.code === '23505') {
                            console.warn(`[Store Out] Duplicate issue_no conflict on attempt ${attempt + 1}, retrying…`);
                            attempt++;
                            continue;
                        }
                        throw new Error(insertError.message);
                    }

                    // SUCCESS
                    toast.success(`Store Out ${baseNumber} created successfully!`);

                    for (const product of data.products) {
                        if (product.wardName) submitToMaster(product.wardName);
                    }

                    form.reset();
                    setLocalProducts({});
                    setNewProductName({});
                    setShowAddProduct({});

                    setTimeout(() => {
                        updateStoreOutSheet();
                        updateStoreOutApprovalSheet();
                    }, 1000);
                    return;

                } catch (error: any) {
                    const isDuplicate = error?.code === '23505';
                    if (isDuplicate && attempt < MAX_ATTEMPTS - 1) {
                        attempt++;
                        continue;
                    }
                    console.error('Store Out submission failed:', error);
                    toast.error(`Failed: ${error?.message || 'Unknown error'}`);
                    return;
                }
            }

            toast.error('Could not generate a unique issue number after 3 attempts. Please try again.');
            return;
        }

        // ─── PURCHASE INDENT PATH ────────────────────────────────────────────────
        try {
            const indentRows: Partial<IndentSheet>[] = [];
            const currentIndentNumber = await getNextIndentBase();

            for (let i = 0; i < data.products.length; i++) {
                const product = data.products[i];

                const row: Partial<IndentSheet> = {
                    timestamp: timestamp,
                    indentNumber: `${currentIndentNumber}_${i + 1}`,
                    indenterName: data.indenterName || '',
                    department: product.department || '',
                    areaOfUse: product.areaOfUse || '',
                    groupHead: product.groupHead || '',
                    productName: product.productName || '',
                    quantity: Number(product.quantity) || 0,
                    uom: product.uom || '',
                    specifications: product.specifications || '',
                    indentApprovedBy: data.indentApproveBy || '',
                    indentType: data.indentType || 'Purchase',
                    attachment: '',
                    planned1: timestamp,
                    status: 'Pending',
                };

                if (product.attachment !== undefined) {
                    row.attachment = await uploadFile(
                        product.attachment,
                        import.meta.env.VITE_IDENT_ATTACHMENT_FOLDER
                    );
                }
                indentRows.push(row);
            }

            console.log('=== INDENT SUBMISSION ===', JSON.stringify(indentRows, null, 2));

            const res = await postToSheet(indentRows, 'insert', 'INDENT');

            if (res.success) {
                toast.success(`Purchase indent created! Indent No: ${indentRows.map(r => r.indentNumber).join(', ')}`);

                // Auto-register new products in inventory
                const uniqueProductNames = Array.from(
                    new Set(data.products.map(p => p.productName?.trim()).filter(Boolean))
                );
                const inventoryRowsToInsert: Partial<InventorySheet>[] = [];

                for (const prodName of uniqueProductNames) {
                    const exists = inventorySheet?.some(
                        inv => inv.itemName?.toLowerCase() === prodName?.toLowerCase()
                    );
                    if (!exists) {
                        const productDetails = data.products.find(p => p.productName?.trim() === prodName);
                        if (productDetails) {
                            inventoryRowsToInsert.push({
                                groupHead: productDetails.groupHead || productDetails.category || '',
                                itemName: prodName || '',
                                uom: productDetails.uom || '',
                                maxLevel: 0,
                                opening: 0,
                                individualRate: 0,
                                indented: 0,
                                approved: 0,
                                purchaseQuantity: 0,
                                outQuantity: 0,
                                currentStock: 0,
                                totalPrice: 0,
                                colorCode: '#000000',
                            });
                        }
                    }
                }

                if (inventoryRowsToInsert.length > 0) {
                    try {
                        await postToSheet(inventoryRowsToInsert, 'insert', 'INVENTORY');
                        console.log(`Auto-registered ${inventoryRowsToInsert.length} new inventory items.`);
                        updateInventorySheet();
                    } catch (invErr) {
                        console.error('Failed to auto-register inventory items:', invErr);
                    }
                }

                for (const product of data.products) {
                    if (product.areaOfUse) submitToMaster(product.areaOfUse);
                }

                form.reset();
                setLocalProducts({});
                setNewProductName({});
                setShowAddProduct({});

                setTimeout(() => updateIndentSheet(), 1000);
            } else {
                toast.error(res.message || 'Failed to create indent');
            }
        } catch (error) {
            console.error('=== SUBMIT ERROR ===', error);
            toast.error(`Error: ${error instanceof Error ? error.message : 'Please try again'}`);
        }
    }



    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }


    return (
        <div>
            <Heading heading="Indent Form" subtext="Create new Indent">
                <ClipboardList size={50} className="text-primary" />
            </Heading>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-4 p-5">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <FormField
                            control={form.control}
                            name="indenterName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-medium">
                                        Indenter Name
                                        <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter indenter name" {...field} className="h-9" />
                                    </FormControl>
                                </FormItem>
                            )}
                        />


                        <FormField
                            control={form.control}
                            name="indentType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-medium">
                                        Indent Type
                                        <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-full h-9">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Purchase">Purchase</SelectItem>
                                            <SelectItem value="Store Out">Store Out</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />


                        <FormField
                            control={form.control}
                            name="indentApproveBy"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-medium">
                                        Approval Needed
                                        <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter approval needed" {...field} className="h-9" />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>


                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <h2 className="text-md font-semibold text-primary/80">Products</h2>
                        </div>


                        {fields.map((field, index) => {
                            const groupHead = indentType === 'Store Out' ? products[index]?.category : products[index]?.groupHead;
                            const productOptions = allProducts;


                            return (
                                <div
                                    key={field.id}
                                    className="flex flex-col gap-3 border p-4 rounded-lg bg-card text-card-foreground shadow-sm"
                                >
                                    <div className="flex justify-between items-center border-b pb-2 mb-1">
                                        <h3 className="text-sm font-bold text-muted-foreground uppercase">
                                            Product {index + 1}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {index === fields.length - 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-xs"
                                                    onClick={() => {
                                                        const firstProd = products[0] || {};
                                                        append({
                                                            groupHead: firstProd.groupHead || '',
                                                            productName: '',
                                                            quantity: 1,
                                                            uom: '',
                                                            areaOfUse: firstProd.areaOfUse || '',
                                                            // @ts-ignore
                                                            priority: undefined,
                                                            attachment: undefined,
                                                            wardName: firstProd.wardName || '',
                                                            category: firstProd.category || '',
                                                            department: firstProd.department || '',
                                                            issueDate: firstProd.issueDate || new Date().toISOString().split('T')[0],
                                                        })
                                                    }}
                                                >
                                                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Product
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                type="button"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive/90"
                                                onClick={() => fields.length > 1 && remove(index)}
                                                disabled={fields.length === 1}
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Consolidated Grid Container - Clear 4-column layout */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                                        {/* New Department Field */}
                                        <FormField
                                            control={form.control}
                                            name={`products.${index}.department`}
                                            render={({ field }) => (
                                                <FormItem className="md:col-span-1">
                                                    <FormLabel className="text-sm">Department<span className="text-destructive">*</span></FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="w-full h-9">
                                                                <SelectValue placeholder="Select" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {(options?.departments || []).map((d, i) => (
                                                                <SelectItem key={i} value={d}>{d}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />

                                        {/* Row 1: Location & Categorization */}
                                        {indentType === 'Store Out' ? (
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.wardName`}
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-1">
                                                        <FormLabel className="text-sm">Ward Name<span className="text-destructive">*</span></FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="w-full h-9">
                                                                    <SelectValue placeholder="Select ward" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 opacity-50" />
                                                                    <input
                                                                        placeholder="Search..."
                                                                        value={searchTermWard}
                                                                        onChange={(e) => setSearchTermWard(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full bg-transparent text-sm outline-none"
                                                                    />
                                                                </div>
                                                                {(options?.wardNames || [])
                                                                    .filter(w => w.toLowerCase().includes(searchTermWard.toLowerCase()))
                                                                    .map((w, i) => (
                                                                        <SelectItem key={i} value={w}>{w}</SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        ) : (
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.areaOfUse`}
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-1">
                                                        <FormLabel className="text-sm">Ward Name<span className="text-destructive">*</span></FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="w-full h-9">
                                                                    <SelectValue placeholder="Select ward" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 opacity-50" />
                                                                    <input
                                                                        placeholder="Search..."
                                                                        value={searchTermWard}
                                                                        onChange={(e) => setSearchTermWard(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full bg-transparent text-sm outline-none"
                                                                    />
                                                                </div>
                                                                {(options?.wardNames || [])
                                                                    .filter(w => w.toLowerCase().includes(searchTermWard.toLowerCase()))
                                                                    .map((w, i) => (
                                                                        <SelectItem key={i} value={w}>{w}</SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        )}

                                        <FormField
                                            control={form.control}
                                            name={indentType === 'Store Out' ? `products.${index}.category` : `products.${index}.groupHead`}
                                            render={({ field }) => (
                                                <FormItem className="md:col-span-1">
                                                    <FormLabel className="text-sm">{indentType === 'Store Out' ? 'Group of head' : 'Group Head'}<span className="text-destructive">*</span></FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="w-full h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <div className="flex items-center border-b px-3 pb-3">
                                                                <Search className="mr-2 h-4 w-4 opacity-50" />
                                                                <input placeholder="Search..." value={indentType === 'Store Out' ? searchTermCategory : searchTermGroupHead} onChange={(e) => indentType === 'Store Out' ? setSearchTermCategory(e.target.value) : setSearchTermGroupHead(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="flex h-10 w-full bg-transparent text-sm outline-none" />
                                                            </div>
                                                            {[...new Set(Object.keys(options?.groupHeads || {}))].filter(k => k.toLowerCase().includes(indentType === 'Store Out' ? searchTermCategory.toLowerCase() : searchTermGroupHead.toLowerCase())).map((k, i) => (
                                                                <SelectItem key={`${k}-${i}`} value={k}>{k}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />


                                        {indentType === 'Store Out' && (
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.issueDate`}
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-1">
                                                        <FormLabel className="text-sm">Issue Date<span className="text-destructive">*</span></FormLabel>
                                                        <FormControl><Input type="date" {...field} className="h-9" /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        )}

                                        {/* Row 2: Product Details */}
                                        <div className="md:col-span-2">
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.productName`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-sm">Product Name<span className="text-destructive">*</span></FormLabel>
                                                        <Select 
                                                            onValueChange={(val) => {
                                                                field.onChange(val);
                                                                // Auto-fill Group Head / Category
                                                                const mappedGroup = productToGroupHeadMap[val];
                                                                if (mappedGroup) {
                                                                    const fieldName = indentType === 'Store Out' 
                                                                        ? `products.${index}.category` 
                                                                        : `products.${index}.groupHead`;
                                                                    form.setValue(fieldName as any, mappedGroup);
                                                                }
                                                            }} 
                                                            value={field.value}
                                                        >
                                                            <FormControl><SelectTrigger className="w-full h-9"><SelectValue placeholder="Select product" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 opacity-50" />
                                                                    <input placeholder="Search..." value={searchTermProductName} onChange={(e) => setSearchTermProductName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="flex h-10 w-full bg-transparent text-sm outline-none" />
                                                                </div>
                                                                {!showAddProduct[index] && (
                                                                    <div className="flex items-center px-3 py-2 cursor-pointer hover:bg-accent" onClick={() => setShowAddProduct(prev => ({ ...prev, [index]: true }))}>
                                                                        <Plus className="mr-2 h-4 w-4" /><span className="text-sm font-medium">Add New Product</span>
                                                                    </div>
                                                                )}
                                                                {showAddProduct[index] && (
                                                                    <div className="flex items-center gap-2 px-3 py-2 border-b">
                                                                        <Input placeholder="New product" value={newProductName[index] || ''} onChange={(e) => setNewProductName(prev => ({ ...prev, [index]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), groupHead ? addNewProductLocally(index, groupHead) : toast.error("Please select a Group Head first"))} className="h-9" />
                                                                        <Button type="button" size="sm" onClick={() => {
                                                                            if (!groupHead) {
                                                                                toast.error("Please select a Group Head for the new product");
                                                                                return;
                                                                            }
                                                                            addNewProductLocally(index, groupHead);
                                                                        }}>Add</Button>
                                                                    </div>
                                                                )}
                                                                {[...new Set(productOptions)].filter(p => p.toLowerCase().includes(searchTermProductName.toLowerCase())).map((p, i) => (
                                                                    <SelectItem key={`${p}-${i}`} value={p}>{p}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name={`products.${index}.quantity`}
                                            render={({ field }) => (
                                                <FormItem className="md:col-span-1">
                                                    <FormLabel className="text-sm">Quantity<span className="text-destructive">*</span></FormLabel>
                                                    <FormControl><Input type="number" {...field} className="h-9" /></FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`products.${index}.uom`}
                                            render={({ field }) => (
                                                <FormItem className="md:col-span-1">
                                                    <FormLabel className="text-sm">UOM<span className="text-destructive">*</span></FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="w-full h-9"><SelectValue placeholder="Unit" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {(options?.units || []).map((u) => (
                                                                <SelectItem key={u} value={u}>{u}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />

                                        {/* Row 3: Attachment & Specifications (Purchase Only) */}
                                        {indentType !== 'Store Out' && (
                                            <>
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.attachment`}
                                                    render={({ field }) => (
                                                        <FormItem className="md:col-span-2">
                                                            <FormLabel className="text-sm">Attachment</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <Input
                                                                        type="file"
                                                                        onChange={(e) => field.onChange(e.target.files?.[0])}
                                                                        className="h-9 pr-10 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                                                                    />
                                                                    <Paperclip className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                                                </div>
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.specifications`}
                                                    render={({ field }) => (
                                                        <FormItem className="md:col-span-2">
                                                            <FormLabel className="text-sm">Specifications</FormLabel>
                                                            <FormControl><Textarea placeholder="Enter specifications" className="resize-y h-9 min-h-[36px]" {...field} /></FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>


                    <div>
                        <Button
                            className="w-full"
                            type="submit"
                            disabled={form.formState.isSubmitting}
                        >
                            {form.formState.isSubmitting && (
                                <Loader size={20} color="white" aria-label="Loading Spinner" />
                            )}
                            Create Indent
                        </Button>
                    </div>
                </form>
            </Form>
        </div >
    );
};

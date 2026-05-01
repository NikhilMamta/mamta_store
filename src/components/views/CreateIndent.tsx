



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
import { ClipboardList, Trash, Search, Plus } from 'lucide-react'; // Plus ko import karo
import { postToSheet, submitToMaster, uploadFile } from '@/lib/fetchers';
import type { IndentSheet, StoreOutSheet } from '@/types';
import { useSheets } from '@/context/SheetsContext';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';


export default () => {
    const { indentSheet: sheet, storeOutSheet, updateIndentSheet, updateStoreOutSheet, masterSheet: options } = useSheets();
    const [indentSheet, setIndentSheet] = useState<IndentSheet[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchTermGroupHead, setSearchTermGroupHead] = useState("");
    const [searchTermProductName, setSearchTermProductName] = useState("");
    const [newProductName, setNewProductName] = useState<{ [key: number]: string }>({});
    const [showAddProduct, setShowAddProduct] = useState<{ [key: number]: boolean }>({});
    const [localProducts, setLocalProducts] = useState<{ [key: string]: string[] }>({});
    const [searchTermCategory, setSearchTermCategory] = useState("");
    const [searchTermWard, setSearchTermWard] = useState("");


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
                    department: z.string().optional(),
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
                if (!p.department) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'department'] });
                if (!p.groupHead) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'groupHead'] });
                if (!p.productName) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'productName'] });
                if (!p.uom) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'uom'] });
                if (!p.areaOfUse) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'areaOfUse'] });
            });
        } else if (data.indentType === 'Store Out') {
            data.products.forEach((p, i) => {
                if (!p.department) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'department'] });
                if (!p.wardName) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'wardName'] });
                if (!p.category) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'category'] });
                if (!p.productName) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'productName'] });
                if (!p.uom) ctx.addIssue({ code: 'custom', message: 'Required', path: ['products', i, 'uom'] });
            });
        }
    });


    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            indenterName: '',
            indentApproveBy: '',
            indentType: '' as any, // Change from undefined to ''
            products: [
                {
                    attachment: undefined,
                    uom: '',
                    productName: '',
                    specifications: '',
                    quantity: 1,
                    areaOfUse: '',
                    groupHead: '',
                    department: '',
                    // Initialize Store Out specific fields to avoid uncontrolled warnings
                    wardName: '',
                    category: '',
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


    // Function to generate next indent number
    const getNextIndentNumber = () => {
        if (indentSheet.length === 0) {
            return 'SI-0001';
        }

        const indentNumbers = indentSheet
            .map(row => row.indentNumber)
            .filter(num => num && num.startsWith('SI-'))
            .map(num => parseInt(num.replace('SI-', ''), 10))
            .filter(num => !isNaN(num));

        const maxNumber = Math.max(...indentNumbers, 0);
        const nextNumber = maxNumber + 1;

        return `SI-${String(nextNumber).padStart(4, '0')}`;
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
        try {
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

            if (data.indentType === 'Store Out') {
                // STORE OUT sheet submission
                const storeOutRows: Partial<StoreOutSheet>[] = [];


                for (let i = 0; i < data.products.length; i++) {
                    const product = data.products[i];

                    // const storeOutRow: Partial<StoreOutSheet> = {
                    //     timestamp: timestamp,
                    //     // Match Column B: Issue No
                    //     issueNo: currentIssueNumber,
                    //     indentNumber: currentIssueNumber,
                    //     // Match Column C: Issue Date
                    //     issueDate: product.issueDate ? formatDate(new Date(product.issueDate)) : issueDate,
                    //     // Match Column D: Requested By
                    //     requestedBy: product.requestedBy || data.indenterName || '',
                    //     // Match Column E: Floor
                    //     floor: product.floor || '',
                    //     // Match Column F: Ward Name
                    //     wardName: product.wardName || '',
                    //     // Match Column G: Qty
                    //     qty: Number(product.quantity) || 0,
                    //     quantity: Number(product.quantity) || 0,
                    //     // Match Column H: Unit
                    //     unit: product.uom || '',
                    //     uom: product.uom || '',
                    //     // Match Column I: Department
                    //     department: product.department || '',
                    //     // Match Column J: Category
                    //     category: product.category || '',
                    //     groupHead: product.category || '',
                    //     // Match Product Name (Missing in previous version but required)
                    //     productName: product.productName || '',
                    //     // Match Column K: Area Of Use
                    //     areaOfUse: product.areaOfUse || '',
                    //     // App Specific
                    //     indentType: 'Store Out'
                    // };


                    // Using camelCase keys that backend expects for store_out_request
                    const storeOutRow: any = {
                        timestamp: timestamp,
                        issueDate: product.issueDate ? formatDate(new Date(product.issueDate)) : issueDate,
                        indenterName: data.indenterName || '',
                        indentType: data.indentType || 'Store Out',
                        approvalNeeded: data.indentApproveBy || '',
                        requestedBy: data.indenterName || '',
                        floor: product.floor || '',
                        wardName: product.wardName || '',
                        qty: Number(product.quantity) || 0,
                        unit: product.uom || '',
                        department: product.department || '',
                        category: product.category || '',
                        areaOfUse: product.areaOfUse || '',
                        planned7: timestamp, // planned_7 in SQL
                        status: 'Pending'
                    };


                    storeOutRows.push(storeOutRow);
                }

                console.log("=== STORE OUT REQUEST SUBMISSION ===");
                console.log(JSON.stringify(storeOutRows, null, 2));

                const res = await postToSheet(storeOutRows, 'insert', 'STORE OUT REQUEST');
                console.log("Response:", res);

                if (res.success) {
                    toast.success('Store Out created successfully!');

                    // Submit custom ward names to MASTER Column R if any
                    for (const product of data.products) {
                        const finalWardName = product.wardName;
                        if (finalWardName) {
                            submitToMaster(finalWardName);
                        }
                    }

                    setTimeout(() => updateStoreOutSheet(), 1000);
                } else {
                    toast.error(res.message || 'Failed to create Store Out');
                }

            } else {
                // INDENT sheet submission (Purchase type)
                const indentRows: Partial<IndentSheet>[] = [];
                let currentIndentNumber = getNextIndentNumber();

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

                console.log("=== INDENT SUBMISSION ===");
                console.log("Rows to submit:", JSON.stringify(indentRows, null, 2));

                const res = await postToSheet(indentRows, 'insert', 'INDENT');
                console.log("Response:", res);

                if (res.success) {
                    toast.success(`Purchase indent created! Indent No: ${indentRows.map(r => r.indentNumber).join(', ')}`);

                    // Submit custom ward names to MASTER Column R if any
                    for (const product of data.products) {
                        const finalWardName = product.areaOfUse;
                        if (finalWardName) {
                            submitToMaster(finalWardName);
                        }
                    }

                    setTimeout(() => updateIndentSheet(), 1000);
                } else {
                    toast.error(res.message || 'Failed to create indent');
                }
            }

            form.reset();
            setLocalProducts({});
            setNewProductName({});
            setShowAddProduct({});

        } catch (error) {
            console.error('=== SUBMIT ERROR ===');
            console.error('Error:', error);
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

                            // Combine master sheet products + local products
                            const masterProducts = options?.groupHeads[groupHead] || [];
                            const localGroupProducts = localProducts[groupHead] || [];
                            const productOptions = [...masterProducts, ...localGroupProducts];


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
                                                    onClick={() =>
                                                        append({
                                                            department: '',
                                                            groupHead: '',
                                                            productName: '',
                                                            quantity: 1,
                                                            uom: '',
                                                            areaOfUse: '',
                                                            // @ts-ignore
                                                            priority: undefined,
                                                            attachment: undefined,
                                                            wardName: '',
                                                            category: '',
                                                            issueDate: new Date().toISOString().split('T')[0],
                                                        })
                                                    }
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

                                        <FormField
                                            control={form.control}
                                            name={`products.${index}.department`}
                                            render={({ field }) => (
                                                <FormItem className="md:col-span-1">
                                                    <FormLabel className="text-sm">Department<span className="text-destructive">*</span></FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="w-full h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <div className="flex items-center border-b px-3 pb-3">
                                                                <Search className="mr-2 h-4 w-4 opacity-50" />
                                                                <input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="flex h-10 w-full bg-transparent text-sm outline-none" />
                                                            </div>
                                                            {[...new Set(options?.departments || [])].filter(d => d.toLowerCase().includes(searchTerm.toLowerCase())).map((d, i) => (
                                                                <SelectItem key={`${d}-${i}`} value={d}>{d}</SelectItem>
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
                                                        <Select onValueChange={field.onChange} value={field.value} disabled={!groupHead}>
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
                                                                        <Input placeholder="New product" value={newProductName[index] || ''} onChange={(e) => setNewProductName(prev => ({ ...prev, [index]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNewProductLocally(index, groupHead!))} className="h-9" />
                                                                        <Button type="button" size="sm" onClick={() => addNewProductLocally(index, groupHead!)}>Add</Button>
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
                                                            <FormControl><Input type="file" onChange={(e) => field.onChange(e.target.files?.[0])} className="h-9" /></FormControl>
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

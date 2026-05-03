
import { useDatabase } from '@/context/DatabaseContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { useRef } from 'react';
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
import { postToDB, uploadFileToSupabase } from '@/lib/fetchers';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ShoppingCart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { formatDate } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../ui/table";

import { useCallback } from 'react';

interface EditedData {
    product?: string;
    quantity?: number;
    uom?: string;
    qty?: number;
    billNumber?: string;
    leadTime?: string;
    typeOfBill?: string;
    billAmount?: number;
    discountAmount?: number;
    paymentType?: string;
    advanceAmount?: number;
    rate?: number;
    photoOfBill?: string; // For storing the URL string
    photoOfBillFile?: File | null; // For handling file uploads
}





interface GetPurchaseData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    poNumber: string;
    approvedRate: number;
    searialNumber?: string | number;
}


interface HistoryData {
    id?: number;
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    poNumber: string;
    billStatus: string;
    date: string;
    searialNumber?: string | number;
}

// New interface for showing all products with same PO
interface ProductDetail {
    indentNo: string;
    product: string;
    quantity: number;
    uom: string;
    rate: number;
    qty?: number;
    searialNumber?: string | number;
}
interface EditedData {
    product?: string;
    quantity?: number;
    uom?: string;
    qty?: number;
    billNumber?: string;
    leadTime?: string;
    typeOfBill?: string;
    billAmount?: number;
    discountAmount?: number;
    paymentType?: string;
    advanceAmount?: number;
    rate?: number;
    photoOfBillFile?: File | null; // File support
}




export default () => {
    const { indentData, indentLoading, updateIndentData } = useDatabase();
    const { user } = useAuth();


    const [selectedIndent, setSelectedIndent] = useState<GetPurchaseData | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [tableData, setTableData] = useState<GetPurchaseData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [rateOptions, setRateOptions] = useState<string[]>([]);
    const [relatedProducts, setRelatedProducts] = useState<ProductDetail[]>([]);
    const [productRates, setProductRates] = useState<{ [key: string]: number }>({});
    const [productQty, setProductQty] = useState<{ [key: string]: number }>({});
    const [editingRow, setEditingRow] = useState<string | number | null>(null);
    const [editedData, setEditedData] = useState<{ [key: string]: EditedData }>({});




    const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});


    // const [editedData, setEditedData] = useState<{ product?: string; quantity?: number; uom?: string }>({});
    // const [editedData, setEditedData] = useState<{ [indentNo: string]: { product?: string; quantity?: number; uom?: string; qty?: number; billNumber?: string; leadTime?: string; typeOfBill?: string; billAmount?: number; discountAmount?: number; paymentType?: string; advanceAmount?: number; rate?: number; photoOfBill?: string } }>({});
    // Fetching table data - updated
    useEffect(() => {
        // Unique PO numbers ke liye Set use karo
        const seenPoNumbers = new Set();

        const uniqueTableData = indentData
            .filter((sheet) => sheet.planned7 !== '' && sheet.actual7 == '')
            .filter((sheet) => {
                // Agar PO number pehle se nahi dekha hai toh include karo
                if (!sheet.poNumber || seenPoNumbers.has(sheet.poNumber)) {
                    return false;
                }
                seenPoNumbers.add(sheet.poNumber);
                return true;
            })
            .map((sheet) => ({
                id: sheet.id,
                indentNo: sheet.indentNumber,
                indenter: sheet.indenterName,
                department: sheet.department,
                product: sheet.productName,
                quantity: sheet.approvedQuantity,
                uom: sheet.uom,
                poNumber: sheet.poNumber,
                approvedRate: sheet.approvedRate,
                searialNumber: sheet.searialNumber
            }))
            .reverse();

        setTableData(uniqueTableData);

        // History data (yahan unique nahi karna kyunki history me sab dikhna chahiye)
        setHistoryData(
            indentData
                .filter((sheet) => sheet.planned7 !== '' && sheet.actual7 !== '')
                .map((sheet) => ({
                    id: sheet.id,
                    date: formatDate(new Date(sheet.actual5)),
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    quantity: sheet.approvedQuantity,
                    uom: sheet.uom,
                    poNumber: sheet.poNumber,
                    billStatus: sheet.billStatus || 'Not Updated',
                    searialNumber: sheet.searialNumber,
                }))
                .sort((a, b) => b.indentNo.localeCompare(a.indentNo))
        );
    }, [indentData]);

    // Fetch related products when dialog opens
    useEffect(() => {
        if (selectedIndent && openDialog) {
            const matchingRows = indentData.filter(
                (sheet) => sheet.poNumber === selectedIndent.poNumber
            );

            const products = matchingRows.map((sheet) => ({
                id: sheet.id,
                indentNo: sheet.indentNumber,
                product: sheet.productName,
                quantity: sheet.approvedQuantity,
                uom: sheet.uom,
                rate: sheet.approvedRate, // Include existing rate
                qty: sheet.qty || 0,
                searialNumber: sheet.searialNumber,
            }));

            setRelatedProducts(products);

            // Initialize productRates/productQty state with existing values
            const ratesMap: { [key: string]: number } = {};
            const qtyMap: { [key: string]: number } = {};
            products.forEach(p => {
                const key = p.id ? String(p.id) : (p.searialNumber ? String(p.searialNumber) : `${p.indentNo}-${p.product}`);
                ratesMap[key] = p.rate;
                qtyMap[key] = p.qty || p.quantity;
            });
            setProductRates(ratesMap);
            setProductQty(qtyMap);
        }
    }, [selectedIndent, openDialog, indentData]);
    const handleQtyChange = (key: string, value: string) => {
        setProductQty((prev) => ({
            ...prev,
            [key]: parseFloat(value) || 0,
        }));
    };



    // Creating table columns
    const columns: ColumnDef<GetPurchaseData>[] = [
        ...(user.receiveItemAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<GetPurchaseData> }) => {
                        const indent = row.original;


                        return (
                            <div>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedIndent(indent);
                                        }}
                                    >
                                        Update
                                    </Button>
                                </DialogTrigger>
                            </div>
                        );
                    },
                },
            ]
            : []),
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => (getValue() as string || '').split(/[_/]/)[0]
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
        },
        {
            accessorKey: 'department',
            header: 'Department',
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
        },
        {
            accessorKey: 'approvedRate', // ✅ Naya column add kiya
            header: 'Approved Rate',
            cell: ({ getValue }) => `₹${getValue()}`,
        },
    ];


    const historyColumns: ColumnDef<HistoryData>[] = [
        {
            header: 'Action',
            cell: ({ row }) => {
                const rowKey = row.original.id ? String(row.original.id) : (row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`);
                const isEditing = editingRow === rowKey;
                return (
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                        try {
                                            const sheetRow = indentData.find(s =>
                                                s.id === row.original.id ||
                                                s.searialNumber === row.original.searialNumber ||
                                                (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                                            );
                                            if (sheetRow) {
                                                const currentEdit = editedData[rowKey];

                                                let photoUrl = sheetRow.photoOfBill || '';

                                                // agar naya file select hua hai to upload karo
                                                if (currentEdit?.photoOfBillFile) {
                                                    photoUrl = await uploadFileToSupabase(
                                                        currentEdit.photoOfBillFile,
                                                        'bill'
                                                    );
                                                }

                                                await postToDB(
                                                    [
                                                        {
                                                            ...sheetRow, // Spread existing row data
                                                            actual7: formatDate(new Date()),
                                                            billStatus: sheetRow.billStatus || 'Updated',
                                                            billNumber: currentEdit?.billNumber || sheetRow.billNumber || '',
                                                            qty: currentEdit?.qty || sheetRow.qty || sheetRow.approvedQuantity,
                                                            leadTimeToLiftMaterial: currentEdit?.leadTime || sheetRow.leadTimeToLiftMaterial || '',
                                                            typeOfBill: currentEdit?.typeOfBill || sheetRow.typeOfBill || '',
                                                            billAmount: currentEdit?.billAmount || sheetRow.billAmount || 0,
                                                            discountAmount: currentEdit?.discountAmount || sheetRow.discountAmount || 0,
                                                            paymentType: currentEdit?.paymentType || sheetRow.paymentType || '',
                                                            advanceAmountIfAny: currentEdit?.advanceAmount || sheetRow.advanceAmountIfAny || 0,
                                                            photoOfBill: photoUrl,
                                                            rate: currentEdit?.rate || sheetRow.rate || sheetRow.approvedRate || 0,
                                                        },
                                                    ],
                                                    'update'
                                                );

                                                toast.success('Updated successfully');
                                                setTimeout(() => updateIndentData(), 1000);
                                            }
                                        } catch {
                                            toast.error('Failed to update');
                                        }
                                        setEditingRow(null);
                                        setEditedData((prev) => {
                                            const newData = { ...prev };
                                            delete newData[rowKey];
                                            return newData;
                                        });
                                    }}

                                >
                                    💾 Save
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setEditingRow(null);
                                        setEditedData((prev) => {
                                            const newData = { ...prev };
                                            delete newData[rowKey];
                                            return newData;
                                        });
                                    }}
                                >
                                    ❌ Cancel
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setEditingRow(rowKey);
                                    const sheetRow = indentData.find(s =>
                                        s.id === row.original.id ||
                                        s.searialNumber === row.original.searialNumber ||
                                        (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                                    );
                                    setEditedData(prev => ({
                                        ...prev,
                                        [rowKey]: {
                                            product: row.original.product,
                                            quantity: row.original.quantity,
                                            uom: row.original.uom,
                                            qty: sheetRow?.qty || row.original.quantity,
                                            billNumber: sheetRow?.billNumber || '',
                                            leadTime: sheetRow?.leadTimeToLiftMaterial || '',
                                            typeOfBill: sheetRow?.typeOfBill || '',
                                            billAmount: sheetRow?.billAmount || 0,
                                            discountAmount: sheetRow?.discountAmount || 0,
                                            paymentType: sheetRow?.paymentType || '',
                                            advanceAmount: sheetRow?.advanceAmountIfAny || 0,
                                            rate: sheetRow?.approvedRate || 0,
                                        }
                                    }));
                                }}
                            >
                                ✏️ Edit
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'date',
            header: 'Date',
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => (getValue() as string || '').split(/[_/]/)[0]
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
        },
        {
            accessorKey: 'department',
            header: 'Department',
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                return (
                    <div className="flex items-center gap-2 max-w-[150px]">
                        {isEditing ? (
                            <Input
                                key={rowKey}
                                value={editedData[rowKey]?.product || ''}
                                onChange={(e) => {
                                    setEditedData(prev => ({
                                        ...prev,
                                        [rowKey]: {
                                            ...prev[rowKey],
                                            product: e.target.value,
                                        }
                                    }));
                                }}
                                className="h-8"
                            />
                        ) : (
                            <div className="break-words whitespace-normal">{row.original.product}</div>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                return isEditing ? (
                    <Input
                        type="number"
                        value={editedData[rowKey]?.quantity || 0}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [rowKey]: {
                                    ...prev[rowKey],
                                    quantity: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-20"
                    />
                ) : (
                    row.original.quantity
                );
            },
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                return isEditing ? (
                    <Input
                        value={editedData[rowKey]?.uom || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [rowKey]: {
                                    ...prev[rowKey],
                                    uom: e.target.value,
                                }
                            }));
                        }}
                        className="h-8 w-20"
                    />
                ) : (
                    row.original.uom
                );
            },
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
        },
        // Editable columns BF to BO
        {
            id: 'billNumber',
            header: 'Bill Number',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                const sheetRow = indentData.find(s =>
                    s.searialNumber === row.original.searialNumber ||
                    (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                );
                return isEditing ? (
                    <Input
                        value={editedData[rowKey]?.billNumber || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [rowKey]: {
                                    ...prev[rowKey],
                                    billNumber: e.target.value,
                                }
                            }));
                        }}
                        className="h-8 w-full"
                    />
                ) : (
                    sheetRow?.billNumber || '-'
                );
            },
        },
        {
            id: 'qty',
            header: 'Qty',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                const sheetRow = indentData.find(s =>
                    s.searialNumber === row.original.searialNumber ||
                    (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                );
                return isEditing ? (
                    <Input
                        type="number"
                        value={editedData[rowKey]?.qty || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [rowKey]: {
                                    ...prev[rowKey],
                                    qty: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-20"
                    />
                ) : (
                    sheetRow?.qty || row.original.quantity
                );
            },
        },
        {
            id: 'leadTime',
            header: 'Lead Time',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                const sheetRow = indentData.find(s =>
                    s.searialNumber === row.original.searialNumber ||
                    (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                );
                return isEditing ? (
                    <Input
                        value={editedData[rowKey]?.leadTime || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [rowKey]: {
                                    ...prev[rowKey],
                                    leadTime: e.target.value,
                                }
                            }));
                        }}
                        className="h-8 w-full"
                    />
                ) : (
                    sheetRow?.leadTimeToLiftMaterial || '-'
                );
            },
        },
        {
            id: 'typeOfBill',
            header: 'Type Of Bill',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                const sheetRow = indentData.find(s =>
                    s.searialNumber === row.original.searialNumber ||
                    (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                );
                return isEditing ? (
                    <Input
                        value={editedData[rowKey]?.typeOfBill || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [rowKey]: {
                                    ...prev[rowKey],
                                    typeOfBill: e.target.value,
                                }
                            }));
                        }}
                        className="h-8 w-full"
                    />
                ) : (
                    sheetRow?.typeOfBill || '-'
                );
            },
        },
        {
            id: 'billAmount',
            header: 'Bill Amount',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                const sheetRow = indentData.find(s =>
                    s.searialNumber === row.original.searialNumber ||
                    (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                );
                return isEditing ? (
                    <Input
                        type="number"
                        value={editedData[rowKey]?.billAmount || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [rowKey]: {
                                    ...prev[rowKey],
                                    billAmount: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-24"
                    />
                ) : (
                    sheetRow?.billAmount ? `₹${sheetRow.billAmount}` : '-'
                );
            },
        },
        {
            id: 'discountAmount',
            header: 'Discount Amt',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                const sheetRow = indentData.find(s =>
                    s.searialNumber === row.original.searialNumber ||
                    (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                );
                return isEditing ? (
                    <Input
                        type="number"
                        value={editedData[rowKey]?.discountAmount || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [rowKey]: {
                                    ...prev[rowKey],
                                    discountAmount: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-24"
                    />
                ) : (
                    sheetRow?.discountAmount ? `₹${sheetRow.discountAmount}` : '-'
                );
            },
        },
        {
            id: 'paymentType',
            header: 'Payment Type',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                const sheetRow = indentData.find(s =>
                    s.searialNumber === row.original.searialNumber ||
                    (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                );
                return isEditing ? (
                    <Input
                        value={editedData[rowKey]?.paymentType || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [rowKey]: {
                                    ...prev[rowKey],
                                    paymentType: e.target.value,
                                }
                            }));
                        }}
                        className="h-8 w-full"
                    />
                ) : (
                    sheetRow?.paymentType || '-'
                );
            },
        },
        {
            id: 'advanceAmount',
            header: 'Advance Amt',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                const sheetRow = indentData.find(s =>
                    s.searialNumber === row.original.searialNumber ||
                    (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                );
                return isEditing ? (
                    <Input
                        type="number"
                        value={editedData[rowKey]?.advanceAmount || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [rowKey]: {
                                    ...prev[rowKey],
                                    advanceAmount: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-24"
                    />
                ) : (
                    sheetRow?.advanceAmountIfAny ? `₹${sheetRow.advanceAmountIfAny}` : '-'
                );
            },
        },
        {
            id: 'photoOfBill',
            header: 'Bill Photo',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                const sheetRow = indentData.find(s =>
                    s.searialNumber === row.original.searialNumber ||
                    (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                );
                if (isEditing) {
                    return (
                        <div className="flex items-center gap-2">
                            {/* Nice compact upload button */}
                            <label className="inline-flex items-center px-2 py-1 text-xs font-medium border border-dashed border-primary/50 rounded-md bg-primary/5 text-primary cursor-pointer hover:bg-primary/10">
                                Choose image
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setEditedData((prev) => ({
                                            ...prev,
                                            [rowKey]: {
                                                ...prev[rowKey],
                                                photoOfBillFile: file,
                                            },
                                        }));
                                    }}
                                />
                            </label>

                            {/* Existing image link */}
                            {sheetRow?.photoOfBill && (
                                <a
                                    href={sheetRow.photoOfBill}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                >
                                    View
                                </a>
                            )}
                        </div>
                    );
                }

                return sheetRow?.photoOfBill ? (
                    <a
                        href={sheetRow.photoOfBill}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                    >
                        View
                    </a>
                ) : (
                    '-'
                );
            },
        },

        {
            id: 'approvedRate',
            header: 'Rate',
            cell: ({ row }) => {
                const rowKey = row.original.searialNumber ? String(row.original.searialNumber) : `${row.original.indentNo}-${row.original.product}`;
                const isEditing = editingRow === rowKey;
                const sheetRow = indentData.find(s =>
                    s.searialNumber === row.original.searialNumber ||
                    (s.indentNumber === row.original.indentNo && s.productName === row.original.product)
                );
                return isEditing ? (
                    <Input
                        type="number"
                        value={editedData[rowKey]?.rate || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [rowKey]: {
                                    ...prev[rowKey],
                                    rate: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-24"
                    />
                ) : (
                    `₹${sheetRow?.approvedRate || sheetRow?.rate || 0}`
                );
            },
        },
        {
            accessorKey: 'billStatus',
            header: 'Bill Status',
            cell: ({ row }) => {
                const status = row.original.billStatus;
                const variant = status === 'Bill Received' ? 'primary' : 'secondary';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
    ];


    // Creating form schema
    const formSchema = z.object({
        billStatus: z.string().nonempty('Bill status is required'),

        billNo: z.string().optional(),
        // qty: z.coerce.number().optional(),
        leadTime: z.string().optional(),
        typeOfBill: z.string().optional(),
        billAmount: z.coerce.number().optional(),
        discountAmount: z.coerce.number().optional(),
        paymentType: z.string().optional(),
        advanceAmount: z.coerce.number().optional(),
        photoOfBill: z.instanceof(File).optional(),
    });


    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            billStatus: '',

            billNo: '',
            // qty: undefined,
            leadTime: '',
            typeOfBill: '',
            billAmount: 0,
            discountAmount: 0,
            paymentType: '',
            advanceAmount: 0,
        },
    });


    const billStatus = form.watch('billStatus');
    const typeOfBill = form.watch('typeOfBill');

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            let photoUrl: string | undefined;
            if (values.photoOfBill) {
                try {
                    photoUrl = await uploadFileToSupabase(values.photoOfBill, 'bill');
                } catch (err) {
                    console.error("Supabase upload error:", err);
                    toast.error("Failed to upload bill photo");
                    return;
                }
            }

            // Update ALL rows with matching PO Number
            await postToDB(
                indentData
                    .filter((s) => s.poNumber === selectedIndent?.poNumber)
                    .map((prev) => {
                        const key = prev.searialNumber ? String(prev.searialNumber) : `${prev.indentNumber}-${prev.productName}`;
                        return {
                            id: prev.id,
                            indentNumber: prev.indentNumber,
                            actual7: formatDate(new Date()),
                            billStatus: values.billStatus,
                            billNumber: values.billNo || '',
                            qty: productQty[key] || prev.approvedQuantity,
                            leadTimeToLiftMaterial: values.leadTime || '',
                            typeOfBill: values.typeOfBill || '',
                            billAmount: values.billAmount || 0,
                            discountAmount: values.discountAmount || 0,
                            paymentType: values.paymentType || '',
                            advanceAmountIfAny: values.advanceAmount || 0,
                            photoOfBill: photoUrl,
                            rate: productRates[key] || prev.approvedRate || 0,
                            searialNumber: prev.searialNumber
                        };
                    }),
                'update'
            );

            toast.success(`Updated purchase details for PO ${selectedIndent?.poNumber}`);
            setOpenDialog(false);
            form.reset();
            setProductRates({});
            setProductQty({}); // Add this line to reset qty
            setTimeout(() => updateIndentData(), 1000);
        } catch {
            toast.error('Failed to update purchase details');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }


    return (
        <div className="flex flex-col gap-5 h-full w-full max-w-full overflow-hidden">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending" className="w-full flex-1 flex flex-col min-h-0">
                    <Heading
                        heading="Get Purchase"
                        subtext="Manage purchase bill details and status"
                        tabs
                    >
                        <ShoppingCart size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending" className="flex-1 min-h-0 w-full overflow-hidden">
                        <div className="w-full h-full overflow-x-auto overflow-y-hidden">
                            <DataTable
                                data={tableData}
                                columns={columns}
                                searchFields={['product', 'department', 'indenter', 'poNumber']}
                                dataLoading={indentLoading}
                                className='h-[74dvh]'
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="history" className="flex-1 min-h-0 w-full overflow-hidden">
                        <div className="w-full h-full overflow-x-auto overflow-y-hidden">
                            <DataTable
                                data={historyData}
                                columns={historyColumns}
                                searchFields={['product', 'department', 'indenter', 'poNumber']}
                                dataLoading={indentLoading}
                                className='h-[74dvh]'
                            />
                        </div>
                    </TabsContent>
                </Tabs>


                {selectedIndent && (
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <Form {...form}>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault(); // ✅ Enter key se submit block
                                }}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Update Purchase Details</DialogTitle>
                                    <DialogDescription>
                                        Update purchase details for PO Number:{' '}
                                        <span className="font-medium">
                                            {selectedIndent.poNumber}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-2 bg-muted p-2 rounded-md">
                                    <p className="font-semibold text-sm px-2 py-1">Products in this PO</p>
                                    <div className="max-h-[350px] overflow-y-auto rounded-md border bg-background">
                                        <Table>
                                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                                <TableRow>
                                                    <TableHead className="text-xs font-bold py-2 text-foreground">Indent No.</TableHead>
                                                    <TableHead className="text-xs font-bold py-2 text-foreground">Product</TableHead>
                                                    <TableHead className="text-xs font-bold py-2 text-center text-foreground">Qty</TableHead>
                                                    <TableHead className="text-xs font-bold py-2 text-center text-foreground">UOM</TableHead>
                                                    <TableHead className="text-xs font-bold py-2 text-right text-foreground">Appr. Rate</TableHead>
                                                    <TableHead className="text-xs font-bold py-2 text-center min-w-[100px] text-foreground">Update Qty</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {relatedProducts.map((product, index) => {
                                                    const key = product.searialNumber ? String(product.searialNumber) : `${product.indentNo}-${product.product}`;
                                                    return (
                                                        <TableRow key={index} className="hover:bg-muted/30">
                                                            <TableCell className="text-xs py-2">{product.indentNo}</TableCell>
                                                            <TableCell className="text-xs py-2 max-w-[150px] truncate" title={product.product}>
                                                                {product.product}
                                                            </TableCell>
                                                            <TableCell className="text-xs py-2 text-center">{product.quantity}</TableCell>
                                                            <TableCell className="text-xs py-2 text-center">{product.uom}</TableCell>
                                                            <TableCell className="text-xs py-2 text-right font-mono">₹{product.rate || 0}</TableCell>
                                                            <TableCell className="py-1">
                                                                <Input
                                                                    type="number"
                                                                    placeholder="Qty"
                                                                    value={productQty[key] || ''}
                                                                    onChange={(e) => handleQtyChange(key, e.target.value)}
                                                                    className="h-8 text-xs w-full"
                                                                />
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>


                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="billStatus"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bill Status *</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select bill status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Bill Received">
                                                            Bill Received
                                                        </SelectItem>
                                                        <SelectItem value="Bill Not Received">
                                                            Bill Not Received
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />

                                    {billStatus === 'Bill Received' && (
                                        <>
                                            <FormField
                                                control={form.control}
                                                name="billNo"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Bill No. *</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter bill number"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </>
                                    )}

                                    {billStatus && (
                                        <>


                                            <FormField
                                                control={form.control}
                                                name="leadTime"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Lead Time To Lift Material *</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter lead time"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="typeOfBill"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Type Of Bill *</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select type of bill" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="independent">
                                                                    Independent
                                                                </SelectItem>
                                                                <SelectItem value="common">
                                                                    Common
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {typeOfBill === 'independent' && (
                                                <>
                                                    <FormField
                                                        control={form.control}
                                                        name="billAmount"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Bill Amount *</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Enter bill amount"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="discountAmount"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Discount Amount</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Enter discount amount"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="paymentType"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Payment Type</FormLabel>
                                                                <Select
                                                                    onValueChange={field.onChange}
                                                                    value={field.value}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select payment type" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="Advance">
                                                                            Advance
                                                                        </SelectItem>
                                                                        <SelectItem value="Credit">
                                                                            Credit
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="advanceAmount"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Advance Amount If Any</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Enter advance amount"
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
                                                                <FormLabel>Photo Of Bill</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        onChange={(e) =>
                                                                            field.onChange(e.target.files?.[0])
                                                                        }
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline" type="button">Close</Button>
                                    </DialogClose>
                                    <Button
                                        type="button" // ✅ type="button" karo
                                        onClick={form.handleSubmit(onSubmit, onError)} // ✅ onClick mein submit karo
                                        disabled={form.formState.isSubmitting}
                                    >
                                        {form.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        Update
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};

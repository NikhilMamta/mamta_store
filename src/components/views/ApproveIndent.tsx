
import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState, useMemo } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import { DownloadOutlined } from "@ant-design/icons";

import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { postToDB } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { Tabs, TabsContent } from '../ui/tabs';
import { ClipboardCheck, PenSquare, Search } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { Input } from '../ui/input';

const statuses = ['Pending', 'Reject', 'Three Party', 'Regular'];

interface ApproveTableData {
    id?: number;
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    vendorType: 'Pending' | 'Reject' | 'Three Party' | 'Regular';
    date: string;
    attachment: string;
    specifications: string;
    serialNumber?: string | number;
}

interface HistoryData {
    id?: number;
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    uom: string;
    approvedQuantity: number;
    vendorType: 'Reject' | 'Three Party' | 'Regular';
    date: string;
    approvedDate: string;
    specifications: string;
    lastUpdated?: string;
    serialNumber?: string | number;
    groupHead?: string;
}

export default () => {
    const { indentData, indentLoading, updateIndentData, approvedIndentData, updateApprovedIndentData, masterData } = useDatabase();
    const { user } = useAuth();

    const [tableData, setTableData] = useState<ApproveTableData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [editingRow, setEditingRow] = useState<string | null>(null); // Uses ID as string
    const [editValues, setEditValues] = useState<Partial<HistoryData>>({});
    const [loading, setLoading] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [bulkUpdates, setBulkUpdates] = useState<Map<string, { vendorType?: string; quantity?: number; specifications?: string }>>(new Map());
    const [submitting, setSubmitting] = useState(false);

    // Fetching table data
    useEffect(() => {
        // PENDING TAB: only show indents where status = 'Pending' in indent table
        setTableData(
            indentData
                .filter(
                    (sheet) => sheet.status?.trim().toLowerCase() === 'pending' && sheet.indentType?.trim() === 'Purchase'
                )
                .map((sheet: any, index: number) => ({
                    id: sheet.id || sheet.indentNumber,
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    quantity: sheet.quantity,
                    uom: sheet.uom,
                    attachment: sheet.attachment,
                    specifications: sheet.specifications || '',
                    vendorType: (sheet.vendorType || 'Pending') as ApproveTableData['vendorType'],
                    date: formatDate(new Date(sheet.timestamp)),
                    serialNumber: index + 1,
                    status: sheet.status,
                }))
                .reverse()
        );

        // HISTORY TAB: only show indents where status = 'Approved' from indent table
        // enrich with approved_indent data when available
        setHistoryData(
            indentData
                .filter(
                    (sheet) => sheet.status?.trim().toLowerCase() === 'approved' && sheet.indentType?.trim() === 'Purchase'
                )
                .map((sheet: any, index: number) => {
                    const approval = approvedIndentData.find(a => a.indentNumber === sheet.indentNumber);
                    return {
                        id: approval?.id || sheet.id || sheet.indentNumber,
                        indentNo: sheet.indentNumber,
                        indenter: sheet.indenterName,
                        department: sheet.department,
                        product: sheet.productName,
                        approvedQuantity: approval?.approvedQuantity || sheet.quantity,
                        vendorType: (approval?.vendorType || sheet.vendorType || 'Approved') as any,
                        uom: sheet.uom,
                        specifications: sheet.specifications || '',
                        date: formatDate(new Date(sheet.timestamp)),
                        approvedDate: approval
                            ? formatDate(new Date(approval.timestamp))
                            : 'Approved',
                        serialNumber: index + 1,
                        groupHead: sheet.groupHead,
                    };
                })
                .sort((a, b) => b.indentNo.localeCompare(a.indentNo))
        );
    }, [indentData, approvedIndentData]);

    const handleRowSelect = (id: number | string, checked: boolean) => {
        const identifier = String(id);
        const row = tableData.find(r => String(r.id) === identifier);
        if (!row) return;

        const indentNo = row.indentNo || "";
        const indentPrefix = indentNo.split(/[_/]/)[0]?.trim();

        // Find all row IDs that share the same exact indent prefix
        const relatedRows = (indentPrefix && indentPrefix.length > 0)
            ? tableData.filter(r => (r.indentNo || "").split(/[_/]/)[0]?.trim() === indentPrefix)
            : [row];

        const relatedIds = relatedRows.map(r => String(r.id));

        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (checked) {
                relatedIds.forEach(rid => newSet.add(rid));
            } else {
                newSet.delete(identifier);
            }
            return newSet;
        });

        setBulkUpdates(prev => {
            const next = new Map(prev);
            if (checked) {
                relatedRows.forEach(r => {
                    const rid = String(r.id);
                    next.set(rid, {
                        vendorType: r.vendorType,
                        quantity: r.quantity,
                        specifications: r.specifications
                    });
                });
            } else {
                next.delete(identifier);
            }
            return next;
        });
    };


    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = tableData.map(row => String(row.id));
            setSelectedRows(new Set(allIds));

            setBulkUpdates(prev => {
                const next = new Map(prev);
                tableData.forEach(row => {
                    next.set(String(row.id), {
                        vendorType: row.vendorType,
                        quantity: row.quantity,
                        specifications: row.specifications
                    });
                });
                return next;
            });
        } else {
            setSelectedRows(new Set());
            setBulkUpdates(new Map());
        }
    };

    const handleBulkUpdate = (
        identifier: string,
        field: 'vendorType' | 'quantity' | 'specifications',
        value: string | number
    ) => {
        const row = tableData.find(r => String(r.id) === identifier);
        const indentNo = row?.indentNo || "";
        const indentPrefix = indentNo.split(/[_/]/)[0]?.trim();

        setBulkUpdates((prevUpdates) => {
            const newUpdates = new Map(prevUpdates);

            // If field is quantity or specifications, only update the specific row (per-wise)
            // Otherwise, find all selected rows that share the same exact indent prefix
            const idsToUpdate = (field !== 'quantity' && field !== 'specifications' && indentPrefix && indentPrefix.length > 0)
                ? Array.from(selectedRows).filter(id => {
                    const r = tableData.find(tr => String(tr.id) === id);
                    return (r?.indentNo || "").split(/[_/]/)[0]?.trim() === indentPrefix;
                })
                : [identifier];

            idsToUpdate.forEach(id => {
                const currentUpdate = newUpdates.get(id) || {};
                newUpdates.set(id, {
                    ...currentUpdate,
                    [field]: value,
                });
            });

            return newUpdates;
        });
    };

    const handleSubmitBulkUpdates = async () => {
        if (selectedRows.size === 0) {
            toast.error('Please select at least one row to update');
            return;
        }

        setSubmitting(true);
        try {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
            const simpleDate = `${day}/${month}/${year}`;

            const indentUpdates: any[] = [];
            const approvedRecords: any[] = [];

            // 1. Process selected rows
            selectedRows.forEach(idStr => {
                const tableRow = tableData.find(r => String(r.id) === idStr);
                if (!tableRow) return;

                const originalItem = indentData.find(s =>
                    (s.id !== undefined && String(s.id) === idStr) ||
                    (s.indentNumber === idStr)
                );
                if (!originalItem) return;

                const update = bulkUpdates.get(idStr);
                if (!update) return;

                const vendorType = update.vendorType || originalItem.vendorType || 'Regular';
                const isRejected = vendorType === 'Reject';

                // 1. Prepare Update for INDENT table
                indentUpdates.push({
                    id: originalItem.id,
                    indentNumber: originalItem.indentNumber,
                    vendorType: vendorType,
                    approvedQuantity: update.quantity !== undefined ? update.quantity : originalItem.quantity,
                    specifications: update.specifications !== undefined ? update.specifications : originalItem.specifications,
                    status: 'Approved',
                });

                // 2. Prepare Insert for APPROVED INDENT table
                approvedRecords.push({
                    timestamp: formattedDate,
                    indentNumber: originalItem.indentNumber,
                    vendorType: vendorType,
                    approvedQuantity: update.quantity !== undefined ? update.quantity : originalItem.quantity,
                    status: isRejected ? 'Rejected' : 'Pending',
                });
            });

            console.log('🚀 Updating Indents:', indentUpdates);
            console.log('🚀 Creating Approved Records:', approvedRecords);

            if (indentUpdates.length > 0) {
                // Update indent status
                await postToDB(indentUpdates, 'update', 'INDENT');

                // Save to approved_indent table
                await postToDB(approvedRecords, 'insert', 'APPROVED INDENT');

                toast.success(`Approved ${indentUpdates.length} indents successfully`);

                setSelectedRows(new Set());
                setBulkUpdates(new Map());

                setTimeout(() => {
                    updateIndentData();
                    updateApprovedIndentData();
                }, 1000);
            }
        } catch (error) {
            console.error('❌ Error:', error);
            toast.error('Failed to approve indents');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownload = (data: any[]) => {
        if (!data || data.length === 0) {
            toast.error("No data to download");
            return;
        }

        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(","),
            ...data.map(row =>
                headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
            )
        ];

        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `pending-indents-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const onDownloadClick = async () => {
        setLoading(true);
        try {
            await handleDownload(tableData);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (row: HistoryData) => {
        setEditingRow(String(row.id));
        setEditValues({
            id: row.id,
            approvedQuantity: row.approvedQuantity,
            uom: row.uom,
            vendorType: row.vendorType,
            product: row.product,
        });
    };

    const handleCancelEdit = () => {
        setEditingRow(null);
        setEditValues({});
    };

    const handleSaveEdit = async (identifier: string) => {
        try {
            const id = Number(identifier);
            const currentRow = historyData.find(row => row.id === id);
            const oldProductName = currentRow?.product;
            const newProductName = editValues.product;

            // Current date in DD/MM/YYYY HH:mm:ss format
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

            // If product name changed, update all rows with the same old product name
            if (oldProductName && newProductName && oldProductName !== newProductName) {
                const rowsToUpdate = indentData.filter(s => s.productName === oldProductName);

                await postToDB(
                    rowsToUpdate.map((prev) => ({
                        id: (prev as any).id,
                        indentNumber: prev.indentNumber,
                        productName: newProductName!,
                    })),
                    'update'
                );
                toast.success(`Updated product name from "${oldProductName}" to "${newProductName}" for ${rowsToUpdate.length} records`);
            } else {
                // 1. Update INDENT table
                const isNowApproved = (editValues.vendorType && (editValues.vendorType as any) !== 'Pending');

                await postToDB(
                    indentData
                        .filter((s) => s.id === id)
                        .map((prev) => {
                            return {
                                id: prev.id,
                                indentNumber: prev.indentNumber,
                                approvedQuantity: editValues.approvedQuantity !== undefined ? editValues.approvedQuantity : prev.approvedQuantity,
                                uom: editValues.uom || prev.uom,
                                vendorType: editValues.vendorType || prev.vendorType,
                                productName: editValues.product || prev.productName,
                                status: isNowApproved ? 'Approved' : prev.status,
                                actual1: isNowApproved ? formattedDate : prev.actual1,
                            };
                        }),
                    'update',
                    'INDENT'
                );

                // 2. Handle APPROVED INDENT table
                if (currentRow && currentRow.id) {
                    // Update existing approval record
                    await postToDB([{
                        id: currentRow.id,
                        vendorType: editValues.vendorType || currentRow.vendorType,
                        approvedQuantity: editValues.approvedQuantity !== undefined ? editValues.approvedQuantity : currentRow.approvedQuantity,
                        planned2: formattedDate, // Save full time
                    }], 'update', 'APPROVED INDENT');
                } else if (isNowApproved) {
                    // Create new approval record for previously Pending item
                    await postToDB([{
                        timestamp: formattedDate,
                        indentNumber: currentRow?.indentNo,
                        vendorType: editValues.vendorType,
                        approvedQuantity: editValues.approvedQuantity !== undefined ? editValues.approvedQuantity : (currentRow?.approvedQuantity || 0),
                        delay: 'None',
                        planned2: formattedDate, // Save full time
                        status: 'Pending',
                    }], 'insert', 'APPROVED INDENT');
                }

                updateApprovedIndentData();
                toast.success(`Updated row with ID ${id}`);
            }

            updateIndentData();
            setEditingRow(null);
            setEditValues({});
        } catch {
            toast.error('Failed to update indent');
        }
    };

    const handleInputChange = (field: keyof HistoryData, value: any) => {
        setEditValues(prev => ({ ...prev, [field]: value }));
    };

    const handleSingleRowUpdate = async (indent: ApproveTableData) => {
        const identifier = String(indent.id);
        const update = bulkUpdates.get(identifier);

        if (!update || !update.vendorType || update.vendorType === 'Pending') {
            toast.error('Please select a Vendor Type first');
            return;
        }

        setSubmitting(true);
        try {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
            const simpleDate = `${day}/${month}/${year}`;

            // 1. Update INDENT table
            await postToDB([{
                id: indent.id,
                indentNumber: indent.indentNo,
                vendorType: update.vendorType,
                approvedQuantity: update.quantity !== undefined ? update.quantity : indent.quantity,
                status: 'Approved',
                actual1: formattedDate,
            }], 'update', 'INDENT');

            // 2. Insert into APPROVED INDENT table
            await postToDB([{
                timestamp: formattedDate,
                indentNumber: indent.indentNo,
                vendorType: update.vendorType,
                approvedQuantity: update.quantity !== undefined ? update.quantity : indent.quantity,
                delay: 'None',
                planned2: formattedDate, // Save full time
                status: 'Pending',
            }], 'insert', 'APPROVED INDENT');

            toast.success(`Indent ${indent.indentNo} approved!`);

            // Clean up
            setSelectedRows(prev => {
                const next = new Set(prev);
                next.delete(identifier);
                return next;
            });
            setBulkUpdates(prev => {
                const next = new Map(prev);
                next.delete(identifier);
                return next;
            });

            updateIndentData();
            updateApprovedIndentData();
        } catch (error) {
            toast.error('Failed to update indent');
        } finally {
            setSubmitting(false);
        }
    };

    // Creating table columns with mobile responsiveness
    const columns: ColumnDef<ApproveTableData>[] = useMemo(() => [
        {
            id: 'select',
            header: () => (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={tableData.length > 0 && selectedRows.size === tableData.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4"
                    />
                </div>
            ),
            cell: ({ row }: { row: Row<ApproveTableData> }) => {
                const indent = row.original;
                return (
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={selectedRows.has(String(row.original.id))}
                            onChange={(e) => handleRowSelect(indent.id!, e.target.checked)}
                            className="w-4 h-4"
                        />
                    </div>
                );
            },
            size: 50,
        },
        {
            accessorKey: 'serialNumber',
            header: 'S.No.',
            cell: ({ getValue }) => (
                <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {String(getValue() || '-')}
                </div>
            ),
            size: 60,
        },
        ...(user.indentApprovalAction
            ? [
                {
                    header: 'Vendor Type',
                    id: 'vendorTypeAction',
                    cell: ({ row }: { row: Row<ApproveTableData> }) => {
                        const indent = row.original;
                        const identifier = String(indent.id);
                        const isSelected = selectedRows.has(identifier);
                        const currentValue =
                            bulkUpdates.get(identifier)?.vendorType || indent.vendorType;

                        const handleChange = (value: string) => {
                            // ✅ Prevent selecting "Pending" (just ignore)
                            if (value === 'Pending') {
                                toast.warning('You cannot select Pending as a Vendor Type');
                                return;
                            }
                            handleBulkUpdate(identifier, 'vendorType', value);
                        };

                        return (
                            <div onClick={(e) => e.stopPropagation()}>
                                <Select
                                    value={currentValue === 'Pending' ? '' : currentValue}
                                    onValueChange={handleChange}
                                    disabled={!isSelected}
                                >
                                    <SelectTrigger
                                        className={`w-full min-w-[160px] max-w-[200px] text-xs whitespace-nowrap ${!isSelected ? 'opacity-50' : ''
                                            }`}
                                    >
                                        <SelectValue placeholder="Select Vendor Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* Removed Pending option */}
                                        <SelectItem value="Regular">Regular</SelectItem>
                                        <SelectItem value="Three Party">Three Party</SelectItem>
                                        <SelectItem value="Reject">Reject</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        );
                    },
                    size: 180,
                },

            ]
            : []),
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => (
                <div className="font-medium text-xs sm:text-sm whitespace-nowrap">
                    {(getValue() as string).split(/[_/]/)[0]}
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[120px] whitespace-nowrap">
                    {getValue() as string}
                </div>
            ),
            size: 120,
        },
        {
            accessorKey: 'department',
            header: 'Department',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[120px] whitespace-nowrap">
                    {getValue() as string}
                </div>
            ),
            size: 120,
        },
        {
            accessorKey: 'product',
            header: () => <div className="text-left">Product</div>,
            cell: ({ getValue }) => (
                <div className="min-w-[150px] max-w-[250px] text-left text-xs sm:text-sm font-medium">
                    {getValue() as string}
                </div>
            ),
            size: 200,
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ row }: { row: Row<ApproveTableData> }) => {
                const indent = row.original;
                const identifier = String(indent.id);
                const isSelected = selectedRows.has(identifier);
                const currentValue = bulkUpdates.get(identifier)?.quantity || indent.quantity;

                // Local state for input value
                const [localValue, setLocalValue] = useState(String(currentValue));

                // Update local value when currentValue changes
                useEffect(() => {
                    setLocalValue(String(currentValue));
                }, [currentValue]);

                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <Input
                            type="number"
                            value={localValue}
                            onChange={(e) => {
                                setLocalValue(e.target.value); // Only update local state
                            }}
                            onBlur={(e) => {
                                // Update bulk updates only on blur
                                const value = e.target.value;
                                if (value === '' || !isNaN(Number(value))) {
                                    handleBulkUpdate(identifier, 'quantity', Number(value) || 0);
                                }
                            }}
                            disabled={!isSelected}
                            className={`w-16 sm:w-20 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
                            min="0"
                            step="1"
                        />
                    </div>
                );
            },
            size: 80,
        },

        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm">
                    {getValue() as string}
                </div>
            ),
            size: 60,
        },
        {
            accessorKey: 'specifications',
            header: 'Specs',
            cell: ({ row }: { row: Row<ApproveTableData> }) => {
                const indent = row.original;
                const identifier = String(indent.id);
                const isSelected = selectedRows.has(identifier);
                const currentValue = bulkUpdates.get(identifier)?.specifications || indent.specifications;

                const [localValue, setLocalValue] = useState(currentValue || '');

                useEffect(() => {
                    setLocalValue(currentValue || '');
                }, [currentValue]);

                return (
                    <div className="min-w-[120px] max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                        <Input
                            value={localValue}
                            onChange={(e) => setLocalValue(e.target.value)}
                            onBlur={(e) => {
                                handleBulkUpdate(identifier, 'specifications', e.target.value);
                            }}
                            disabled={!isSelected}
                            className={`border-none focus:border-1 bg-transparent text-xs sm:text-sm h-7 p-1 ${!isSelected ? 'opacity-50' : ''}`}
                            placeholder="Add specs..."
                        />
                    </div>
                );
            },
            size: 180,
        },
        {
            accessorKey: 'attachment',
            header: 'Attachment',
            cell: ({ row }: { row: Row<ApproveTableData> }) => {
                const attachment = row.original.attachment;
                return attachment ? (
                    <a
                        href={attachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 text-xs sm:text-sm underline"
                    >
                        View
                    </a>
                ) : (
                    <span className="text-gray-400 text-xs sm:text-sm">-</span>
                );
            },
            size: 80,
        },
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm whitespace-nowrap">
                    {getValue() as string}
                </div>
            ),
            size: 100,
        },

    ], [selectedRows, bulkUpdates, submitting, user.indentApprovalAction]);

    // History columns with mobile responsiveness
    const historyColumns: ColumnDef<HistoryData>[] = useMemo(() => [
        ...(user.indentApprovalAction
            ? [
                {
                    id: 'editActions',
                    header: 'Actions',
                    cell: ({ row }: { row: Row<HistoryData> }) => {
                        const isEditing = editingRow === String(row.original.id);
                        return isEditing ? (
                            <div className="flex gap-1 sm:gap-2 justify-center">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSaveEdit(editingRow!)}
                                    className="text-xs sm:text-sm h-8 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                >
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                    className="text-xs sm:text-sm h-8 bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <div className="flex justify-center">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-primary/10 text-primary"
                                    onClick={() => handleEditClick(row.original)}
                                >
                                    <PenSquare className="h-4 w-4" />
                                </Button>
                            </div>
                        );
                    },
                    size: 120,
                },
            ]
            : []),
        {
            accessorKey: 'serialNumber',
            header: 'S.No.',
            cell: ({ getValue }) => (
                <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {String(getValue() || '-')}
                </div>
            ),
            size: 60,
        },
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
        {
            accessorKey: 'indenter',
            header: 'Indenter',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[100px]">
                    {getValue() as string}
                </div>
            ),
            size: 120,
        },
        {
            accessorKey: 'department',
            header: 'Department',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[100px]">
                    {getValue() as string}
                </div>
            ),
            size: 120,
        },
        {
            accessorKey: 'product',
            header: () => <div className="text-left">Product</div>,
            cell: ({ row }) => {
                const isEditing = editingRow === String(row.original.id);
                const groupHead = row.original.groupHead || '';
                const productOptions = masterData?.groupHeads[groupHead] ||
                    (masterData ? Object.values(masterData.groupHeads).flat() : []);

                return isEditing ? (
                    <div className="min-w-[180px] max-w-[250px]" onClick={(e) => e.stopPropagation()}>
                        <Select
                            value={editValues.product ?? row.original.product}
                            onValueChange={(value) => handleInputChange('product', value)}
                        >
                            <SelectTrigger className="w-full text-xs sm:text-sm h-8 text-left">
                                <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                                <div className="flex items-center border-b px-3 pb-3">
                                    <Search className="mr-2 h-4 w-4 opacity-50" />
                                    <input
                                        placeholder="Search product..."
                                        className="flex h-9 w-full bg-transparent text-sm outline-none"
                                        onKeyDown={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            // Simple search filtering logic can be added if needed, 
                                            // but standard Select handles basic filtering or we can just show all
                                        }}
                                    />
                                </div>
                                {[...new Set(productOptions)].map((p, i) => (
                                    <SelectItem key={`${p}-${i}`} value={p}>{p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : (
                    <div
                        className="flex items-center gap-1 sm:gap-2 min-w-[150px] max-w-[250px] text-left cursor-pointer hover:underline underline-offset-4 decoration-primary/30"
                        onClick={() => handleEditClick(row.original)}
                    >
                        <span className="text-xs sm:text-sm font-medium">{row.original.product}</span>
                    </div>
                );
            },
            size: 200,
        },
        {
            accessorKey: 'approvedQuantity',
            header: 'Quantity',
            cell: ({ row }) => {
                const isEditing = editingRow === String(row.original.id);
                return isEditing ? (
                    <Input
                        type="number"
                        value={editValues.approvedQuantity ?? row.original.approvedQuantity}
                        onChange={(e) => handleInputChange('approvedQuantity', Number(e.target.value))}
                        className="w-16 sm:w-20 text-xs sm:text-sm"
                    />
                ) : (
                    <div
                        className="text-xs sm:text-sm cursor-pointer hover:underline underline-offset-4 decoration-primary/30"
                        onClick={() => handleEditClick(row.original)}
                    >
                        {row.original.approvedQuantity}
                    </div>
                );
            },
            size: 100,
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row }) => {
                const isEditing = editingRow === String(row.original.id);
                return isEditing ? (
                    <Select
                        value={editValues.uom ?? row.original.uom}
                        onValueChange={(value) => handleInputChange('uom', value)}
                    >
                        <SelectTrigger className="w-16 sm:w-24 text-xs sm:text-sm h-8">
                            <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                            {(masterData?.units || []).map((u: string) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <div
                        className="text-xs sm:text-sm cursor-pointer hover:underline underline-offset-4 decoration-primary/30"
                        onClick={() => handleEditClick(row.original)}
                    >
                        {row.original.uom}
                    </div>
                );
            },
            size: 80,
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[120px] sm:max-w-[150px] break-words whitespace-normal text-xs sm:text-sm">
                    {getValue() as string}
                </div>
            ),
            size: 150,
        },
        {
            accessorKey: 'vendorType',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const isEditing = editingRow === String(row.original.id);
                return isEditing ? (
                    <Select
                        value={editValues.vendorType ?? row.original.vendorType}
                        onValueChange={(value) => handleInputChange('vendorType', value)}
                    >
                        <SelectTrigger className="w-[120px] sm:w-[150px] text-xs sm:text-sm">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Regular">Regular</SelectItem>
                            <SelectItem value="Regular Vendor">Regular Vendor</SelectItem>
                            <SelectItem value="Three Party">Three Party</SelectItem>
                            <SelectItem value="Reject">Reject</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <div
                        className="cursor-pointer hover:opacity-80"
                        onClick={() => handleEditClick(row.original)}
                    >
                        <Pill
                            variant={
                                row.original.vendorType === 'Reject'
                                    ? 'reject'
                                    : row.original.vendorType === 'Regular'
                                        ? 'primary'
                                        : 'secondary'
                            }
                        >
                            <span className="text-xs sm:text-sm">{row.original.vendorType}</span>
                        </Pill>
                    </div>
                );
            },
            size: 150,
        },
        {
            accessorKey: 'date',
            header: 'Request Date',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm whitespace-nowrap">
                    {getValue() as string}
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: 'approvedDate',
            header: 'Approval Date',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm whitespace-nowrap">
                    {getValue() as string}
                </div>
            ),
            size: 100,
        },
    ], [editingRow, editValues, user.indentApprovalAction]);

    return (
        <div className="flex flex-col gap-5 h-full w-full max-w-full overflow-hidden">
            <Tabs defaultValue="pending" className="w-full flex-1 flex flex-col min-h-0">
                <Heading
                    heading="Approve Indent"
                    subtext="Update Indent status to Approve or Reject them"
                    tabs
                >
                    <ClipboardCheck size={50} className="text-primary" />
                </Heading>
                <TabsContent value="pending" className="w-full">
                    <div className="space-y-4">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['product', 'department', 'indenter', 'vendorType']}
                            dataLoading={indentLoading}
                            onRowClick={(row) => handleRowSelect(String(row.id), !selectedRows.has(String(row.id)))}
                            className="h-[calc(100vh-280px)] shadow-md rounded-xl border-green-100/50"
                            extraActions={
                                <div className="flex items-center gap-2 bg-white/50 p-1 rounded-lg border border-white/50 shadow-sm">
                                    {selectedRows.size > 0 && (
                                        <Button
                                            onClick={handleSubmitBulkUpdates}
                                            disabled={submitting}
                                            className="flex items-center gap-2 text-xs sm:text-sm h-8"
                                        >
                                            {submitting && (
                                                <Loader
                                                    size={16}
                                                    color="white"
                                                    aria-label="Loading Spinner"
                                                />
                                            )}
                                            Submit Updates
                                        </Button>
                                    )}
                                    <Button
                                        variant="default"
                                        onClick={onDownloadClick}
                                        className="flex items-center gap-2 text-xs sm:text-sm h-8"
                                        style={{
                                            background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
                                            border: "none",
                                            borderRadius: "6px",
                                            padding: "0 12px",
                                            fontWeight: "bold",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                        }}
                                    >
                                        <DownloadOutlined />
                                        <span className="hidden sm:inline">{loading ? "Downloading..." : "Download"}</span>
                                        <span className="sm:hidden">{loading ? "..." : "CSV"}</span>
                                    </Button>
                                </div>
                            }
                        />
                    </div>
                </TabsContent>
                <TabsContent value="history" className="flex-1 min-h-0 w-full">
                    <DataTable
                        data={historyData}
                        columns={historyColumns}
                        searchFields={['product', 'department', 'indenter', 'vendorType']}
                        dataLoading={indentLoading}
                        className="h-[calc(100vh-280px)] shadow-md rounded-xl border-green-100/50"
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
};

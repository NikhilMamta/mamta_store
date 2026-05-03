
import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState, useMemo } from 'react';
import { useSheets } from '@/context/SheetsContext';
import { DownloadOutlined } from "@ant-design/icons";

import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { postToSheet } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { Tabs, TabsContent } from '../ui/tabs';
import { ClipboardCheck, PenSquare } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { Input } from '../ui/input';

const statuses = ['Pending', 'Reject', 'Three Party', 'Regular'];

interface ApproveTableData {
    id?: number;
    rowIndex: number;
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
    searialNumber?: string | number;
}

interface HistoryData {
    id?: number;
    rowIndex: number;
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
    searialNumber?: string | number;
}

export default () => {
    const { indentSheet, indentLoading, updateIndentSheet, approvedIndentSheet, updateApprovedIndentSheet } = useSheets();
    const { user } = useAuth();

    const [tableData, setTableData] = useState<ApproveTableData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<HistoryData>>({});
    const [loading, setLoading] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [bulkUpdates, setBulkUpdates] = useState<Map<string, { vendorType?: string; quantity?: number; specifications?: string }>>(new Map());
    const [submitting, setSubmitting] = useState(false);

    // Fetching table data
    useEffect(() => {
        // PENDING TAB: only show indents where status = 'Pending' in indent table
        setTableData(
            indentSheet
                .filter(
                    (sheet) => sheet.status?.trim().toLowerCase() === 'pending' && sheet.indentType?.trim() === 'Purchase'
                )
                .map((sheet, idx) => ({
                    id: sheet.id,
                    rowIndex: (sheet as any).rowIndex ?? idx,
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    quantity: sheet.quantity,
                    uom: sheet.uom,
                    attachment: sheet.attachment,
                    specifications: sheet.specifications || '',
                    vendorType: 'Pending' as ApproveTableData['vendorType'],
                    date: formatDate(new Date(sheet.timestamp)),
                    searialNumber: sheet.searialNumber,
                    status: sheet.status,
                }))
                .reverse()
        );

        // HISTORY TAB: only show indents where status = 'Approved' from indent table
        // enrich with approved_indent data when available
        setHistoryData(
            indentSheet
                .filter(
                    (sheet) => sheet.status?.trim().toLowerCase() === 'approved' && sheet.indentType?.trim() === 'Purchase'
                )
                .map((sheet, idx) => {
                    const approval = approvedIndentSheet.find(a => a.indentNumber === sheet.indentNumber);
                    return {
                        id: approval?.id,
                        rowIndex: (sheet as any).rowIndex ?? idx,
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
                        searialNumber: sheet.searialNumber,
                    };
                })
                .sort((a, b) => b.indentNo.localeCompare(a.indentNo))
        );
    }, [indentSheet, approvedIndentSheet]);

    const handleRowSelect = (rowIndex: number, checked: boolean) => {
        const identifier = String(rowIndex);
        
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (checked) newSet.add(identifier);
            else newSet.delete(identifier);
            return newSet;
        });

        setBulkUpdates(prev => {
            const next = new Map(prev);
            if (checked) {
                const row = tableData.find(r => r.rowIndex === rowIndex);
                if (row) {
                    next.set(identifier, {
                        vendorType: row.vendorType,
                        quantity: row.quantity,
                        specifications: row.specifications
                    });
                }
            } else {
                next.delete(identifier);
            }
            return next;
        });
    };


    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIndices = tableData.map(row => String(row.rowIndex));
            setSelectedRows(new Set(allIndices));
            
            setBulkUpdates(prev => {
                const next = new Map(prev);
                tableData.forEach(row => {
                    next.set(String(row.rowIndex), {
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
        setBulkUpdates((prevUpdates) => {
            const newUpdates = new Map(prevUpdates);
            const currentUpdate = newUpdates.get(identifier) || {};
            newUpdates.set(identifier, {
                ...currentUpdate,
                [field]: value,
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

            // 1. Identify all unique Indent Numbers from selected rows
            const selectedIndentNos = new Set<string>();
            selectedRows.forEach(rowIndexStr => {
                const row = tableData.find(r => String(r.rowIndex) === rowIndexStr);
                if (row?.indentNo) selectedIndentNos.add(row.indentNo);
            });

            const indentUpdates: any[] = [];
            const approvedRecords: any[] = [];

            // 2. Process all rows for each selected Indent Number
            selectedIndentNos.forEach(indentNo => {
                // Find all rows in original sheet for this indent number
                const allRowsForIndent = indentSheet.filter(s => s.indentNumber === indentNo);
                
                // Get the update info (vendorType, etc.) from the bulkUpdates map
                // We'll look for any selected row that has this indentNo to get the update values
                const representativeRowIndex = Array.from(selectedRows).find(idx => {
                    const r = tableData.find(tr => String(tr.rowIndex) === idx);
                    return r?.indentNo === indentNo;
                });
                
                const update = bulkUpdates.get(representativeRowIndex || "");
                if (!update) return;

                allRowsForIndent.forEach(originalSheet => {
                    const vendorType = update.vendorType || originalSheet.vendorType || 'Regular';
                    const isRejected = vendorType === 'Reject';

                    // 1. Prepare Update for INDENT table (Always Approved to move to History)
                    indentUpdates.push({
                        id: originalSheet.id, // CRITICAL: Need ID for Supabase Update
                        indentNumber: originalSheet.indentNumber,
                        specifications: update.specifications !== undefined ? update.specifications : originalSheet.specifications,
                        status: 'Approved', // Move to History
                    });

                    // 2. Prepare Insert for APPROVED INDENT table
                    approvedRecords.push({
                        timestamp: formattedDate,
                        indentNumber: originalSheet.indentNumber,
                        vendorType: vendorType,
                        approvedQuantity: update.quantity !== undefined ? update.quantity : originalSheet.quantity,
                        status: isRejected ? 'Rejected' : 'Pending', // Pending triggers next step
                    });
                });
            });

            console.log('🚀 Updating Indents:', indentUpdates);
            console.log('🚀 Creating Approved Records:', approvedRecords);

            if (indentUpdates.length > 0) {
                // Update indent status
                await postToSheet(indentUpdates, 'update', 'INDENT');
                
                // Save to approved_indent table
                await postToSheet(approvedRecords, 'insert', 'APPROVED INDENT');

                toast.success(`Approved ${indentUpdates.length} indents successfully`);

                setSelectedRows(new Set());
                setBulkUpdates(new Map());

                setTimeout(() => {
                    updateIndentSheet();
                    updateApprovedIndentSheet();
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
        setEditingRow(String(row.rowIndex));
        setEditValues({
            approvedQuantity: row.approvedQuantity,
            uom: row.uom,
            vendorType: row.vendorType,
            product: row.product,
            rowIndex: row.rowIndex,
        });
    };

    const handleCancelEdit = () => {
        setEditingRow(null);
        setEditValues({});
    };

    const handleSaveEdit = async (identifier: string) => {
        try {
            const rowIndex = Number(identifier);
            const currentRow = historyData.find(row => row.rowIndex === rowIndex);
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
                const rowsToUpdate = indentSheet.filter(s => s.productName === oldProductName);

                await postToSheet(
                    rowsToUpdate.map((prev) => ({
                        id: prev.id,
                        rowIndex: (prev as any).rowIndex,
                        indentNumber: prev.indentNumber,
                        productName: newProductName!,
                    })),
                    'update'
                );
                toast.success(`Updated product name from "${oldProductName}" to "${newProductName}" for ${rowsToUpdate.length} records`);
            } else {
                // 1. Update INDENT table
                const isNowApproved = (editValues.vendorType && (editValues.vendorType as any) !== 'Pending');
                
                await postToSheet(
                    indentSheet
                        .filter((s) => (s as any).rowIndex === rowIndex)
                        .map((prev) => {
                            return {
                                id: prev.id,
                                rowIndex: (prev as any).rowIndex,
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
                await postToSheet([{
                    id: currentRow.id,
                    vendorType: editValues.vendorType || currentRow.vendorType,
                    approvedQuantity: editValues.approvedQuantity !== undefined ? editValues.approvedQuantity : currentRow.approvedQuantity,
                    planned2: formattedDate, // Save full time
                }], 'update', 'APPROVED INDENT');
            } else if (isNowApproved) {
                // Create new approval record for previously Pending item
                await postToSheet([{
                    timestamp: formattedDate,
                    indentNumber: currentRow?.indentNo,
                    vendorType: editValues.vendorType,
                    approvedQuantity: editValues.approvedQuantity !== undefined ? editValues.approvedQuantity : (currentRow?.approvedQuantity || 0),
                    delay: 'None',
                    planned2: formattedDate, // Save full time
                    status: 'Pending',
                }], 'insert', 'APPROVED INDENT');
            }
                
                updateApprovedIndentSheet();
                toast.success(`Updated row ${rowIndex}`);
            }

            updateIndentSheet();
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
        const identifier = String(indent.rowIndex);
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
            await postToSheet([{
                id: indent.id,
                rowIndex: indent.rowIndex,
                indentNumber: indent.indentNo,
                status: 'Approved',
            }], 'update', 'INDENT');

            // 2. Insert into APPROVED INDENT table
            await postToSheet([{
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

            updateIndentSheet();
            updateApprovedIndentSheet();
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
            header: ({ table }) => (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={table.getIsAllPageRowsSelected()}
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
                            checked={selectedRows.has(String(row.original.rowIndex))}
                            onChange={(e) => handleRowSelect(indent.rowIndex, e.target.checked)}
                            className="w-4 h-4"
                        />
                    </div>
                );
            },
            size: 50,
        },
        {
            accessorKey: 'searialNumber',
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
                        const identifier = String(indent.rowIndex);
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
                                        className={`w-full min-w-[120px] max-w-[150px] text-xs ${!isSelected ? 'opacity-50' : ''
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
                    size: 150,
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
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[120px] sm:max-w-[150px] break-words whitespace-normal text-xs sm:text-sm">
                    {getValue() as string}
                </div>
            ),
            size: 150,
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ row }: { row: Row<ApproveTableData> }) => {
                const indent = row.original;
                const identifier = String(indent.rowIndex);
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
            header: 'Specifications',
            cell: ({ row }: { row: Row<ApproveTableData> }) => {
                const indent = row.original;
                const identifier = String(indent.rowIndex);
                const isSelected = selectedRows.has(identifier);
                const currentValue = bulkUpdates.get(identifier)?.specifications || indent.specifications;

                const [localValue, setLocalValue] = useState(currentValue || '');

                useEffect(() => {
                    setLocalValue(currentValue || '');
                }, [currentValue]);

                return (
                    <div className="max-w-[120px] sm:max-w-[150px]" onClick={(e) => e.stopPropagation()}>
                        <Input
                            value={localValue}
                            onChange={(e) => setLocalValue(e.target.value)}
                            onBlur={(e) => {
                                handleBulkUpdate(identifier, 'specifications', e.target.value);
                            }}
                            disabled={!isSelected}
                            className={`border-none focus:border-1 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
                            placeholder="Add specs..."
                        />
                    </div>
                );
            },
            size: 150,
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
        {
            accessorKey: 'searialNumber',
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
            header: 'Product',
            cell: ({ row }) => {
                const isEditing = editingRow === String(row.original.rowIndex);
                return isEditing ? (
                    <Input
                        value={editValues.product ?? row.original.product}
                        onChange={(e) => handleInputChange('product', e.target.value)}
                        className="max-w-[120px] sm:max-w-[150px] text-xs sm:text-sm"
                    />
                ) : (
                    <div className="flex items-center gap-1 sm:gap-2 max-w-[120px] sm:max-w-[150px] break-words whitespace-normal">
                        <span className="text-xs sm:text-sm">{row.original.product}</span>
                        {user.indentApprovalAction && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 sm:h-8 sm:w-8"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-2 w-2 sm:h-3 sm:w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
            size: 150,
        },
        {
            accessorKey: 'approvedQuantity',
            header: 'Quantity',
            cell: ({ row }) => {
                const isEditing = editingRow === String(row.original.rowIndex);
                return isEditing ? (
                    <Input
                        type="number"
                        value={editValues.approvedQuantity ?? row.original.approvedQuantity}
                        onChange={(e) => handleInputChange('approvedQuantity', Number(e.target.value))}
                        className="w-16 sm:w-20 text-xs sm:text-sm"
                    />
                ) : (
                    <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-xs sm:text-sm">{row.original.approvedQuantity}</span>
                        {user.indentApprovalAction && editingRow !== String(row.original.rowIndex) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 sm:h-8 sm:w-8"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-2 w-2 sm:h-3 sm:w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
            size: 100,
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row }) => {
                const isEditing = editingRow === String(row.original.rowIndex);
                return isEditing ? (
                    <Input
                        value={editValues.uom ?? row.original.uom}
                        onChange={(e) => handleInputChange('uom', e.target.value)}
                        className="w-16 sm:w-20 text-xs sm:text-sm"
                    />
                ) : (
                    <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-xs sm:text-sm">{row.original.uom}</span>
                        {user.indentApprovalAction && editingRow !== String(row.original.rowIndex) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 sm:h-8 sm:w-8"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-2 w-2 sm:h-3 sm:w-3" />
                            </Button>
                        )}
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
                const isEditing = editingRow === String(row.original.rowIndex);
                return isEditing ? (
                    <Select
                        value={editValues.vendorType ?? row.original.vendorType}
                        onValueChange={(value) => handleInputChange('vendorType', value)}
                    >
                        <SelectTrigger className="w-[120px] sm:w-[150px] text-xs sm:text-sm">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Regular Vendor">Regular</SelectItem>
                            <SelectItem value="Three Party">Three Party</SelectItem>
                            <SelectItem value="Reject">Reject</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex items-center gap-1 sm:gap-2">
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
                        {user.indentApprovalAction && editingRow !== String(row.original.rowIndex) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 sm:h-8 sm:w-8"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-2 w-2 sm:h-3 sm:w-3" />
                            </Button>
                        )}
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
        ...(user.indentApprovalAction
            ? [
                {
                    id: 'editActions',
                    header: 'Actions',
                    cell: ({ row }: { row: Row<HistoryData> }) => {
                        const isEditing = editingRow === String(row.original.rowIndex);
                        return isEditing ? (
                            <div className="flex gap-1 sm:gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSaveEdit(editingRow!)}
                                    className="text-xs sm:text-sm h-8"
                                >
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                    className="text-xs sm:text-sm px-2 py-1"
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : null;
                    },
                    size: 120,
                },
            ]
            : []),
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
                        {selectedRows.size > 0 && (
                            <div className="flex justify-end">
                                <Button
                                    onClick={handleSubmitBulkUpdates}
                                    disabled={submitting}
                                    className="flex items-center gap-2 w-full sm:w-auto"
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
                            </div>
                        )}

                        <div className="w-full overflow-x-auto overflow-y-hidden">
                            <DataTable
                                data={tableData}
                                columns={columns}
                                searchFields={['product', 'department', 'indenter', 'vendorType']}
                                dataLoading={indentLoading}
                                onRowClick={(row) => handleRowSelect(row.rowIndex, !selectedRows.has(String(row.rowIndex)))}
                                className="h-[74dvh]"
                                extraActions={
                                    <Button
                                        variant="default"
                                        onClick={onDownloadClick}
                                        className="flex items-center gap-2 text-xs sm:text-sm"
                                        style={{
                                            background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
                                            border: "none",
                                            borderRadius: "8px",
                                            padding: "8px 12px",
                                            fontWeight: "bold",
                                            boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                                        }}
                                    >
                                        <DownloadOutlined />
                                        <span className="hidden sm:inline">{loading ? "Downloading..." : "Download"}</span>
                                        <span className="sm:hidden">{loading ? "..." : "CSV"}</span>
                                    </Button>
                                }
                            />
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="history" className="flex-1 min-h-0 w-full">
                    <div className="w-full overflow-x-auto overflow-y-hidden">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product', 'department', 'indenter', 'vendorType']}
                            dataLoading={indentLoading}
                            className="h-[74dvh]"
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

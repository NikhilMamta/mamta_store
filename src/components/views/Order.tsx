

import { Package2, Trash2, Eye } from 'lucide-react';
import Heading from '../element/Heading';
import { useSheets } from '@/context/SheetsContext';
import { postToSheet } from '@/lib/fetchers';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import DataTable from '../element/DataTable';
import { Pill } from '../ui/pill';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';


interface HistoryData {
    poNumber: string;
    poCopy: string;
    vendorName: string;
    preparedBy: string;
    approvedBy: string;
    totalAmount: number;
    status: 'Revised' | 'Not Recieved' | 'Recieved';
    indentNumber: string;
    rowIndex: number;
    product: string;
    products?: string[];
    quantity: number;
    rate: number;
    indentNumbers?: string[];
    _count?: number;
    timestamp?: string;
}


export default () => {
    const { poHistoryLoading, poHistorySheet, indentSheet, receivedSheet } = useSheets();


    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [selectedPo, setSelectedPo] = useState<HistoryData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [matchingItems, setMatchingItems] = useState<any[]>([]);

    useEffect(() => {
        if (selectedPo && openDialog) {
            const items = poHistorySheet.filter(row => row.poNumber === selectedPo.poNumber);
            setMatchingItems(items);
        }
    }, [selectedPo, openDialog, poHistorySheet]);


    // Fetching table data
    useEffect(() => {
        if (!poHistorySheet) return;

        const grouped = poHistorySheet.reduce((acc: { [key: string]: HistoryData }, row, index) => {
            const poNumber = row.poNumber || 'N/A';
            const indentNo = row.internalCode || row.indentNumber || '';
            const product = row.product || '';
            const qty = row.quantity || 0;

            if (!acc[poNumber]) {
                acc[poNumber] = {
                    approvedBy: row.approvedBy || '',
                    poCopy: row.pdf || '',
                    poNumber: poNumber,
                    preparedBy: row.preparedBy || '',
                    totalAmount: row.totalPoAmount || 0,
                    vendorName: row.partyName || '',
                    indentNumber: indentNo,
                    indentNumbers: [indentNo],
                    rowIndex: (row as any).id || index,
                    status: (indentSheet.map((s) => s.poNumber).includes(poNumber)
                        ? receivedSheet.map((r) => r.poNumber).includes(poNumber)
                            ? 'Recieved'
                            : 'Not Recieved'
                        : 'Revised') as 'Revised' | 'Not Recieved' | 'Recieved',
                    product: product,
                    products: [product],
                    quantity: qty,
                    rate: row.rate || 0,
                    _count: 1,
                    timestamp: row.timestamp || '',
                };
            } else {
                acc[poNumber].quantity += qty;
                if (!acc[poNumber].indentNumbers?.includes(indentNo)) {
                    acc[poNumber].indentNumbers?.push(indentNo);
                }
                if (!acc[poNumber].products?.includes(product)) {
                    acc[poNumber].products?.push(product);
                }
                acc[poNumber]._count = (acc[poNumber]._count || 0) + 1;
                
                // Update to latest timestamp in group
                if (row.timestamp && (!acc[poNumber].timestamp || new Date(row.timestamp) > new Date(acc[poNumber].timestamp!))) {
                    acc[poNumber].timestamp = row.timestamp;
                }
            }
            return acc;
        }, {});

        const finalData = Object.values(grouped).sort((a, b) => {
            const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return dateB - dateA;
        });
        setHistoryData(finalData);
    }, [poHistorySheet, indentSheet, receivedSheet]);


    // Delete handler function using Apps Script
    const handleDelete = async (indentNumber: string, rowIndex: number) => {
        if (!indentNumber) {
            alert('Indent Number not found');
            return;
        }

        if (!rowIndex) {
            alert('Row index not found');
            return;
        }

        const confirmDelete = window.confirm(
            `Are you sure you want to delete the row with Indent Number: ${indentNumber}?`
        );

        if (!confirmDelete) return;

        try {
            console.log('Deleting row:', { indentNumber, rowIndex });

            const result = await postToSheet([{ rowIndex: rowIndex }], 'delete', 'PO MASTER');

            if (result.success) {
                alert('Row deleted successfully');
                // Update local state to remove the deleted row
                setHistoryData((prev) =>
                    prev.filter((item) => item.indentNumber !== indentNumber)
                );
            } else {
                alert('Failed to delete row');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Error deleting row: ' + (error as any).message);
        }
    };


    // Creating table columns
    const historyColumns: ColumnDef<HistoryData>[] = [
        {
            id: 'actions',
            header: () => <div className="text-center">Actions</div>,
            cell: ({ row }) => {
                return (
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={() => {
                                setSelectedPo(row.original);
                                setOpenDialog(true);
                            }}
                            className="text-primary hover:text-primary/80 transition-colors"
                            title="View Details"
                        >
                            <Eye size={18} />
                        </button>
                        <button
                            onClick={() => handleDelete(row.original.indentNumber, row.original.rowIndex)}
                            className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                            title="Delete row"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                );
            },
            size: 80,
        },
        {
            accessorKey: 'timestamp',
            id: 'timestamp',
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
            accessorKey: 'poNumber', 
            id: 'poNumber',
            header: () => <div className="text-center">PO Number</div>,
            cell: ({ getValue }) => <div className="text-center font-medium">{getValue() as string}</div>
        },
        {
            accessorKey: 'indentNumber',
            id: 'indentNumber',
            header: () => <div className="text-center">Indent No.</div>,
            cell: ({ row }) => {
                const count = row.original._count || 1;
                const baseId = (row.original.indentNumber || '').split(/[_/]/)[0];
                return (
                    <div className="text-center">
                        {count > 1 ? (
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold border border-primary/20">
                                {baseId} ({count})
                            </span>
                        ) : (
                            baseId
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'poCopy',
            id: 'poCopy',
            header: () => <div className="text-center">PO Copy</div>,
            cell: ({ row }) => {
                const attachment = row.original.poCopy;
                return (
                    <div className="text-center">
                        {attachment ? (
                            <a href={attachment} target="_blank" className="text-primary underline">
                                PDF
                            </a>
                        ) : (
                            '-'
                        )}
                    </div>
                );
            },
        },
        { 
            accessorKey: 'vendorName', 
            id: 'vendorName',
            header: () => <div className="text-center">Vendor Name</div>,
            cell: ({ getValue }) => <div className="text-center">{getValue() as string}</div>
        },
        {
            accessorKey: 'product',
            id: 'product',
            header: () => <div className="text-center">Product</div>,
            cell: ({ row }) => {
                const count = row.original._count || 1;
                return (
                    <div className="text-center">
                        {count > 1 ? (
                            <span className="text-muted-foreground italic text-xs">
                                Multiple Products
                            </span>
                        ) : (
                            <div className="max-w-[200px] truncate mx-auto" title={row.original.product}>
                                {row.original.product}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'quantity',
            id: 'quantity',
            header: () => <div className="text-center">Qty</div>,
            cell: ({ row }) => {
                const count = row.original._count || 1;
                return (
                    <div className="text-center">
                        <div className="font-bold">{row.original.quantity}</div>
                        {count > 1 && (
                            <div className="text-[10px] text-muted-foreground">({count} Items)</div>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'rate',
            id: 'rate',
            header: () => <div className="text-center">Rate</div>,
            cell: ({ getValue }) => <div className="text-center">₹{getValue() as number}</div>
        },
        {
            accessorKey: 'totalAmount',
            id: 'totalAmount',
            header: () => <div className="text-center">Amount</div>,
            cell: ({ row }) => {
                return <div className="text-center font-bold">₹{row.original.totalAmount}</div>;
            },
        },
        { 
            accessorKey: 'preparedBy', 
            id: 'preparedBy',
            header: () => <div className="text-center">Prepared By</div>,
            cell: ({ getValue }) => <div className="text-center text-xs">{getValue() as string}</div>
        },
        { 
            accessorKey: 'approvedBy', 
            id: 'approvedBy',
            header: () => <div className="text-center">Approved By</div>,
            cell: ({ getValue }) => <div className="text-center text-xs">{getValue() as string}</div>
        },
        {
            accessorKey: 'status',
            id: 'status',
            header: () => <div className="text-center">Status</div>,
            cell: ({ row }) => {
                const variant = row.original.status === "Not Recieved" ? "secondary" : row.original.status === "Recieved" ? "primary" : "default"
                return (
                    <div className="flex justify-center">
                        <Pill variant={variant}>{row.original.status}</Pill>
                    </div>
                );
            }
        },
    ];


    return (
        <div className="flex flex-col gap-5 h-full w-full max-w-full overflow-hidden">
            <Heading heading="PO History" subtext="View purchase orders">
                <Package2 size={50} className="text-primary" />
            </Heading>

            <div className="w-full flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
                <DataTable
                    data={historyData}
                    columns={historyColumns}
                    searchFields={['vendorName', 'poNumber', 'indentNumber', 'product']}
                    dataLoading={poHistoryLoading}
                    className='h-[74dvh]'
                />
            </div>

            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>PO Details: {selectedPo?.poNumber}</DialogTitle>
                        <DialogDescription>
                            Full breakdown of items in this purchase order
                        </DialogDescription>
                    </DialogHeader>

                    {selectedPo && (
                        <div className="space-y-6">
                            {/* Header Info */}
                            <div className="grid md:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Vendor</p>
                                    <p className="font-medium">{selectedPo.vendorName}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</p>
                                    <Pill variant={selectedPo.status === "Recieved" ? "primary" : selectedPo.status === "Not Recieved" ? "secondary" : "default"}>
                                        {selectedPo.status}
                                    </Pill>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Prepared By</p>
                                    <p className="font-medium">{selectedPo.preparedBy}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Approved By</p>
                                    <p className="font-medium">{selectedPo.approvedBy}</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted text-muted-foreground">
                                        <tr>
                                            <th className="p-3 font-medium">Indent No.</th>
                                            <th className="p-3 font-medium">Product</th>
                                            <th className="p-3 font-medium text-center">Qty</th>
                                            <th className="p-3 font-medium text-right">Rate</th>
                                            <th className="p-3 font-medium text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {matchingItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 font-mono text-xs">{item.internalCode || item.indentNumber}</td>
                                                <td className="p-3">{item.product}</td>
                                                <td className="p-3 text-center font-medium">{item.quantity}</td>
                                                <td className="p-3 text-right">₹{item.rate}</td>
                                                <td className="p-3 text-right font-semibold">₹{item.totalPoAmount || (item.quantity * item.rate)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-muted/50 font-bold">
                                        <tr>
                                            <td colSpan={4} className="p-3 text-right">Total Amount:</td>
                                            <td className="p-3 text-right text-primary">₹{selectedPo.totalAmount}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="flex justify-end gap-3">
                                {selectedPo.poCopy && (
                                    <Button variant="outline" asChild>
                                        <a href={selectedPo.poCopy} target="_blank">View PDF Copy</a>
                                    </Button>
                                )}
                                <Button onClick={() => setOpenDialog(false)}>Close</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

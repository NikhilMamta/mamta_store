

import { Package2, Trash2 } from 'lucide-react';
import Heading from '../element/Heading';
import { useDatabase } from '@/context/DatabaseContext';
import { postToDB } from '@/lib/fetchers';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import DataTable from '../element/DataTable';
import { Pill } from '../ui/pill';


interface HistoryData {
    poNumber: string;
    poCopy: string;
    vendorName: string;
    preparedBy: string;
    approvedBy: string;
    totalAmount: number;
    status: 'Revised' | 'Not Recieved' | 'Recieved';
    indentNumber: string;
    id: number;
    product: string;
    quantity: number;
    rate: number;
}


export default () => {
    const { poHistoryLoading, poHistoryData, indentData, receivedData } = useDatabase();


    const [historyData, setHistoryData] = useState<HistoryData[]>([]);


    // Fetching table data
    useEffect(() => {
        if (!poHistoryData) return;

        // map all rows without grouping to show every product individually
        const allRows: HistoryData[] = poHistoryData.map((row, index) => ({
            approvedBy: row.approvedBy || '',
            poCopy: row.pdf || '',
            poNumber: row.poNumber || '',
            preparedBy: row.preparedBy || '',
            totalAmount: row.totalPoAmount || 0,
            vendorName: row.partyName || '',
            indentNumber: row.internalCode || row.indentNumber || '',
            id: row.id || index, // Use database ID or index
            status: (indentData.map((s) => s.poNumber).includes(row.poNumber || '')
                ? receivedData.map((r) => r.poNumber).includes(row.poNumber || '')
                    ? 'Recieved'
                    : 'Not Recieved'
                : 'Revised') as 'Revised' | 'Not Recieved' | 'Recieved',
            product: row.product || '', // Add product field to interface if needed
            quantity: row.quantity || 0,
            rate: row.rate || 0,
        }));

        setHistoryData([...allRows].reverse());
    }, [poHistoryData, indentData, receivedData]);


    // Delete handler function using Apps Script
    const handleDelete = async (indentNumber: string, id: number) => {
        if (!indentNumber) {
            alert('Indent Number not found');
            return;
        }

        if (!id) {
            alert('ID not found');
            return;
        }

        const confirmDelete = window.confirm(
            `Are you sure you want to delete the row with Indent Number: ${indentNumber}?`
        );

        if (!confirmDelete) return;

        try {
            console.log('Deleting row:', { indentNumber, id });
            
            const result = await postToDB([{ id: id }], 'delete', 'PO MASTER');

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
        { accessorKey: 'poNumber', header: 'PO Number' },
        { 
            accessorKey: 'indentNumber', 
            header: 'Indent Number',
            cell: ({ getValue }) => (getValue() as string || '').split(/[_/]/)[0]
        },
        {
            accessorKey: 'poCopy',
            header: 'PO Copy',
            cell: ({ row }) => {
                const attachment = row.original.poCopy;
                return attachment ? (
                    <a href={attachment} target="_blank">
                        PDF
                    </a>
                ) : (
                    <></>
                );
            },
        },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
        { 
            accessorKey: 'product', 
            header: 'Product',
            cell: ({ getValue }) => <div className="max-w-[200px] truncate">{getValue() as string}</div>
        },
        { accessorKey: 'quantity', header: 'Qty' },
        { 
            accessorKey: 'rate', 
            header: 'Rate',
            cell: ({ getValue }) => `₹${getValue()}`
        },
        { accessorKey: 'preparedBy', header: 'Prepared By' },
        { accessorKey: 'approvedBy', header: 'Approved By' },
        {
            accessorKey: 'totalAmount',
            header: 'Amount',
            cell: ({ row }) => {
                return <>&#8377;{row.original.totalAmount}</>;
            },
        },
        { 
            accessorKey: 'status', 
            header: 'Status',
            cell: ({ row }) => {
                const variant = row.original.status === "Not Recieved" ? "secondary" : row.original.status === "Recieved" ? "primary" : "default"
                return <Pill variant={variant}>{row.original.status}</Pill>
            }
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                return (
                    <button 
                        onClick={() => handleDelete(row.original.indentNumber, row.original.id)}
                        className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                        title="Delete row"
                    >
                        <Trash2 size={18} />
                    </button>
                );
            },
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
        </div>
    );
};

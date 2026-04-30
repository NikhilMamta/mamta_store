import { ListTodo } from 'lucide-react';
import Heading from '../element/Heading';
import { useSheets } from '@/context/SheetsContext';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import DataTable from '../element/DataTable';

interface PendingIndentsData {
    date: string;
    indentNo: string;
    product: string;
    quantity: number;
    rate: number;
    uom: string;
    vendorName: string;
    paymentTerm: string;
    specifications: string;
    source: 'indent' | 'three_party' | 'vendor_rate';
}

export default () => {
    const { indentSheet, indentLoading, threePartyApprovalSheet, vendorRateUpdateSheet, approvedIndentSheet, poHistorySheet } = useSheets();

    const [tableData, setTableData] = useState<PendingIndentsData[]>([]);

    // Fetching table data
    useEffect(() => {
        const combinedData: PendingIndentsData[] = [];

        // 0. Indent numbers that already have a PO in history
        const existingPoIndents = new Set(
            poHistorySheet
                .map(p => p.indentNumber?.trim())
                .filter(Boolean) as string[]
        );

        // 1. Original indent data (planned4 !== '' && actual4 === '')
        const indentData = indentSheet
            .filter((sheet) => sheet.planned4 !== '' && sheet.actual4 === '' && !existingPoIndents.has(sheet.indentNumber))
            .map((sheet) => ({
                date: formatDate(new Date(sheet.timestamp)),
                indentNo: sheet.indentNumber,
                product: sheet.productName,
                quantity: sheet.approvedQuantity,
                rate: sheet.approvedRate,
                uom: sheet.uom,
                vendorName: sheet.approvedVendorName,
                paymentTerm: sheet.approvedPaymentTerm,
                specifications: sheet.specifications || '',
                source: 'indent' as const,
            }));

        // 2. Three Party Approval data with Pending status
        const threePartyData = threePartyApprovalSheet
            .filter((tpa) => {
                // Check if status is Pending or doesn't exist
                const isPending = !tpa.status || tpa.status?.trim().toLowerCase() === 'pending';
                return isPending && !existingPoIndents.has(tpa.indentNumber);
            })
            .map((tpa) => {
                // Find matching indent to get product details
                const matchingIndent = indentSheet.find(
                    (indent) => indent.indentNumber === tpa.indentNumber
                );

                return {
                    date: formatDate(new Date(tpa.timestamp)),
                    indentNo: tpa.indentNumber,
                    product: matchingIndent?.productName || '-',
                    quantity: matchingIndent?.approvedQuantity || 0,
                    rate: tpa.approvedRate,
                    uom: matchingIndent?.uom || '-',
                    vendorName: tpa.approvedVendorName,
                    paymentTerm: tpa.approvedPaymentTerm,
                    specifications: matchingIndent?.specifications || '',
                    source: 'three_party' as const,
                };
            });

        // 3. Vendor Rate Update data where vendor type is 'Regular' in approved indent
        // Show data that has been approved (status='Approved') and vendor type is 'Regular'
        const vendorRateData = vendorRateUpdateSheet
            .filter((vru) => {
                // Check if status is 'Approved'
                const isApproved = vru.status?.trim().toLowerCase() === 'approved';
                
                // Check if approved indent has vendorType = 'Regular'
                const approvedRecord = approvedIndentSheet.find(
                    (approved) => approved.indentNumber === vru.indentNumber
                );
                const isRegular = approvedRecord?.vendorType?.trim().toLowerCase() === 'regular';
                
                const isAvailable = isApproved && isRegular;
                return isAvailable && !existingPoIndents.has(vru.indentNumber);
            })
            .map((vru) => {
                // Find matching indent to get product details
                const matchingIndent = indentSheet.find(
                    (indent) => indent.indentNumber === vru.indentNumber
                );

                return {
                    date: formatDate(new Date(vru.timestamp)),
                    indentNo: vru.indentNumber,
                    product: matchingIndent?.productName || '-',
                    quantity: matchingIndent?.approvedQuantity || 0,
                    rate: vru.rate1 || 0,
                    uom: matchingIndent?.uom || '-',
                    vendorName: vru.vendorName1 || '-',
                    paymentTerm: vru.paymentTerm1 || '-',
                    specifications: matchingIndent?.specifications || '',
                    source: 'vendor_rate' as const,
                };
            });

        // Combine all data and sort by indentNo descending
        combinedData.push(...indentData, ...threePartyData, ...vendorRateData);
        combinedData.sort((a, b) => b.indentNo.localeCompare(a.indentNo));

        setTableData(combinedData);
    }, [indentSheet, threePartyApprovalSheet, vendorRateUpdateSheet, approvedIndentSheet, poHistorySheet]);

    // Creating table columns with compact Product column
    const columns: ColumnDef<PendingIndentsData>[] = [
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent Number',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'source',
            header: 'Source',
            cell: ({ getValue }) => {
                const source = getValue() as string;
                const label = source === 'indent' ? 'Indent' : source === 'three_party' ? 'Three Party' : 'Vendor Rate';
                return <div className="px-2 font-medium text-xs">{label}</div>;
            }
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[120px] break-words whitespace-normal px-1 text-sm">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ getValue }) => <div className="px-2">{getValue() as number}</div>
        },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => (
                <div className="px-2">
                    &#8377;{row.original.rate}
                </div>
            ),
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'vendorName',
            header: 'Vendor Name',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'paymentTerm',
            header: 'Payment Term',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal px-2 text-sm">
                    {getValue() as string}
                </div>
            ),
        },
    ];

    return (
        <div>
            <Heading heading="Pending POs" subtext="View pending purchase orders">
                <ListTodo size={50} className="text-primary" />
            </Heading>
            <DataTable
                data={tableData}
                columns={columns}
                searchFields={['product', 'vendorName', 'paymentTerm', 'specifications']}
                dataLoading={indentLoading}
                className="h-[80dvh]"
            />
        </div>
    );
};
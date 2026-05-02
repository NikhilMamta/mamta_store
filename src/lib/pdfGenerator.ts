import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SlipData {
    issueNo: string;
    date: string;
    areaOfUse: string;
    indenterName: string;
    department: string;
    wardName: string;
    category: string;
    items: {
        searialNumber: string | number;
        productName: string;
        quantity: number | string;
        unit: string;
    }[];
    preparedBy: string;
    approvedBy: string;
}

export const generateStoreOutSlip = async (data: SlipData): Promise<Blob> => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // 1. Background is white by default (Removed yellow rect)

    // 2. Header
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('MAMTA SUPERSPECIALISTY HOSPITAL', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text('Dubey Colony Mowa , Raipur (C.G)', pageWidth / 2, 22, { align: 'center' });
    
    // Horizontal Line
    doc.setLineWidth(0.5);
    doc.line(10, 25, pageWidth - 10, 25);

    // Info Section (Row 1)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Issue No -', 15, 35);
    doc.setTextColor(255, 0, 0); // Red for Issue No
    doc.text(data.issueNo, 35, 35);
    
    doc.setTextColor(0, 0, 0);
    doc.text('Date -', pageWidth / 2 - 20, 35);
    doc.setFont('helvetica', 'normal');
    doc.text(data.date, pageWidth / 2 - 5, 35);
    
    // Removed Area Of Use row

    // Row 2
    doc.setFont('helvetica', 'bold');
    doc.text('Indenter Name -', 15, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(data.indenterName, 45, 45);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Department -', pageWidth / 2 - 20, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(data.department, pageWidth / 2 + 5, 45);

    // Row 3
    doc.setFont('helvetica', 'bold');
    doc.text('Ward Name -', 15, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(data.wardName, 40, 55);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Category -', pageWidth / 2 - 20, 55);
    doc.setTextColor(255, 0, 0); // Red for Category
    doc.text(data.category, pageWidth / 2 + 5, 55);

    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Store Out Slip', pageWidth / 2, 65, { align: 'center' });
    doc.line(pageWidth / 2 - 20, 67, pageWidth / 2 + 20, 67); // Underline

    // Table
    autoTable(doc, {
        startY: 75,
        head: [['Serial No.', 'Product Name', 'Quantity']],
        body: data.items.map((item, index) => [
            index + 1,
            item.productName,
            `${item.quantity} ${item.unit}`
        ]),
        theme: 'grid',
        headStyles: { 
            fillColor: [240, 240, 240], // Light grey for header
            textColor: [0, 0, 0], 
            lineColor: [0, 0, 0], 
            lineWidth: 0.1,
            halign: 'center'
        },
        styles: { 
            fillColor: [255, 255, 255], // White for cells
            textColor: [0, 0, 0], 
            lineColor: [0, 0, 0], 
            lineWidth: 0.1,
            fontSize: 10
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 30 },
            2: { halign: 'center', cellWidth: 30 }
        }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    // Prepared By (Left)
    doc.text('Prepared By', 15, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.preparedBy, 15, finalY + 5);
    
    // Approved By (Center)
    doc.setFont('helvetica', 'bold');
    doc.text('Approved By', pageWidth / 2, finalY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(data.approvedBy, pageWidth / 2, finalY + 5, { align: 'center' });

    // Final Approved By (Right)
    doc.setFont('helvetica', 'bold');
    doc.text('Final Approved By', pageWidth - 15, finalY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('Dr. Sunil Ramnani', pageWidth - 15, finalY + 5, { align: 'right' });

    return doc.output('blob');
};

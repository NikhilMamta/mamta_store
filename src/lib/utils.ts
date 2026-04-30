import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number | null | undefined): string {
    if (!date) return '';

    let dObj: Date;

    if (date instanceof Date) {
        dObj = date;
    } else if (typeof date === 'string') {
        // Handle DD/MM/YYYY or DD-MM-YYYY formats specifically
        const parts = date.split(/[-/]/);
        // If it looks like DD/MM/YYYY
        if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            dObj = new Date(year, month, day);
        } else {
            dObj = new Date(date);
        }
    } else {
        dObj = new Date(date);
    }

    if (isNaN(dObj.getTime())) return typeof date === 'string' ? date : '';

    const d = dObj.getDate().toString().padStart(2, '0');
    const m = (dObj.getMonth() + 1).toString().padStart(2, '0'); // months are 0-based
    const y = dObj.getFullYear();
    return `${d}/${m}/${y}`;
}

export function calculateTotal(
    rate: number,
    gstPercent: number,
    discountPercent: number,
    quantity: number
): number {
    const baseAmount = rate * quantity;
    const discountedAmount = baseAmount - (baseAmount * discountPercent) / 100;
    const totalWithGst = discountedAmount + (discountedAmount * gstPercent) / 100;
    return parseFloat(totalWithGst.toFixed(2)); // Rounded to 2 decimal places
}

export function calculateSubtotal(
    items: {
        rate: number;
        quantity: number;
        discountPercent: number;
    }[]
): number {
    const total = items.reduce((sum, item) => {
        const base = item.rate * item.quantity;
        const discounted = base - (base * item.discountPercent) / 100;
        return sum + discounted;
    }, 0);

    return parseFloat(total.toFixed(2));
}

export function calculateTotalGst(
    items: {
        rate: number;
        quantity: number;
        discountPercent: number;
        gstPercent: number;
    }[]
): number {
    const totalGst = items.reduce((sum, item) => {
        const base = item.rate * item.quantity;
        const discounted = base - (base * item.discountPercent) / 100;
        const gstAmount = (discounted * item.gstPercent) / 100;
        return sum + gstAmount;
    }, 0);

    return parseFloat(totalGst.toFixed(2));
}

export function calculateGrandTotal(
    items: {
        rate: number;
        quantity: number;
        discountPercent: number;
        gstPercent: number;
    }[]
): number {
    const subtotal = calculateSubtotal(items);
    const gst = calculateTotalGst(items);
    return parseFloat((subtotal + gst).toFixed(2));
}


export function formatNumber(num: number) {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}

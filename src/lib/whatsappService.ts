export interface StoreOutProduct {
    productName?: string;
    quantity: number;
    uom?: string;
    wardName?: string;
    category?: string;
    department?: string;
    issueDate?: string;
    floor?: string;
    areaOfUse?: string;
}

export interface StoreOutIndentData {
    baseNumber: string;
    indenterName: string;
    indentApproveBy: string;
    products: StoreOutProduct[];
}

const MAYTAPI_PRODUCT_ID = import.meta.env.VITE_MAYTAPI_PRODUCT_ID;
const MAYTAPI_PHONE_ID = import.meta.env.VITE_MAYTAPI_PHONE_ID;
const MAYTAPI_TOKEN = import.meta.env.VITE_MAYTAPI_TOKEN;

// ⬇️ Hardcoded recipients – add actual phone numbers here (e.g. "917089161648")
export const STORE_OUT_PHONE_NUMBERS: string[] = ["917089161648",
    "917000520856",
    "919340821622",
    "916267799443",];

export const buildStoreOutIndentMessage = (
    data: StoreOutIndentData,
    approvalUrl: string
): string => {
    const { baseNumber, indenterName, indentApproveBy, products } = data;

    const departments = Array.from(new Set(products.map(p => p.department).filter(Boolean)));
    const wards = Array.from(new Set(products.map(p => p.wardName || p.areaOfUse).filter(Boolean)));

    const deptStr = departments.join(', ') || 'N/A';
    const wardStr = wards.join(', ') || 'N/A';

    const productListStr = products
        .map((p, idx) => `  ${idx + 1}. ${p.productName || 'N/A'} - ${p.quantity} ${p.uom || ''}`)
        .join('\n');

    return `⚡ Store Out Request Created

🆔 Issue/Req No.: ${baseNumber}
👨‍💼 Requested By: ${indenterName}
🏢 Department: ${deptStr}
🏥 Ward/Location: ${wardStr}
👤 Approval Needed: ${indentApproveBy}

📋 Products:
${productListStr}

👉 Please review & approve:
✅ ${approvalUrl}

✍️ TEAM MAMTA STORE`;
};

export const sendWhatsAppMessage = async (toNumber: string, message: string): Promise<boolean> => {
    if (!MAYTAPI_PRODUCT_ID || !MAYTAPI_PHONE_ID || !MAYTAPI_TOKEN) {
        console.warn("[WhatsApp] Maytapi credentials are not configured in .env");
        return false;
    }

    const url = `https://api.maytapi.com/api/${MAYTAPI_PRODUCT_ID}/${MAYTAPI_PHONE_ID}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-maytapi-key": MAYTAPI_TOKEN,
            },
            body: JSON.stringify({
                to_number: toNumber,
                type: "text",
                message: message,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error("[WhatsApp] Failed to send message:", data);
            return false;
        }

        console.log("[WhatsApp] Message sent successfully to:", toNumber, data);
        return true;
    } catch (error) {
        console.error("[WhatsApp] Error sending message:", error);
        return false;
    }
};

export const sendWhatsAppMessages = async (numbers: string[], message: string) => {
    if (!Array.isArray(numbers) || numbers.length === 0) return [];

    const promises = numbers.map(async (num) => {
        try {
            const ok = await sendWhatsAppMessage(num, message);
            return { number: num, success: !!ok };
        } catch (err) {
            console.error("[WhatsApp] Error sending to", num, err);
            return { number: num, success: false };
        }
    });

    return Promise.all(promises);
};

export const sendStoreOutNotification = async (data: StoreOutIndentData): Promise<boolean> => {
    try {
        if (STORE_OUT_PHONE_NUMBERS.length === 0) {
            console.log("[WhatsApp] No recipients configured. Skipping notification.");
            return false;
        }

        console.log("[WhatsApp] Sending Store Out notification...");
        const approvalUrl = `${window.location.origin}/store-out-approval`;
        const message = buildStoreOutIndentMessage(data, approvalUrl);

        const results = await sendWhatsAppMessages(STORE_OUT_PHONE_NUMBERS, message);
        const successful = results.filter(r => r.success).map(r => r.number);
        return successful.length === STORE_OUT_PHONE_NUMBERS.length;
    } catch (error) {
        console.error("[WhatsApp] sendStoreOutNotification error:", error);
        return false;
    }
};

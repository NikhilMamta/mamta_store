import { supabase } from "./supabase";

// Helper function to directly insert Store Out data
export async function insertStoreOutDirect(rows: any[]) {
    try {
        console.log("=== insertStoreOutDirect called ===");
        
        // Supabase prefer objects, but the input might be tailored for GAS array format
        // If rows are already objects, we can insert directly.
        // If they are formatted for GAS (arrays), we need to map them back or handle differently.
        
        const { error } = await supabase
            .from('store_out')
            .insert(rows);

        if (error) {
            console.error("Supabase error in insertStoreOutDirect:", error);
            
            // Fallback to GAS array format
            const formattedRows = rows.map(row => {
                return [
                    row.timestamp || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                    row.issueNo || '',
                    row.issueDate || '',
                    row.requestedBy || '',
                    row.floor || '',
                    row.wardName || '',
                    Number(row.qty) || 0,
                    row.unit || '',
                    row.department || '',
                    row.category || '',
                    row.areaOfUse || '',
                    row.planned || '',
                    row.actual || '',
                    Number(row.timeDelay) || 0,
                    row.status || '',
                    Number(row.approveQty) || 0,
                    '', '', '',
                    row.category || '',
                    row.productName || ''
                ];
            });

            const form = new FormData();
            form.append('action', 'insertStoreOutDirect');
            form.append('sheetName', 'STORE OUT');
            form.append('rows', JSON.stringify(formattedRows));

            const response = await fetch(import.meta.env.VITE_APP_SCRIPT_URL, {
                method: 'POST',
                body: form,
                redirect: 'follow',
            });

            if (!response.ok) throw new Error(`GAS fallback failed: ${response.statusText}`);
            return await response.json();
        }

        return { success: true };
    } catch (error) {
        console.error("Error in insertStoreOutDirect:", error);
        throw error;
    }
}

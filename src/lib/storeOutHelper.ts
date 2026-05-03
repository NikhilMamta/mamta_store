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
            throw error;
        }

        return { success: true };
    } catch (error) {
        console.error("Error in insertStoreOutDirect:", error);
        throw error;
    }
}

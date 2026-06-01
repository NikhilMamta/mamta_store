import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Manually parse .env
const envFile = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/(^"|"$|'^|'$)/g, '');
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("Searching for 'Goggles (OT) 1x12'...");
    try {
        const { data: masterRows, error: mError } = await supabase
            .from('master')
            .select('*')
            .ilike('item_name', '%Goggles%');
        if (mError) throw mError;
        console.log("Master Matches:", JSON.stringify(masterRows, null, 2));

        const { data: invRows, error: iError } = await supabase
            .from('inventory')
            .select('*')
            .ilike('item_name', '%Goggles%');
        if (iError) throw iError;
        console.log("Inventory Matches:", JSON.stringify(invRows, null, 2));
    } catch (e: any) {
        console.error("Query failed:", e.message);
    }
}

checkData();

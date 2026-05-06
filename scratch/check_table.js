import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kfdtcqjkesvdfzncfbns.supabase.co';
const supabaseKey = 'sb_publishable_XvSW_BICw33KESpeQyAfkw_6Z2OpEWA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('--- Checking inventory_history table ---');
    const { data, error, count } = await supabase
        .from('inventory_history')
        .select('*', { count: 'exact' });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Exact count:', count);
    console.log('Data sample:', data?.slice(0, 5));
}

checkTable();

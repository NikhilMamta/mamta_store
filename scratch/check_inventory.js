import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kfdtcqjkesvdfzncfbns.supabase.co';
const supabaseKey = 'sb_publishable_XvSW_BICw33KESpeQyAfkw_6Z2OpEWA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInventoryTable() {
    console.log('--- Checking inventory table ---');
    const { data, error, count } = await supabase
        .from('inventory')
        .select('group_head', { count: 'exact' });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Exact count:', count);
    if (data) {
        const groupHeads = data.map(row => row.group_head).filter(Boolean);
        console.log('Group Head Values (First 20):', groupHeads.slice(0, 20));
        console.log('Unique Group Heads:', [...new Set(groupHeads)]);
    }
}

checkInventoryTable();

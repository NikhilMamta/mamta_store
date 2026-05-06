import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kfdtcqjkesvdfzncfbns.supabase.co';
const supabaseKey = 'sb_publishable_XvSW_BICw33KESpeQyAfkw_6Z2OpEWA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function logGroupHead() {
    console.log('--- Fetching group_head data ---');
    const { data, error } = await supabase
        .from('inventory_history')
        .select('group_head');

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No data found in inventory_history.');
        return;
    }

    console.log('Total records:', data.length);
    console.log('Group Head Values:');
    const groupHeads = data.map(row => row.group_head);
    console.log(groupHeads);
    
    console.log('\nUnique Group Heads:');
    console.log([...new Set(groupHeads)]);
}

logGroupHead();

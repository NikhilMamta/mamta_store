import { supabase } from '../src/lib/supabase';

async function testFetch() {
    console.log('Fetching group_head from inventory_history...');
    const { data, error } = await supabase
        .from('inventory_history')
        .select('group_head');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Group Head Data:', data);
    console.log('Unique Group Heads:', [...new Set(data.map(d => d.group_head))]);
}

testFetch();

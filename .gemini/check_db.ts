
import { supabase } from './src/lib/supabase';

async function checkStoreOutRequests() {
  const { data, error } = await supabase
    .from('store_out_request')
    .select('indent_number, issue_no')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('Last 5 Store Out Requests:', data);
  }
}

checkStoreOutRequests();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStoreOutRequests() {
  const { data, error } = await supabase
    .from('store_out_request')
    .select('indent_number, issue_no, timestamp')
    .order('timestamp', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('Last 5 Store Out Requests:', data);
  }
}

checkStoreOutRequests();

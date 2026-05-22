const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kfdtcqjkesvdfzncfbns.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_XvSW_BICw33KESpeQyAfkw_6Z2OpEWA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('master').select('*').limit(1);
  if (error) {
    console.error('Error fetching master:', error);
  } else {
    console.log('Columns in master table:', Object.keys(data[0] || {}));
    console.log('First row:', data[0]);
  }
}

run();

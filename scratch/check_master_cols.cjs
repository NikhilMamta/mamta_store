const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kfdtcqjkesvdfzncfbns.supabase.co';
const supabaseKey = 'sb_publishable_XvSW_BICw33KESpeQyAfkw_6Z2OpEWA';

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

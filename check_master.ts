
import { createClient } from '@supabase/supabase-base'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
  const { data, error } = await supabase.from('master').select('*').limit(1)
  if (error) {
    console.error(error)
  } else {
    console.log('Columns in master table:', Object.keys(data[0] || {}))
  }
}

checkColumns()

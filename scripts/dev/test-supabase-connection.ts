import dotenv from 'dotenv'
dotenv.config({ path: process.env.ENV_FILE || '.env' })

import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function testConnection() {
  const { data, error } = await supabase
    .from('vectors')
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.error('❌ Connection failed:', error.message)
  } else {
    console.log(`✅ Connected to Supabase! Vectors table has ${data?.length ?? 0} entries.`)
  }
}

testConnection()
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aosnytcfcazlaolozehx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvc255dGNmY2F6bGFvbG96ZWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDc4ODMsImV4cCI6MjA4NjYyMzg4M30.XoJ8aHIw4ztxVzKLnTg1pQaFqsW8N7-KIx4wtiDIS4A';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testNegativeAmount() {
  const { data, error } = await supabase.from('orders').insert({
    buyer_id: 'df994bdf-6df4-4b19-a787-45ed61126589',
    total_amount: -50,
    items: [{ type: 'transfer', receiver_id: 'someone' }],
    status: 'wallet_tx'
  }).select();
  console.log('Negative amount test:', data, error);
}

testNegativeAmount();

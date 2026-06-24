import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aosnytcfcazlaolozehx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvc255dGNmY2F6bGFvbG96ZWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDc4ODMsImV4cCI6MjA4NjYyMzg4M30.XoJ8aHIw4ztxVzKLnTg1pQaFqsW8N7-KIx4wtiDIS4A';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*').limit(1);
  console.log('Profiles:', profiles, pError);

  const { data: products, error: prError } = await supabase.from('products').select('*').limit(1);
  console.log('Products:', products, prError);
  
  const { data: orders, error: oError } = await supabase.from('orders').select('*').limit(1);
  console.log('Orders:', orders, oError);

  const { data: wallets, error: wError } = await supabase.from('wallets').select('*').limit(1);
  console.log('Wallets:', wallets, wError);
}

checkTables();

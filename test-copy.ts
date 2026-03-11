
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);
async function run() {
    const { data: photos } = await supabase.from('photos').select('*').limit(1);
    console.log('Random photo:', photos[0]);
    if (!photos[0]) return;
    
    const oldPath = photos[0].storage_path;
    const newPath = 'test_copy/' + Date.now() + '.jpg';
    
    console.log('Copying', oldPath, 'to', newPath);
    const result = await supabase.storage.from('photos').copy(oldPath, newPath);
    console.log('Copy result error:', result.error);
    console.log('Copy result data:', result.data);
}
run();


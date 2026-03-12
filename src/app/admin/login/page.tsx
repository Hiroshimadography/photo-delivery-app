import { createAdminClient } from "@/utils/supabase/admin";
import AdminLoginClient from "./AdminLoginClient";

export const dynamic = 'force-dynamic';

export default async function AdminLogin() {
    const supabase = createAdminClient();
    const { data: brandSettings } = await supabase
        .from('brand_settings')
        .select('*')
        .not('id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const brandName = brandSettings?.brand_name || "";
    const logoUrl = brandSettings?.logo_url;

    return <AdminLoginClient brandName={brandName} logoUrl={logoUrl} />;
}

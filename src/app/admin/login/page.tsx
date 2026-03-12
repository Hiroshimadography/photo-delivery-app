import { createAdminClient } from "@/utils/supabase/admin";
import AdminLoginClient from "./AdminLoginClient";

export const dynamic = 'force-dynamic';

export default async function AdminLogin() {
    const supabase = createAdminClient();
    let brandSettings = null;
    try {
        const { data } = await supabase
            .from('brand_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        brandSettings = data;
    } catch (err) {
        console.error("Fetch brand settings error in Login:", err);
    }

    const brandName = brandSettings?.brand_name || "Hiroshimadography";
    const logoUrl = brandSettings?.logo_url;

    return <AdminLoginClient brandName={brandName} logoUrl={logoUrl} />;
}

// Configuración que define el administrador (duraciones, cobro del CV). La lee cualquiera.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export const DEFAULT_SETTINGS = {
  job_days: 15,
  service_days: 15,
  cv_paid_enabled: false,
  cv_price: 3000,
  cv_mode: 'por_dias',
  cv_days: 30,
  contact_email: 'laburamosapp@gmail.com',
  instagram_url: 'https://instagram.com/laburamosapp',
  premium_enabled: false,
  premium_price: 3000,
  premium_days: 30,
  premium_include_links: true,
  premium_include_photos: true,
  free_links_limit: 1,
  premium_links_limit: 3,
  free_photos_limit: 5,
  premium_photos_limit: 10,
};

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const reload = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
    if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return [settings, reload];
}

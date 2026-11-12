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
  welcome_enabled: false,
  welcome_images: [],
  premium_enabled: false,
  premium_price: 3000,
  premium_days: 30,
  premium_include_links: true,
  premium_include_photos: true,
  free_links_limit: 1,
  premium_links_limit: 3,
  free_photos_limit: 5,
  premium_photos_limit: 10,
  ads_enabled: true,
  ads_price_per_second: 100,
  ads_price_image: 5000,
  ads_image_seconds: 8,
  ads_max_seconds: 30,
  ads_min_seconds: 5,
  ads_days: 30,
  ads_skip_seconds: 5,
  ads_max_per_user: 3,
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

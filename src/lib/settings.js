// Configuración que define el administrador (duraciones, cobro del CV). La lee cualquiera.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export const DEFAULT_SETTINGS = { job_days: 30, service_days: 30, cv_paid_enabled: false, cv_price: 3000, cv_mode: 'por_dias', cv_days: 30 };

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

// CV: datos compartidos entre el editor (Mi CV), el PDF y la vista de las empresas (Postulantes)
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { AVAILABILITY } from './utils';
import { DEFAULT_THEME } from './cvTheme';

export const MAX_SKILLS = 5;
export const PHOTO_BUCKET = 'cv-photos';
export const emptyEdu = () => ({ title: '', place: '', from: '', to: '' });
export const emptyExp = () => ({ role: '', place: '', from: '', to: '', current: false, tasks: '' });

// Fila de "resumes" -> datos del CV. user y zone completan lo que falte (solo para el propio CV).
export function resumeToForm(data, user = {}, zone = null) {
  const skillsList =
    Array.isArray(data?.skills_list) && data.skills_list.length
      ? data.skills_list
      : (data?.skills || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, MAX_SKILLS);
  const expList =
    Array.isArray(data?.experience_list) && data.experience_list.length
      ? data.experience_list
      : data?.experience
        ? [{ ...emptyExp(), tasks: data.experience }]
        : [];
  const city = data?.city || user.city || zone?.city || null;
  return {
    full_name: data?.full_name || user.name || '',
    profession: data?.profession || '',
    summary: data?.summary || '',
    photo_path: data?.photo_path || '',
    birth_date: data?.birth_date || '',
    place: city ? { city, province: data?.province || user.province || zone?.province || null } : null,
    neighborhood: data?.neighborhood || '',
    skills: skillsList,
    phone: data?.phone || user.phone || '',
    email: data?.email || user.email || '',
    availability: data?.availability || AVAILABILITY[0],
    education: Array.isArray(data?.education) ? data.education : [],
    experience: expList,
    theme: { ...DEFAULT_THEME, ...(data?.theme && typeof data.theme === 'object' ? data.theme : {}) },
  };
}

// URL temporal de la foto (el bucket es privado). Devuelve '' mientras carga o si no hay foto.
export function useSignedPhoto(path) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!path) {
      setUrl('');
      return undefined;
    }
    let off = false;
    supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => !off && setUrl(data?.signedUrl || ''));
    return () => {
      off = true;
    };
  }, [path]);
  return url;
}

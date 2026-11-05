import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useProfileCroper } from './cropper';

export function useUser() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [croppedProfileUrl, setCroppedProfileUrl] = useState(null);

  const { cropperActive, setCropperActive, cropBox, setCropBox, selectedImage, setSelectedImage, croppedUrl, handleCrop, closeCropper } = useProfileCroper(null);

  useEffect(() => {
    // Get the current user from Supabase auth
    const getUser = async () => {
      const { data: { user} } = await supabase.auth.getUser();
      setUser(user);
      
      // Check if user is admin (only service_account has is_admin=true)
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin, avatar_url')
          .eq('id', user.id)
          .single();
        setIsAdmin(profile?.is_admin === true);
        
        // Set initial avatar if available
        if (profile?.avatar_url) {
          setSelectedImage(profile.avatar_url);
        }
      }
    };

    getUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      getUser();
    });

    return () => subscription.unsubscribe();
  }, []);
  
  // Cuando se selecciona una nueva imagen desde el perfil
  useEffect(() => {
    if (croppedUrl) {
      setCroppedProfileUrl(croppedUrl);
    }
  }, [croppedUrl]);

  return {
    user,
    isAdmin,
    croppedProfileUrl,
    setCropperActive,
    openCropper,
    closeCropper,
    cropBox,
    setCropBox,
    handleCrop,
    selectedImage
  };
}
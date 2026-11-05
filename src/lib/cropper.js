// Croper simple para perfil de usuario
// Permite seleccionar un área rectangular que se recortará a un círculo

export function useProfileCroper(initialImageUrl) {
  const [cropperActive, setCropperActive] = useState(false);
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [selectedImage, setSelectedImage] = useState(null);
  const [croppedUrl, setCroppedUrl] = useState(null);

  const openCropper = (imageUrl) => {
    setSelectedImage(imageUrl);
    setCropperActive(true);
    // Establecer caja de recorte por defecto centrada
    setCropBox({ x: 0, y: 0, width: 200, height: 200 });
  };

  const closeCropper = () => {
    setCropperActive(false);
    setSelectedImage(null);
    setCroppedUrl(null);
    setCropBox({ x: 0, y: 0, width: 200, height: 200 });
  };

  const handleCrop = () => {
    if (!selectedImage || croppedUrl) return;
    
    const canvas = document.createElement('canvas');
    const size = Math.min(cropBox.width, cropBox.height);
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw the selected region
    ctx.drawImage(
      selectedImage,
      cropBox.x, cropBox.y, cropBox.width, cropBox.height,
      0, 0, size, size
    );
    
    // Create circle clip
    const radius = size / 2;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, 2 * Math.PI);
    ctx.clip();
    
    // Redraw within circle
    ctx.drawImage(
      selectedImage,
      cropBox.x, cropBox.y, cropBox.width, cropBox.height,
      0, 0, size, size
    );
    
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCroppedUrl(croppedDataUrl);
    setCropperActive(false);
  };

  return {
    cropperActive,
    setCropperActive,
    cropBox,
    setCropBox,
    selectedImage,
    setSelectedImage,
    croppedUrl,
    handleCrop,
    closeCropper
  };
}

// Componente de vista previa circular
export function ProfilePicturePreview({ croppedUrl, initialUrl, size = 120 }) {
  return (
    <div className="profile-pic-container" style={{ width: size, height: size }}>
      {croppedUrl ? (
        <img 
          src={croppedUrl} 
          alt="Foto de perfil" 
          style={{
            width: '100%', 
            height: '100%', 
            borderRadius: '50%', 
            objectFit: 'cover'
          }} 
        />
      ) : initialUrl ? (
        <img 
          src={initialUrl} 
          alt="Foto de perfil" 
          style={{
            width: '100%', 
            height: '100%', 
            borderRadius: '50%', 
            objectFit: 'cover',
            background: 'var(--mist)'
          }}
        ) : (
        <div 
          style={{
            width: '100%', 
            height: '100%', 
            borderRadius: '50%', 
            background: var(--mist),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: var(--ink),
            fontSize: '2rem'
          }}
        >
          {/* Initials placeholder */}
          {initials}
        </div>
      )}
    </div>
  );
}
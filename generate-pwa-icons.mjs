import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputPath = 'C:\\Users\\facun\\AppData\\Local\\Temp\\opencode\\uploads\\fda85a37-412a-4d34-a843-c19cdc057ddc\\image.png';
const outputDir = 'C:\\Users\\facun\\OneDrive\\Documentos\\Proyecto predeterminado\\laburamos-app\\public\\marca';

async function generatePwaIcons() {
  const image = sharp(inputPath);
  
  // Generate PWA icons
  await image
    .clone()
    .resize(192, 192, { fit: 'cover', position: 'center' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, 'icono-app-192.png'));
  console.log('Generated icono-app-192.png (192x192)');

  await image
    .clone()
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, 'icono-app-512.png'));
  console.log('Generated icono-app-512.png (512x512)');

  // Generate maskable icon (with safe zone - 40% padding)
  await image
    .clone()
    .resize(512, 512, { fit: 'contain', background: { r: 25, g: 25, b: 75, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, 'icono-app-maskable-512.png'));
  console.log('Generated icono-app-maskable-512.png (512x512 maskable)');

  console.log('All PWA icons generated successfully!');
}

generatePwaIcons().catch(console.error);
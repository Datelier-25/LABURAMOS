import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputPath = 'C:\\Users\\facun\\AppData\\Local\\Temp\\opencode\\uploads\\fda85a37-412a-4d34-a843-c19cdc057ddc\\image.png';
const outputDir = 'C:\\Users\\facun\\OneDrive\\Documentos\\Proyecto predeterminado\\laburamos-app\\public\\marca';

async function generateFavicons() {
  const image = sharp(inputPath);
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate PNG sizes
  const sizes = [
    { name: 'favicon-16.png', size: 16 },
    { name: 'favicon-32.png', size: 32 },
    { name: 'favicon-48.png', size: 48 },
    { name: 'favicon-180.png', size: 180 }, // apple-touch-icon
    { name: 'favicon-512.png', size: 512 },
  ];

  for (const { name, size } of sizes) {
    await image
      .clone()
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outputDir, name));
    console.log(`Generated ${name} (${size}x${size})`);
  }

  // Generate multi-size ICO (16, 32, 48)
  await image
    .clone()
    .resize(48, 48, { fit: 'cover', position: 'center' })
    .toFile(path.join(outputDir, 'favicon.ico'));
  console.log('Generated favicon.ico (48x48)');

  // Also update apple-touch-icon.png (same as favicon-180.png)
  await fs.promises.copyFile(
    path.join(outputDir, 'favicon-180.png'),
    path.join(outputDir, 'apple-touch-icon.png')
  );
  console.log('Updated apple-touch-icon.png');

  console.log('All favicons generated successfully!');
}

generateFavicons().catch(console.error);
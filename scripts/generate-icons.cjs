const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

async function generate() {
  // Regular icons (with rounded corners)
  const svg192 = fs.readFileSync(path.join(iconsDir, 'icon-192x192.svg'));
  const svg512 = fs.readFileSync(path.join(iconsDir, 'icon-512x512.svg'));

  await sharp(svg192).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192x192.png'));
  console.log('Created icon-192x192.png');

  await sharp(svg512).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512x512.png'));
  console.log('Created icon-512x512.png');

  // Maskable icons (no rounded corners, full bleed)
  const maskable192 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
    <rect width="192" height="192" fill="#0a0a0a"/>
    <text x="96" y="125" text-anchor="middle" font-size="96" fill="#e91e63">&#x1F48D;</text>
  </svg>`;

  const maskable512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <rect width="512" height="512" fill="#0a0a0a"/>
    <text x="256" y="330" text-anchor="middle" font-size="256" fill="#e91e63">&#x1F48D;</text>
  </svg>`;

  await sharp(Buffer.from(maskable192)).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-maskable-192x192.png'));
  console.log('Created icon-maskable-192x192.png');

  await sharp(Buffer.from(maskable512)).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-maskable-512x512.png'));
  console.log('Created icon-maskable-512x512.png');

  // Apple touch icon (180x180)
  const apple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
    <rect width="180" height="180" rx="30" fill="#0a0a0a"/>
    <text x="90" y="115" text-anchor="middle" font-size="90" fill="#e91e63">&#x1F48D;</text>
  </svg>`;

  await sharp(Buffer.from(apple)).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  console.log('All icons generated!');
}

generate().catch(console.error);

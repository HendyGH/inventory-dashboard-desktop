// This script generates build/icon.ico from build/icon.svg
// Run: node scripts/generate-icon.js
// Requires: npm install sharp png-to-ico --save-dev (only needed for icon generation)
//
// ALTERNATIVE: If you don't want to run this locally, the GitHub Actions workflow
// handles icon generation automatically before building the exe.
//
// For now, electron-builder will use the .ico in build/ folder.
// You can generate one manually at https://convertio.co/svg-ico/ or
// use any online SVG-to-ICO converter with the build/icon.svg file.

const fs = require('fs');
const path = require('path');

async function generate() {
  try {
    const sharp = require('sharp');
    const pngToIco = require('png-to-ico');

    const svgPath = path.join(__dirname, '..', 'build', 'icon.svg');
    const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
    const svgBuffer = fs.readFileSync(svgPath);

    // Generate 256x256 PNG
    const pngBuffer = await sharp(svgBuffer).resize(256, 256).png().toBuffer();

    // Convert to ICO
    const icoBuffer = await pngToIco(pngBuffer);
    fs.writeFileSync(icoPath, icoBuffer);
    console.log('✓ Generated build/icon.ico');
  } catch (e) {
    console.error('Icon generation failed:', e.message);
    console.log('Use https://convertio.co/svg-ico/ to convert build/icon.svg manually');
  }
}

generate();

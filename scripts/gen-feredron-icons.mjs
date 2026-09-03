import sharp from "sharp";

const source = "public/brand/feredron-mark.png";

async function make(output, size, scale, background) {
  const mark = await sharp(source)
    .resize(Math.round(size * scale), Math.round(size * scale), { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(output);
}

async function makeSplash(output, width, height, scale = 0.42) {
  const markSize = Math.round(Math.min(width, height) * scale);
  const mark = await sharp(source)
    .resize(markSize, markSize, { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: { width, height, channels: 4, background: "#03172D" },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(output);
}

const androidDensities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function makeAndroidIcons() {
  for (const [density, multiplier] of Object.entries(androidDensities)) {
    const directory = `android/app/src/main/res/mipmap-${density}`;
    await make(`${directory}/ic_launcher.png`, Math.round(48 * multiplier), 0.78, "#03172D");
    await make(`${directory}/ic_launcher_round.png`, Math.round(48 * multiplier), 0.72, "#03172D");
    await make(`${directory}/ic_launcher_foreground.png`, Math.round(108 * multiplier), 0.62, {
      r: 0, g: 0, b: 0, alpha: 0,
    });
  }
}

await make("public/icons/icon-192.png", 192, 0.78, "#03172D");
await make("public/icons/icon-512.png", 512, 0.78, "#03172D");
await make("public/icons/maskable-512.png", 512, 0.62, "#078C38");
await make("public/apple-touch-icon.png", 180, 0.76, "#03172D");
await make("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", 1024, 0.76, "#03172D");
await makeAndroidIcons();

const androidSplashes = [
  ["android/app/src/main/res/drawable/splash.png", 480, 320],
  ["android/app/src/main/res/drawable-land-hdpi/splash.png", 800, 480],
  ["android/app/src/main/res/drawable-land-mdpi/splash.png", 480, 320],
  ["android/app/src/main/res/drawable-land-xhdpi/splash.png", 1280, 720],
  ["android/app/src/main/res/drawable-land-xxhdpi/splash.png", 1600, 960],
  ["android/app/src/main/res/drawable-land-xxxhdpi/splash.png", 1920, 1280],
  ["android/app/src/main/res/drawable-port-hdpi/splash.png", 480, 800],
  ["android/app/src/main/res/drawable-port-mdpi/splash.png", 320, 480],
  ["android/app/src/main/res/drawable-port-xhdpi/splash.png", 720, 1280],
  ["android/app/src/main/res/drawable-port-xxhdpi/splash.png", 960, 1600],
  ["android/app/src/main/res/drawable-port-xxxhdpi/splash.png", 1280, 1920],
];

for (const [output, width, height] of androidSplashes) {
  await makeSplash(output, width, height);
}

for (const suffix of ["", "-1", "-2"]) {
  await makeSplash(`ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732${suffix}.png`, 2732, 2732, 0.36);
}

console.log("✓ Icônes et écrans de démarrage FEREDRON générés pour le web, Android et iPhone.");

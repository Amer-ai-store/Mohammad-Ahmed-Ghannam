// Configures a private release keystore for the Android build when the CI secrets exist:
//   LUQTA_KEYSTORE_BASE64, LUQTA_KEYSTORE_PASSWORD, LUQTA_KEY_ALIAS, LUQTA_KEY_PASSWORD
// Without them the build keeps Expo's default debug signing (fine for testing, NOT for
// Google Play). The keystore never enters the repository.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const { LUQTA_KEYSTORE_BASE64: ks, LUQTA_KEYSTORE_PASSWORD: sp, LUQTA_KEY_ALIAS: alias, LUQTA_KEY_PASSWORD: kp } = process.env;
const gradle = join(process.cwd(), 'android', 'app', 'build.gradle');
if (!ks || !sp || !alias || !kp) { console.log('release signing: debug key (secrets not configured)'); process.exit(0); }
if (!existsSync(gradle)) throw new Error('android/app/build.gradle not found — run expo prebuild first');
writeFileSync(join(process.cwd(), 'android', 'app', 'luqta-release.keystore'), Buffer.from(ks, 'base64'));
let src = readFileSync(gradle, 'utf8');
if (!src.includes('luqtaRelease')) {
  src = src.replace(/signingConfigs\s*\{/, `signingConfigs {\n        luqtaRelease {\n            storeFile file('luqta-release.keystore')\n            storePassword System.getenv('LUQTA_KEYSTORE_PASSWORD')\n            keyAlias System.getenv('LUQTA_KEY_ALIAS')\n            keyPassword System.getenv('LUQTA_KEY_PASSWORD')\n        }`);
  src = src.replace(/(release\s*\{[^}]*?)signingConfig\s+signingConfigs\.debug/s, '$1signingConfig signingConfigs.luqtaRelease');
}
if (!src.includes('signingConfig signingConfigs.luqtaRelease')) throw new Error('could not wire the release signing config');
writeFileSync(gradle, src);
console.log('release signing: private keystore configured');

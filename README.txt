CALORIEIQ — Free iPhone calorie tracker

VERSION 2: See README.md and DEVELOPMENT.md for current features, local setup,
validation results and pending physical iPhone checks. The original prototype
notes below describe version 1. For current version 2.2 details and testing,
see V2.2-RELEASE.md. The existing GitHub Pages site is the deployment target.

DEPLOY FREE:
1. Extract this ZIP on a computer.
2. Upload the extracted files to the root of your CalorieIQ GitHub repository.
3. In repository Settings > Pages, select Deploy from a branch, main, / (root), then Save.
4. Open the published HTTPS GitHub Pages site on your iPhone in Safari.
5. Safari Share > Add to Home Screen.
6. Grant camera access to scan UPC/EAN food barcodes.

FEATURES:
- Daily calories and macro totals
- Manual food logging, servings and date history
- Barcode lookup via Open Food Facts
- Live camera barcode scanning: native BarcodeDetector where supported; ZXing fallback for iOS Safari
- Local-only storage, JSON backup/restore, offline cached app shell

LIMITATIONS:
- Requires internet for barcode food lookup and first loading of fallback scanner.
- Free third-party services and food data may have availability limits.
- Open Food Facts nutrition can be incomplete; verify package labels.
- Data lives in the browser, not synced between devices.
- This is an untested prototype; verify scanning on your iPhone.

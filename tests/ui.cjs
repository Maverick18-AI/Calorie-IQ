// Follow visible 2.3 controls. Tests must not bypass a removed navigation tab.
async function openAdd(page) {
  if (!await page.locator('#add').isVisible()) {
    await page.locator('nav button[data-view=diary]').click();
    await page.locator('#addFood').click();
  }
}
async function search(page) {
  await openAdd(page);
  await page.locator('#findFood').click();
}
async function manual(page) {
  await search(page);
  await page.locator('#manual').click();
}
async function more(page) {
  await openAdd(page);
  if (!await page.locator('#moreFoodOptions').evaluate(n=>n.open))
    await page.locator('#moreFoodOptions > summary').click();
}
async function barcode(page) {
  await more(page);
  await page.locator('#enterBarcode').click();
}
async function manageFoods(page) {
  await search(page);
  if (!await page.locator('#manageFoods').evaluate(n=>n.open))
    await page.locator('#manageFoods > summary').click();
}
async function quick(page) {
  await more(page);
  if (!await page.locator('#quickPanel').evaluate(n=>n.open))
    await page.locator('#quickPanel > summary').click();
}
async function reuse(page) {
  await more(page);
  if (!await page.locator('.diary-tools').evaluate(n=>n.open))
    await page.locator('.diary-tools > summary').click();
}
async function nav(page,name) {
  if (name==='add') return search(page);
  await page.locator('nav button[data-view='+name+']').click();
}
async function backups(page) {await nav(page,'settings');if(!await page.locator('#dataBackups').evaluate(n=>n.open))await page.locator('#dataBackups > summary').click();}
async function recovery(page) {await backups(page);if(!await page.locator('#recoveryTools').evaluate(n=>n.open))await page.locator('#recoveryTools > summary').click();}
module.exports={openAdd,search,manual,more,barcode,manageFoods,quick,reuse,nav,backups,recovery};

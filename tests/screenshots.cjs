const { chromium }=require('@playwright/test');
const fs=require('node:fs');
const {openApp}=require('./helpers.cjs');
const {execFileSync}=require('node:child_process');
(async()=>{
 const stage=process.argv[2];if(!['before','after'].includes(stage)) throw new Error('Use before or after');
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)});
 fs.mkdirSync('docs/screenshots',{recursive:true});
 for(const colorScheme of ['light','dark']) {
  const page=await browser.newPage({baseURL:'http://127.0.0.1:4173',viewport:{width:390,height:844},colorScheme,locale:'ko-KR',timezoneId:'Asia/Seoul'});
  if(stage==='before') await page.route('**/index.html',r=>r.fulfill({status:200,contentType:'text/html',body:execFileSync('git',['show','main:index.html'],{encoding:'utf8'})}));
  const {app,errors}=await openApp(page);
  await page.screenshot({path:`docs/screenshots/${stage}-${colorScheme}-hero.png`,animations:'disabled'});
  for(const tab of ['timeline','budget','guest','know']) {
   await app.locator(`#tab-${tab}`).click();
   await app.locator('.tabs').evaluate(el=>window.scrollTo({top:window.scrollY+el.getBoundingClientRect().top,behavior:'instant'}));
   await page.screenshot({path:`docs/screenshots/${stage}-${colorScheme}-${tab}.png`,animations:'disabled'});
  }
  if(errors.length) throw new Error(errors.join('\n'));
  await page.close();
 }
 await browser.close();console.log(`Saved 10 ${stage} screenshots (390px).`);
})().catch(e=>{console.error(e);process.exit(1)});

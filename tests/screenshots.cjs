const { chromium }=require('@playwright/test');
const fs=require('node:fs');
const {SEED,openApp}=require('./helpers.cjs');
const {execFileSync}=require('node:child_process');

// PLAN_SEED from app.spec.cjs, with direct amounts, missing amounts and long
// budget names so the same populated UI can be compared before and after.
function priceBudgetSeed(){
 const seed=structuredClone(SEED);
 seed.budget.region='서울 강남';seed.budget.planGroup='pa';
 seed.budget.items.b05={plan:140,actual:145,paid:50};
 seed.budget.items.b06={plan:170};seed.budget.items.b07={plan:240};
 seed.budget.items.b27={plan:350};
 seed.budget.quotes={q1:{name:'봄날 웨딩홀',heads:200,unit:65000,hall:300,extra:40,created:1},q2:{name:'지운 웨딩홀',deleted:true}};
 seed.pricePlan={activeGroup:'pa',groups:{
  pa:{name:'서울 예식안',items:{'hall-rent-1':true,'hall-meal-1':true,'studio-basic-1':true,'hall-extra-1':true,'hall-extra-6':true,'package-1':true,'x-bouquet':true,'x-bouquet-keep':true},
   opts:{'hall-rent-1':'reg:서울 강남','hall-meal-1':'hall-meal-2','studio-basic-1':'studio-basic-4','hall-extra-1':'hall-extra-1','hall-extra-6':'hall-extra-6','package-1':'package-2b'},
   amounts:{'hall-rent-1':520,'x-bouquet':35},
   units:{'hall-meal-1':62000},
   apply:{'hall-rent-1':true,'hall-meal-1':true,'studio-basic-1':true,'hall-extra-1':true,'hall-extra-6':true,'package-1':true,'x-bouquet':true,'x-bouquet-keep':true,u1:true},
   custom:{u1:{name:'축가 반주',budget:'b04',amount:20,created:1},u2:{name:'지운 추가 항목',budget:'b26',deleted:true}}},
  pb:{name:'가성비안',items:{'package-1':true},opts:{'package-1':'package-1'}},
  pc:{name:'지운 비교안',deleted:true}
 }};
 return seed;
}

(async()=>{
 const stage=process.argv[2];if(!['before','after'].includes(stage)) throw new Error('Use before or after');
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)});
 fs.mkdirSync('docs/screenshots',{recursive:true});
 let count=0;
 const beforeHTML=stage==='before'?execFileSync('git',['show',(process.env.SCREENSHOT_BEFORE_REF||'main')+':index.html'],{encoding:'utf8'}):null;
 async function newPage(colorScheme){
  const page=await browser.newPage({baseURL:'http://127.0.0.1:4173',viewport:{width:390,height:844},colorScheme,locale:'ko-KR',timezoneId:'Asia/Seoul'});
  if(beforeHTML) await page.route('**/index.html',r=>r.fulfill({status:200,contentType:'text/html',body:beforeHTML}));
  return page;
 }
 async function capture(page,app,colorScheme,name,target){
  await app.locator('body').evaluate(()=>document.fonts.ready);
  if(target) await target.evaluate(el=>window.scrollTo({top:window.scrollY+el.getBoundingClientRect().top-document.querySelector('.tabs').getBoundingClientRect().height-12,behavior:'instant'}));
  await page.screenshot({path:`docs/screenshots/${stage}-${colorScheme}-${name}.png`,animations:'disabled'});count++;
 }
 for(const colorScheme of ['light','dark']) {
  const page=await newPage(colorScheme);
  const {app,errors}=await openApp(page);
  await capture(page,app,colorScheme,'hero');
  for(const tab of ['timeline','budget','guest','know']) {
   await app.locator(`#tab-${tab}`).click();
   await app.locator('.tabs').evaluate(el=>window.scrollTo({top:window.scrollY+el.getBoundingClientRect().top,behavior:'instant'}));
   await capture(page,app,colorScheme,tab);
  }
  if(errors.length) throw new Error(errors.join('\n'));
  await page.close();

  const detailPage=await newPage(colorScheme);
  const {app:detail,errors:detailErrors}=await openApp(detailPage,priceBudgetSeed());
  const shot=(name,target)=>capture(detailPage,detail,colorScheme,name,target);
  await detail.locator('#tab-price').click();
  await shot('price-plan',detail.locator('.price-builder'));
  await shot('price-tools',detail.locator('.price-builder details[data-k="price-picked"],.price-builder details[data-k="price-custom"]').first());
  await detail.locator('details[data-k="price-custom"] > summary').click();
  await shot('price-custom',detail.locator('details[data-k="price-custom"]'));
  await detail.locator('details[data-k="pt-hall"]').evaluate(el=>el.open=true);
  await shot('price-pick',detail.locator('tr.price-pick').filter({has:detail.locator('[data-act="price-toggle"][data-id="hall-rent-1"]')}));
  await detail.locator('details[data-k="k14"],details[data-k="px-flower"]').evaluateAll(els=>els.forEach(el=>el.open=true));
  await shot('price-extra',detail.locator('details[data-k="px-flower"]'));

  await detail.locator('#tab-budget').click();
  await shot('budget-plan',detail.locator('.plan-review'));
  await shot('budget-plan-rows',detail.locator('.pr-list'));
  await detail.locator('details[data-k="pr-row-b27"] > summary').click();
  await shot('budget-plan-expanded',detail.locator('details[data-k="pr-row-b27"]'));
  await shot('budget-net',detail.locator('.sumgrid'));
  await detail.locator('[data-act="q-open"][data-id="q1"]').click();
  await detail.locator('[data-act="q-apply"][data-id="q1"]').click();
  await shot('quote-confirm',detail.locator('.price-confirm'));

  await detail.locator('#openShare').click();
  await detail.locator('#backupSec').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  await shot('backup');
  if(detailErrors.length) throw new Error(detailErrors.join('\n'));
  await detailPage.close();
 }
 await browser.close();console.log(`Saved ${count} ${stage} screenshots (390px).`);
})().catch(e=>{console.error(e);process.exit(1)});

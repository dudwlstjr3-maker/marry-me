const {test,expect}=require('@playwright/test');
const {SEED,openApp,stored}=require('./helpers.cjs');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const tabs=['timeline','budget','price','guest','honey','know','talk'];
function noArrays(value) { if(Array.isArray(value)) return false; return !value||typeof value!=='object'||Object.values(value).every(noArrays); }

test('date/time and task save using clicks and Enter without forms',async({page})=>{
 const {app,errors}=await openApp(page,null);
 await expect(app.locator('form')).toHaveCount(0);
 await app.locator('#heroGroom').fill('준호');await app.locator('#heroBride').fill('민지');
 await app.locator('#heroDate').fill('2027-05-08');await app.locator('#heroHour').selectOption('12');await app.locator('#heroMin').selectOption('30');
 await app.locator('[data-act="hero-save"]').click();
 await expect.poll(async()=> (await stored(app))?.weddingTime).toBe('12:30');
 await app.locator('#openSettings').click();await app.locator('#inWedding').fill('2027-05-09');await app.locator('#inHour').selectOption('19');await app.locator('#inMin').selectOption('50');await app.locator('#saveSettings').click();
 await expect.poll(async()=> (await stored(app))?.weddingDate).toBe('2027-05-09');
 expect((await stored(app)).weddingTime).toBe('19:50');
 await app.locator('#addDate').fill('2027-04-01');await app.locator('#addTitle').fill('축가 리허설');await app.locator('#addTitle').press('Enter');
 await expect.poll(async()=>Object.values((await stored(app)).custom).some(x=>x.title==='축가 리허설'&&x.date==='2027-04-01')).toBe(true);
 expect(noArrays(await stored(app))).toBe(true);expect(errors).toEqual([]);
});

test('187 guests × 62000 won = 1159 ten-thousand won; quote applies',async({page})=>{
 const {app,errors}=await openApp(page);
 await app.locator('#tab-budget').click();await app.locator('[data-act="b-open"][data-id="b02"]').click();
 await expect(app.locator('[data-act="b-open"][data-id="b02"]').locator('..')).toContainText('1,159만원');
 await expect(app.locator('[data-fk="b-heads-b02"]')).toHaveValue('187');
 await app.locator('#qName').fill('테스트 웨딩홀');await app.locator('#qHeads').fill('187');await app.locator('#qUnit').fill('62000');await app.locator('#qHall').fill('300');await app.locator('#qExtra').fill('40');
 await app.locator('[data-act="q-add"]').click();await app.locator('[data-act="q-open"]').click();await app.locator('[data-act="q-apply"]').click();
 await expect.poll(async()=> (await stored(app)).budget.items.b01.plan).toBe(300);
 const state=await stored(app);expect(state.budget.items.b02).toMatchObject({heads:187,unit:62000});expect(state.budget.items.b27.plan).toBe(40);expect(state.budget.pickedQuote).toBeTruthy();expect(errors).toEqual([]);
});

test('guest entry, gift total, soft deletion and focus after redraw',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-guest').click();
 await app.locator('#gName').fill('박지우');await app.locator('#gCount').fill('2');await app.locator('[data-act="g-add"]').click();
 await expect.poll(async()=>Object.values((await stored(app)).guests).some(x=>x.name==='박지우'&&x.count===2)).toBe(true);
 await app.locator('[data-act="g-view"][data-v="gift"]').click();
 const gift=app.getByRole('textbox',{name:'박지우 축의금 만원',exact:true});await gift.fill('15');await gift.blur();
 await expect.poll(async()=>Object.values((await stored(app)).guests).find(x=>x.name==='박지우').gift).toBe(15);
 await expect(app.locator('.sum').filter({hasText:'축의금 합계'})).toContainText('45만원');
 await app.locator('[data-act="g-view"][data-v="list"]').click();
 const sel=app.locator('select[data-fk="g-quick-attend-g1"]');await sel.focus();await sel.selectOption('no');await expect(sel).toBeFocused();
 await app.locator('[data-act="g-open"]').filter({hasText:'박지우'}).click();
 const guest=(await stored(app)).guests;const id=Object.keys(guest).find(k=>guest[k].name==='박지우');await app.locator(`[data-act="g-del"][data-id="${id}"]`).click();
 await expect.poll(async()=> (await stored(app)).guests[id].deleted).toBe(true);expect(errors).toEqual([]);
});

test('Kakao summary first line, keyboard tabs and reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const {app,errors}=await openApp(page);
 await app.locator('#openShare').click();const first=(await app.locator('#shareText').inputValue()).split('\n')[0];
 expect(first).toBe('[준호 ♥ 민지] 2027년 5월 8일 토요일 오후 12시 30분 (D-214)');
 await app.locator('#closeShare').click();await app.locator('#tab-timeline').focus();await page.keyboard.press('ArrowRight');await expect(app.locator('#tab-budget')).toBeFocused();await page.keyboard.press('ArrowRight');await expect(app.locator('#tab-price')).toBeFocused();await page.keyboard.press('End');await expect(app.locator('#tab-talk')).toBeFocused();await page.keyboard.press('Home');await expect(app.locator('#tab-timeline')).toBeFocused();
 const focus=await app.locator('#tab-timeline').evaluate(e=>getComputedStyle(e).outlineStyle);expect(focus).not.toBe('none');
 expect(await app.locator('.strand i').first().evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');expect(errors).toEqual([]);
});

test('all tabs fit viewport and expose labelled unique focus keys',async({page})=>{
 const {app,errors}=await openApp(page);
 for(const tab of tabs) {
  await app.locator('#tab-'+tab).click();
  if(tab==='timeline') await app.locator('[data-act="open"]').first().click();
  if(tab==='budget') await app.locator('[data-act="b-open"]').first().click();
  if(tab==='guest') await app.locator('[data-act="g-open"]').first().click();
  if(tab==='know') await app.locator('details').evaluateAll(els=>els.forEach(e=>e.open=true));
  if(tab==='price') await app.locator('#panel-price details').evaluateAll(els=>els.forEach(e=>e.open=true));
  const audit=await app.locator('body').evaluate(()=>{
   const visible=e=>!!e.getClientRects().length && !e.closest('[hidden]');
   const controls=[...document.querySelectorAll('input,textarea,select')].filter(visible);
   const keys=controls.map(e=>e.dataset.fk);
   const nav=[...document.querySelectorAll('.tab')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,scroll:e.scrollWidth,client:e.clientWidth}});
   return {overflow:document.documentElement.scrollWidth>innerWidth, missing:controls.filter(e=>!e.dataset.fk||(!e.labels?.length&&!e.getAttribute('aria-label'))).map(e=>e.outerHTML),duplicates:keys.filter((k,i)=>keys.indexOf(k)!==i),nav};
  });
  expect(audit.overflow,tab).toBe(false);expect(audit.missing,tab).toEqual([]);expect(audit.duplicates,tab).toEqual([]);
  expect(new Set(audit.nav.map(r=>Math.round(r.y))).size).toBe(1);
  expect(audit.nav.every(r=>r.w>=43.9&&r.h>=44&&r.scroll<=r.client+1)).toBe(true);
 }
 expect(errors).toEqual([]);
});

test('44px controls and expanded 24px knot hit target',async({page})=>{
 const {app}=await openApp(page);
 const knot=app.locator('[data-act="toggle"][data-id="t04"]');await knot.scrollIntoViewIfNeeded();
 expect((await knot.boundingBox()).width).toBe(24);
 // Click beyond the visible circle, inside the expanded pointer area.
 await knot.evaluate(e=>{const r=e.getBoundingClientRect();const target=document.elementFromPoint(r.left+12,r.top-7);if(target!==e)throw new Error('Expanded knot misses pointer');target.click();});
 await expect(knot).toHaveAttribute('aria-checked','true');
 for(const tab of tabs){await app.locator('#tab-'+tab).click();const small=await app.locator('body').evaluate(()=>[...document.querySelectorAll('button:not(.knot),input,select,summary,a')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden').map(e=>({text:e.textContent.slice(0,40),tag:e.tagName,r:e.getBoundingClientRect()})).filter(x=>x.r.width<43.9||x.r.height<43.9).map(x=>({text:x.text,tag:x.tag,w:x.r.width,h:x.r.height})));expect(small,tab).toEqual([]);}
});

test('timeline tasks expose individually saved detail checks and group completion',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-timeline').click();
 await app.locator('[data-act="open"][data-id="t06"]').click();
 const detail=app.locator('.task').filter({has:app.locator('[data-id="t06"][data-act="open"]')});
 const checks=detail.locator('[data-act="subtask-toggle"]');await expect(checks).toHaveCount(3);
 await checks.nth(0).click();
 await expect.poll(async()=> (await stored(app))?.tasks?.ts06a?.done).toBe(true);
 await expect.poll(async()=> (await stored(app))?.tasks?.t06?.done).toBe(false);
 await app.locator('[data-act="toggle"][data-id="t06"]').click();
 await expect.poll(async()=> (await stored(app))?.tasks?.t06?.done).toBe(true);
 const saved=await stored(app);expect(saved.tasks.ts06a.done).toBe(true);expect(saved.tasks.ts06b.done).toBe(true);expect(saved.tasks.ts06c.done).toBe(true);
 expect(noArrays(saved)).toBe(true);expect(errors).toEqual([]);
});

const pickRow=(app,id)=>app.locator('tr.price-pick').filter({has:app.locator(`[data-act="price-toggle"][data-id="${id}"]`)});
const openSection=async(app,id)=>{const d=app.locator(`#panel-price details[data-k="${id}"]`);if(!(await d.evaluate(e=>e.open)))await d.locator('summary').click();};
const planTotal=app=>app.locator('.price-builder .price-group-summary strong').nth(1);
const PLAN_SEED=()=>{const seed=structuredClone(SEED);seed.budget.region='서울 강남';seed.budget.items.b05={plan:140,actual:145,paid:50};
 seed.pricePlan={activeGroup:'pa',groups:{pa:{name:'서울 예식안',items:{'hall-rent-1':true,'studio-basic-1':true,'hall-extra-1':true,'hall-extra-6':true},opts:{'hall-rent-1':'reg:서울 강남','studio-basic-1':'studio-basic-4','hall-extra-1':'hall-extra-1','hall-extra-6':'hall-extra-6'}},pb:{name:'가성비안',items:{'package-1':true},opts:{'package-1':'package-1'}}}};return seed;};

test('price items are picked one by one, each with one regional price option',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-price').click();
 await openSection(app,'pt-hall');await openSection(app,'pt-studio');
 const rent=app.locator('[data-act="price-toggle"][data-id="hall-rent-1"]'),studio=app.locator('[data-act="price-toggle"][data-id="studio-basic-1"]'),meal=app.locator('[data-act="price-toggle"][data-id="hall-meal-1"]');
 await expect(rent).toHaveAttribute('aria-checked','false');await rent.click();
 await expect(rent).toHaveAttribute('aria-checked','true');await expect(studio).toHaveAttribute('aria-checked','false');
 // Region is 전국, so the first choice is the national regional average.
 await expect(app.locator('[data-price-opt="hall-rent-1"]')).toHaveValue('reg:전국');
 await expect(pickRow(app,'hall-rent-1').locator('.price-pick-amt')).toHaveText('317만원');
 await studio.click();await expect(planTotal(app)).toHaveText('454만원');
 // Several survey values of one item are alternatives: only the chosen one counts.
 await expect(app.locator('[data-price-opt="studio-basic-1"] option')).toHaveCount(5);
 await app.locator('[data-price-opt="studio-basic-1"]').selectOption('studio-basic-2');await expect(planTotal(app)).toHaveText('449만원');
 await app.locator('[data-price-opt="studio-basic-1"]').selectOption('studio-basic-1');
 // A value given only as a pair (peak / off-peak) is summed as a range.
 await app.locator('[data-price-opt="hall-rent-1"]').selectOption('hall-rent-1');await expect(planTotal(app)).toHaveText('387만원 ~ 487만원');
 // Meal price is per person, multiplied by the budget's guaranteed guests.
 await meal.click();await expect(pickRow(app,'hall-meal-1').locator('.price-pick-amt')).toHaveText('5.9만원 × 187명 = 1,103만원');
 await expect(planTotal(app)).toHaveText('1,490만원 ~ 1,590만원');
 await studio.click();await expect(studio).toHaveAttribute('aria-checked','false');await expect(rent).toHaveAttribute('aria-checked','true');
 await expect(planTotal(app)).toHaveText('1,353만원 ~ 1,453만원');
 await expect(app.locator('#panel-price input[inputmode="numeric"], #panel-price input[data-price-amount]')).toHaveCount(0);
 await expect.poll(async()=>{const g=(await stored(app))?.pricePlan?.groups?.default;return g&&g.items['hall-rent-1']===true&&g.opts['hall-rent-1']==='hall-rent-1'&&g.items['studio-basic-1']===false&&g.opts['hall-meal-1']==='reg:전국';}).toBe(true);
 const saved=await stored(app);expect(saved.pricePlan.groups.default.name).toBe('기본안');expect(noArrays(saved)).toBe(true);
 await app.locator('#tab-budget').click();await app.locator('[data-act="b-open"][data-id="b01"]').click();
 await app.locator('[data-bnum="plan"][data-id="b01"]').first().fill('425');
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b01?.plan).toBe(425);
 expect(errors).toEqual([]);
});

test('named plans are created, compared, switched, aligned to the region and deleted',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-price').click();
 await app.locator('#priceRegion').selectOption('서울 강남');
 await app.locator('#priceGroupAddName').fill('서울 예식안');await app.locator('#priceGroupAddName').press('Enter');
 await expect(app.locator('[data-price-group-name]')).toHaveValue('서울 예식안');
 const seoul=await app.locator('.price-group-tab[aria-pressed="true"]').getAttribute('data-id');
 await openSection(app,'pt-studio');await openSection(app,'pt-makeup');await openSection(app,'pt-package');
 await app.locator('[data-act="price-toggle"][data-id="studio-basic-1"]').click();
 await expect(app.locator('[data-price-opt="studio-basic-1"]')).toHaveValue('studio-basic-4');
 await app.locator('[data-act="price-toggle"][data-id="make-basic-1"]').click();
 await expect(app.locator(`.price-group-tab[data-id="${seoul}"]`)).toContainText('251만원');
 await app.locator('#priceGroupAddName').fill('가성비안');await app.locator('[data-act="price-group-add"]').click();
 const cheap=await app.locator('.price-group-tab[aria-pressed="true"]').getAttribute('data-id');expect(cheap).not.toBe(seoul);
 await expect(app.locator('[data-act="price-toggle"][data-id="studio-basic-1"]')).toHaveAttribute('aria-checked','false');
 await app.locator('[data-act="price-toggle"][data-id="package-1"]').click();
 await expect(app.locator('[data-price-opt="package-1"]')).toHaveValue('package-2b');
 await app.locator('[data-price-opt="package-1"]').selectOption('package-1');
 await expect(app.locator(`.price-group-tab[data-id="${cheap}"]`)).toContainText('292만원');
 await expect(app.locator('.price-group-tab')).toHaveCount(3);
 await app.locator('.price-compare > summary').click();
 const total=app.locator('.price-compare-sec').first();
 await expect(total.locator('li').filter({hasText:'서울 예식안'})).toContainText('251만원 · 2개');
 await expect(total.locator('li').filter({hasText:'가성비안'})).toContainText('292만원 · 1개');
 await expect(app.locator('.price-compare-sec').filter({hasText:'스드메 묶음'}).locator('li').filter({hasText:'서울 예식안'})).toContainText('없음');
 // Switching plans keeps each plan's own picks.
 await app.locator(`.price-group-tab[data-id="${seoul}"]`).click();
 await expect(app.locator('[data-act="price-toggle"][data-id="studio-basic-1"]')).toHaveAttribute('aria-checked','true');
 await expect(app.locator('[data-act="price-toggle"][data-id="package-1"]')).toHaveAttribute('aria-checked','false');
 // One region drives both tabs; a plan keeps its prices until the couple chooses to align them.
 await app.locator('#tab-budget').click();await app.locator('#bRegion').selectOption('경기');await app.locator('#tab-price').click();
 await expect(app.locator('#priceRegion')).toHaveValue('경기');await expect(planTotal(app)).toHaveText('251만원');
 await expect(app.locator('#panel-price .price-note')).toContainText('스튜디오 기본');
 await app.locator('[data-act="price-align-region"]').first().click();
 await expect(app.locator('[data-price-opt="studio-basic-1"]')).toHaveValue('studio-basic-3b');
 await expect(planTotal(app)).toHaveText('201만원');await expect(app.locator('#panel-price .price-note')).toHaveCount(0);
 await app.locator(`.price-group-tab[data-id="${cheap}"]`).click();
 await app.locator('[data-act="price-group-delete-ask"]').click();
 await expect(app.locator('[data-act="price-group-delete-cancel"]')).toBeFocused();
 await app.locator('[data-act="price-group-delete-cancel"]').click();await expect(app.locator('.price-group-tab')).toHaveCount(3);
 await app.locator('[data-act="price-group-delete-ask"]').click();await app.locator('[data-act="price-group-delete"]').click();
 await expect(app.locator('.price-group-tab')).toHaveCount(2);await expect(app.locator(`.price-group-tab[data-id="${cheap}"]`)).toHaveCount(0);
 await expect.poll(async()=> (await stored(app))?.pricePlan?.groups?.[cheap]?.deleted).toBe(true);
 const saved=await stored(app);expect(saved.pricePlan.groups[seoul].name).toBe('서울 예식안');expect(saved.pricePlan.groups[seoul].opts['studio-basic-1']).toBe('studio-basic-3b');
 expect(noArrays(saved)).toBe(true);expect(errors).toEqual([]);
});

test('budget loads a plan, reflects chosen items and compares reference prices with my budget',async({page})=>{
 const {app,errors}=await openApp(page,PLAN_SEED());await app.locator('#tab-budget').click();
 await app.locator('details[data-k="pr-box"] > summary').click();
 await app.locator('#bPlanGroup').selectOption('pa');
 const toggle=id=>app.locator(`[data-act="b-plan-apply"][data-id="${id}"]`);
 await expect(app.locator('.pr-picklist li')).toHaveCount(4);
 for(const id of ['hall-rent-1','studio-basic-1','hall-extra-1','hall-extra-6'])await expect(toggle(id)).toHaveAttribute('aria-checked','false');
 await expect(app.locator('.pr-row')).toHaveCount(0);
 await toggle('hall-rent-1').click();await toggle('studio-basic-1').click();
 const sum=app.locator('.pr-sum');
 await expect(sum.locator('div').nth(0).locator('strong')).toHaveText('860만원');
 await expect(sum.locator('div').nth(1).locator('strong')).toHaveText('490만원');
 await expect(sum.locator('.pr-diff')).toHaveText('370만원 초과');
 const row=key=>app.locator(`details[data-k="pr-row-${key}"]`);
 await expect(row('b01').locator('.pr-row-diff')).toHaveText('360만원 초과');
 await expect(row('b05').locator('.pr-row-nums')).toHaveText('참고 150만원 · 내 예산 140만원');
 await row('b05').locator('summary').click();
 await expect(row('b05').locator('.pr-keep')).toContainText('확정 145만원 · 낸 돈 50만원은 그대로 둬요.');
 await row('b05').locator('[data-fk="pr-plan-b05"]').fill('160');
 await expect(row('b05').locator('.pr-row-diff')).toHaveText('10만원 여유');
 await expect(app.locator('[data-fk="pr-plan-b05"]')).toBeFocused();
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b05).toEqual({plan:160,actual:145,paid:50});
 // Two plan items for the same budget line are compared together; an empty budget is excluded from the difference.
 await toggle('hall-extra-1').click();await toggle('hall-extra-6').click();
 await expect(row('b27').locator('.pr-row-diff')).toHaveText('예산 미입력');
 await expect(row('b27').locator('.pr-row-nums')).toHaveText('참고 310만원 · 내 예산 -');
 await expect(app.locator('.pr-legend')).toContainText('예산을 넣지 않은 1곳은 차액에서 뺐어요.');
 await expect(sum.locator('.pr-diff')).toHaveText('350만원 초과');
 await row('b27').locator('summary').click();
 await row('b27').locator('[data-act="b-plan-import"]').click();
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b27?.plan).toBe(310);
 await expect(row('b27').locator('.pr-row-diff')).toHaveText('시세와 같아요');
 // Applying a plan never rewrites amounts on its own; replacing one is an explicit, labelled choice.
 await row('b01').locator('summary').click();
 await expect(row('b01').locator('[data-act="b-plan-import"]')).toHaveText('예산을 710만원으로 바꾸기 (지금 350만원)');
 let saved=await stored(app);expect(saved.budget.items.b01).toEqual({plan:350,paid:100});expect(saved.budget.items.b02).toEqual({heads:187,unit:62000});
 await app.locator('#bPlanGroup').selectOption('pb');await expect(app.locator('[data-act="b-plan-apply"][aria-checked="true"]')).toHaveCount(0);
 await app.locator('#bPlanGroup').selectOption('pa');await expect(app.locator('[data-act="b-plan-apply"][aria-checked="true"]')).toHaveCount(4);
 await expect.poll(async()=>{const s=await stored(app);return s.budget.planGroup==='pa'&&s.pricePlan.groups.pa.apply['hall-extra-6']===true&&s.pricePlan.groups.pb.apply?.['package-1']!==true;}).toBe(true);
 saved=await stored(app);expect(saved.budget.total).toBe(5000);expect(noArrays(saved)).toBe(true);expect(errors).toEqual([]);
});

test('legacy price data is read into the new plans and everything survives a reload',async({page})=>{
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await page.goto('/tests/sandbox.html');const app=page.frameLocator('#app');
 await expect(app.locator('#status')).toHaveText('이 기기에만 저장돼요');
 const put=async data=>{await app.locator('body').evaluate((_,d)=>localStorage.setItem('wedding-plan-v1',JSON.stringify(d)),data);await page.reload();await expect(app.locator('#status')).toHaveText('이 기기에만 저장돼요');};
 // First PR #4 shape: one implicit plan, rows marked include, an old per-row amount that is no longer shown.
 const first=structuredClone(SEED);first.pricePlan={'hall-rent-1':{include:true,amount:400}};await put(first);
 await app.locator('#tab-price').click();await expect(app.locator('.price-group-tab')).toHaveCount(1);
 await expect(app.locator('.price-group-tab[data-id="default"]')).toContainText('250만원 ~ 350만원');
 // Later PR #4 shape: plans keyed by table rows, including a superseded survey row and a regional row.
 const later=structuredClone(SEED);later.pricePlan={activeGroup:'default',groups:{default:{name:'기본안',items:{'hall-rent-1':true,'studio-basic-1':false,'studio-basic-2':true,'hall-meal-2':true}},pg1:{name:'옛 조합',items:{'package-2':true}}}};
 await put(later);await app.locator('#tab-price').click();
 await expect(app.locator('.price-group-tab[data-id="default"]')).toContainText('2,065만원 ~ 2,165만원');
 await expect(app.locator('.price-group-tab[data-id="pg1"]')).toContainText('319만원');
 await openSection(app,'pt-studio');await expect(app.locator('[data-price-opt="studio-basic-1"]')).toHaveValue('studio-basic-2');
 await app.locator('[data-act="price-toggle"][data-id="studio-extra-1"]').click();
 await expect.poll(async()=>{const g=(await stored(app))?.pricePlan?.groups?.default;return g&&g.items['studio-basic-2']===false&&g.items['studio-basic-1']===true&&g.opts['studio-basic-1']==='studio-basic-2'&&g.items['hall-meal-2']===false&&g.opts['hall-meal-1']==='hall-meal-2';}).toBe(true);
 await app.locator('#tab-budget').click();await app.locator('details[data-k="pr-box"] > summary').click();
 await app.locator('#bPlanGroup').selectOption('default');await app.locator('[data-act="b-plan-apply"][data-id="studio-basic-1"]').click();
 await app.locator('details[data-k="pr-row-b05"] > summary').click();await app.locator('[data-fk="pr-plan-b05"]').fill('128');
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b05?.plan).toBe(128);
 await page.reload();await expect(app.locator('#status')).toHaveText('이 기기에만 저장돼요');
 await expect(app.locator('#tab-budget')).toHaveAttribute('aria-selected','true');
 await expect(app.locator('#bPlanGroup')).toHaveValue('default');
 await expect(app.locator('details[data-k="pr-box"]')).toHaveJSProperty('open',true);
 await expect(app.locator('details[data-k="pr-row-b05"] .pr-row-nums')).toHaveText('참고 132만원 · 내 예산 128만원');
 await expect(app.locator('details[data-k="pr-row-b05"] .pr-row-diff')).toHaveText('4만원 초과');
 const saved=await stored(app);
 expect(saved.budget.items.b01).toEqual({plan:350,paid:100});expect(saved.budget.items.b02).toEqual({heads:187,unit:62000});expect(saved.budget.total).toBe(5000);
 expect(saved.guests.g1.gift).toBe(20);expect(saved.tasks.t01.done).toBe(true);expect(saved.pricePlan.groups.pg1.name).toBe('옛 조합');
 expect(noArrays(saved)).toBe(true);
});

test('plan review and item picks fit 320–430px with labels, 44px targets and AA contrast',async({page})=>{
 const seed=PLAN_SEED();Object.keys(seed.pricePlan.groups.pa.items).forEach(k=>{seed.pricePlan.groups.pa.apply=seed.pricePlan.groups.pa.apply||{};seed.pricePlan.groups.pa.apply[k]=true;});
 seed.pricePlan.groups.pa.items['hall-meal-1']=true;seed.pricePlan.groups.pa.opts['hall-meal-1']='hall-meal-2';seed.pricePlan.groups.pa.apply['hall-meal-1']=true;
 seed.pricePlan.groups.pa.items['package-1']=true;seed.pricePlan.groups.pa.opts['package-1']='package-2b';seed.pricePlan.groups.pa.apply['package-1']=true;
 seed.budget.planGroup='pa';
 const {app,errors}=await openApp(page,seed);
 for(const tab of ['price','budget']){
  await app.locator('#tab-'+tab).click();
  await app.locator('#panel-'+tab+' details').evaluateAll(els=>els.forEach(e=>e.open=true));
  const audit=await app.locator('body').evaluate(()=>{
   const visible=e=>!!e.getClientRects().length&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden';
   const controls=[...document.querySelectorAll('input,textarea,select')].filter(visible);const keys=controls.map(e=>e.dataset.fk);
   const wide=[...document.querySelectorAll('body *')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>innerWidth+0.5||r.left<-0.5);}).map(e=>e.className||e.tagName);
   const small=[...document.querySelectorAll('button:not(.knot),input,select,summary,a')].filter(visible).map(e=>({t:e.textContent.slice(0,30),r:e.getBoundingClientRect()})).filter(x=>x.r.width<43.9||x.r.height<43.9).map(x=>x.t);
   function rgba(s){return s.match(/[\d.]+/g).map(Number)}
   function blend(a,b){const alpha=a[3]??1;return a.slice(0,3).map((x,i)=>x*alpha+b[i]*(1-alpha))}
   function bg(e){let c=[255,255,255];const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);for(const n of chain)c=blend(rgba(getComputedStyle(n).backgroundColor),c);return c}
   function lum(c){return c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)}
   const low=[];for(const e of document.querySelectorAll('body *')){if(!visible(e)||e.matches(':disabled')||['SCRIPT','STYLE','OPTION','SVG','PATH'].includes(e.tagName))continue;const text=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');if(!text)continue;const st=getComputedStyle(e),b=bg(e),f=blend(rgba(st.color),b),l=[lum(b),lum(f)].sort((x,y)=>y-x),ratio=(l[0]+.05)/(l[1]+.05);if(ratio<4.5)low.push(text.slice(0,30)+' '+ratio.toFixed(2));}
   return {wide,small,low,missing:controls.filter(e=>!e.dataset.fk||(!e.labels?.length&&!e.getAttribute('aria-label'))).map(e=>e.outerHTML.slice(0,80)),duplicates:keys.filter((k,i)=>keys.indexOf(k)!==i),scroll:document.documentElement.scrollWidth-innerWidth};
  });
  expect(audit.wide,tab).toEqual([]);expect(audit.small,tab).toEqual([]);expect(audit.low,tab).toEqual([]);
  expect(audit.missing,tab).toEqual([]);expect(audit.duplicates,tab).toEqual([]);expect(audit.scroll,tab).toBeLessThanOrEqual(0);
 }
 await expect(app.locator('.pr-row')).toHaveCount(4);
 await expect(app.locator('#panel-budget .price-note').filter({hasText:'겹칠 수 있어요'}).first()).toBeVisible();
 expect(errors).toEqual([]);
});

test('text contrast AA in all tabs including tinted surfaces',async({page})=>{
 const {app}=await openApp(page);
 for(const tab of tabs){await app.locator('#tab-'+tab).click();if(tab==='know'||tab==='price')await app.locator('#panel-'+tab+' details').evaluateAll(els=>els.forEach(e=>e.open=true));
 const failures=await app.locator('body').evaluate(()=>{
  function rgba(s){return s.match(/[\d.]+/g).map(Number)}
  function blend(a,b){const alpha=a[3]??1;return a.slice(0,3).map((x,i)=>x*alpha+b[i]*(1-alpha))}
  function bg(e){let c=[255,255,255];const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);for(const n of chain)c=blend(rgba(getComputedStyle(n).backgroundColor),c);return c}
  function lum(c){return c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)}
  const out=[];for(const e of document.querySelectorAll('body *')){if(!e.getClientRects().length||e.closest('[hidden]')||e.matches(':disabled')||['SCRIPT','STYLE','OPTION','SVG','PATH'].includes(e.tagName))continue;const text=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');if(!text)continue;const st=getComputedStyle(e),background=bg(e),foreground=blend(rgba(st.color),background),l=[lum(background),lum(foreground)].sort((a,b)=>b-a),ratio=(l[0]+.05)/(l[1]+.05);if(ratio<4.5)out.push({text:text.slice(0,40),ratio:Math.round(ratio*100)/100});}return out;
 });expect(failures,tab).toEqual([]);}
});

test('hundreds of guests stay searchable without horizontal overflow',async({page})=>{
 const seed=structuredClone(SEED);seed.guests={};for(let i=0;i<300;i++)seed.guests['bulk'+i]={name:'하객 '+i,side:i%2?'groom':'bride',group:'친구',count:1,gift:10};
 const {app,errors}=await openApp(page,seed);await app.locator('#tab-guest').click();await expect(app.locator('.gitem')).toHaveCount(300);await app.locator('#gSearch').fill('하객 299');await expect(app.locator('.gitem')).toHaveCount(1);await expect(app.locator('#gSearch')).toBeFocused();
 expect(await app.locator('html').evaluate(e=>e.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('storage and fixed content remain byte-for-byte unchanged',async()=>{
 const original=execFileSync('git',['show','main:index.html'],{encoding:'utf8'}),current=fs.readFileSync('index.html','utf8');
 const block=(s,start,end)=>s.slice(s.indexOf(start),s.indexOf(end));
 // The storage layer must never change.
 expect(block(current,'function defaultBody()','/* ---------------- ui state')).toBe(block(original,'function defaultBody()','/* ---------------- ui state'));
 expect(current).not.toMatch(/<form\b|type=["']submit/i);
 // Facts (laws, statistics, dates) may change only when a task asks for it: run with ALLOW_CONTENT_CHANGE=1 and say so in the PR.
 if (process.env.ALLOW_CONTENT_CHANGE === '1') return;
 const normalize=s=>s.replace(/regCalcHTML\('[^']+'\)/g,'regCalcHTML()').replace(/var TASK_DETAILS = \{[\s\S]*?\n\};\n\nvar PHASES =/,'var PHASES =').replace("var TABS = ['timeline','budget','price','guest','honey','know','talk'];","var TABS = ['timeline','budget','guest','honey','know','talk'];");
 expect(normalize(block(current,'var BASIS =','function esc('))).toBe(normalize(block(original,'var BASIS =','function esc(')));
 const updatePriceLink=source=>source.replace("'<li>항목별 금액은 위의 \\'항목별 가격 비교표\\'에 모아 두었어요.</li></ul>'", "'<li>항목별 금액은 가격 비교 탭에서 확인할 수 있어요. <button class=\"link\" type=\"button\" data-act=\"goto-price\">가격 비교 탭 열기</button></li></ul>'");
 const stripMovedExtraCost=source=>{const start=source.indexOf("  h += card('k11', '견적서 밖에서 나오는 돈',"),end=source.indexOf("  h += card('k7',",start);if(start<0||end<0)return source;return source.slice(0,start)+source.slice(end);};
 expect(normalize(block(current,'function knowHTML(){','function priceHTML(){'))).toBe(normalize(updatePriceLink(stripMovedExtraCost(block(original,'function knowHTML(){','function priceHTML(){')))));
});

test('price comparison keeps regional prices with their item and supports per-item accordions',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-budget').click();
 await app.locator('#tab-know').click();
 await expect(app.locator('#panel-know details[data-k="k11"]')).toHaveCount(0);
 await app.locator('#tab-price').click();
 await expect(app.locator('#panel-price details[data-k="k11"]')).toContainText('견적서 밖에서 나오는 돈');
 await app.locator('#tab-budget').click();
 await expect(app.locator('#panel-budget .rbox')).toHaveCount(0);
 await expect(app.locator('#panel-budget select[data-bregion]')).toHaveCount(1);
 await app.locator('[data-act="goto-price"]').first().click();
 await expect(app.locator('#tab-price')).toHaveAttribute('aria-selected','true');
 await expect(app.locator('#panel-price .rbox')).toHaveCount(0);
 await expect(app.locator('#panel-price select[data-bregion]')).toHaveCount(1);
 await expect(app.locator('#priceRegion')).toHaveValue('전국');
 const card=app.locator('#panel-price details[data-k="k13"]');
 const sections=card.locator('details.pt-accordion');
 await expect(sections).toHaveCount(9);
 await expect(card.locator('details.pt-accordion[open]')).toHaveCount(0);
 await app.locator('#tab-budget').click();
 const row=id=>app.locator(`[data-act="b-open"][data-id="${id}"]`).locator('xpath=ancestor::li[1]');
 await expect(row('b01').locator('.refline')).toHaveText('전국 대관료 평균 317만원, 내 금액이 33만원 높아요');
 await expect(row('b02').locator('.refline')).toHaveText('전국 1인 식대 평균 5.9만원, 내 금액이 0.3만원 높아요');
 await expect(row('b05').locator('.refline')).toContainText('스튜디오 전국 중간값 137만원(2026년 2월)');
 await app.locator('[data-act="goto-price"][data-sec="pt-hall"]').click();
 await expect(card).toHaveJSProperty('open',true);
 const section=id=>card.locator('details.pt-accordion').filter({has:app.locator('#'+id)});
 for (const id of ['pt-read','pt-total','pt-hall','pt-studio','pt-dress','pt-makeup','pt-package','pt-timing','pt-check']) await expect(section(id)).toHaveCount(1);
 await expect(section('pt-hall')).toHaveJSProperty('open',true);
 const hallCaptions=await section('pt-hall').locator('.rcap').allTextContents();
 expect(hallCaptions).toEqual(['기본(필수) 항목','대관료','지역별 대관료 (만원)','1인 식대','지역별 1인 식대 (만원)','추가금(선택 항목)']);
 await expect(card.locator('details.pt-accordion[open]')).toHaveCount(1);
 await expect(card.locator('.ptable')).toHaveCount(13);
 await section('pt-dress').locator('summary').click();
 await expect(section('pt-dress')).toHaveJSProperty('open',true);
 await expect(card.locator('details.pt-accordion[open]')).toHaveCount(2);
 await section('pt-hall').locator('summary').click();
 await expect(section('pt-hall')).toHaveJSProperty('open',false);
 await expect(section('pt-dress')).toHaveJSProperty('open',true);
 await app.locator('#priceRegion').selectOption('서울 강남');
 await expect.poll(async()=> (await stored(app))?.budget.region).toBe('서울 강남');
 await expect(app.locator('#panel-price .rtable:not(.ptable) tbody tr')).toHaveCount(3);
 for (const row of await app.locator('#panel-price .rtable:not(.ptable) tbody tr').all()) await expect(row.locator('th[scope="row"]')).toContainText('서울 강남');
 await app.locator('#tab-budget').click();
 await expect(app.locator('#bRegion')).toHaveValue('서울 강남');
 await app.locator('#panel-budget select[data-bregion]').selectOption('부산');
 await expect.poll(async()=> (await stored(app))?.budget.region).toBe('부산');
 await app.locator('#tab-price').click();
 await expect(app.locator('#priceRegion')).toHaveValue('부산');
 for (const row of await app.locator('#panel-price .rtable:not(.ptable) tbody tr').all()) await expect(row.locator('th[scope="row"]')).toContainText('부산');
 await expect(section('pt-dress')).toHaveJSProperty('open',true);
 await app.locator('#tab-budget').click();
 await expect(row('b02').locator('.refline')).toContainText('부산 1인 식대 평균 4.7만원');
 await expect(app.locator('#panel-know details[data-k="k13"]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('ceremony decorations are inert, compact and respect motion preferences',async({page})=>{
 const {app}=await openApp(page);
 const audit=await app.locator('body').evaluate(()=>{
  const svg=[...document.querySelectorAll('svg[aria-hidden="true"]')];
  const decor=[...document.querySelectorAll('.ceremony-decor,.bow')];
  const frames=[...document.styleSheets].filter(s=>s.ownerNode.tagName==='STYLE').flatMap(s=>[...s.cssRules]).filter(r=>r.type===CSSRule.KEYFRAMES_RULE);
  return {
   bytes:new TextEncoder().encode(svg.map(e=>e.outerHTML).join('')).length,
   inert:decor.every(e=>e.getAttribute('aria-hidden')==='true'&&getComputedStyle(e).pointerEvents==='none'),
   animated:[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).animationName!=='none').map(e=>e.className),
   keyframeProperties:frames.flatMap(r=>[...r.cssRules].flatMap(f=>[...f.style])),
   overflow:[document.documentElement,document.body].map(e=>getComputedStyle(e).overflowX),
   touch:getComputedStyle(document.querySelector('#panel-timeline')).touchAction,
   fill:document.querySelector('.aisle-fill').style.width,
   strand:document.querySelector('.strand i').style.width
  };
 });
 expect(audit.bytes).toBeLessThanOrEqual(30000);
 expect(audit.inert).toBe(true);
 expect(audit.animated).toEqual(['petal','petal','petal']);
 expect([...new Set(audit.keyframeProperties)].sort()).toEqual(['opacity','transform']);
 expect(audit.overflow).toEqual(['clip','clip']);expect(audit.touch).toContain('pan-y');
 expect(audit.fill).toBe(audit.strand);
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(app.locator('.petals')).toBeHidden();
 expect(await app.locator('.petal').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
});

test('standalone website keeps saved data after reload and shares its own URL',async({page})=>{
 // No init script clears storage here: a deployed page must survive a real reload.
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await page.goto('/index.html');
 await expect(page.locator('#status')).toHaveText('이 기기에만 저장돼요');
 await page.locator('#heroGroom').fill('준호');await page.locator('#heroBride').fill('민지');
 await page.locator('#heroDate').fill('2027-05-08');
 await page.locator('[data-act="hero-save"]').click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wedding-plan-v1'))?.weddingDate)).toBe('2027-05-08');
 await page.reload();
 await expect(page.locator('.names')).toContainText('준호');
 await expect(page.locator('.names')).toContainText('민지');
 await expect(page.locator('.when')).toContainText('2027년 5월 8일');
 await page.locator('#openShare').click();
 await expect(page.locator('#shareLink')).toHaveValue(page.url());
});

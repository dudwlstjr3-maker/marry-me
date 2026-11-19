const {test,expect}=require('@playwright/test');
const {SEED,openApp,stored}=require('./helpers.cjs');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const tabs=['timeline','cal','budget','price','guest','honey','know','talk'];
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

test('187 guests × 62000 won = 1159 ten-thousand won; quote applies after showing what changes',async({page})=>{
 const {app,errors}=await openApp(page);
 await app.locator('#tab-budget').click();await app.locator('[data-act="b-open"][data-id="b02"]').click();
 await expect(app.locator('[data-act="b-open"][data-id="b02"]').locator('..')).toContainText('1,159만원');
 await expect(app.locator('[data-fk="b-heads-b02"]')).toHaveValue('187');
 await app.locator('#qName').fill('테스트 웨딩홀');await app.locator('#qHeads').fill('187');await app.locator('#qUnit').fill('62000');await app.locator('#qHall').fill('300');await app.locator('#qExtra').fill('40');
 await app.locator('[data-act="q-add"]').click();await app.locator('[data-act="q-open"]').click();await app.locator('[data-act="q-apply"]').click();
 // An existing amount would change, so the app lists the change and waits.
 await expect(app.locator('.q-changes li')).toHaveText(['대관료 350만원 → 300만원']);
 await expect(app.locator('[data-act="q-apply-cancel"]')).toBeFocused();
 expect((await stored(app)).budget.items.b01.plan).toBe(350);
 await app.locator('[data-act="q-apply-cancel"]').click();await expect(app.locator('.q-changes')).toHaveCount(0);
 expect((await stored(app)).budget.items.b01.plan).toBe(350);
 await app.locator('[data-act="q-apply"]').click();await app.locator('[data-act="q-apply-yes"]').click();
 await expect.poll(async()=> (await stored(app)).budget.items.b01.plan).toBe(300);
 expect((await stored(app)).budget.items.b01.paid).toBe(100);
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
 await app.locator('#closeShare').click();await app.locator('#tab-timeline').focus();await page.keyboard.press('ArrowRight');await expect(app.locator('#tab-cal')).toBeFocused();await page.keyboard.press('ArrowRight');await expect(app.locator('#tab-budget')).toBeFocused();await page.keyboard.press('End');await expect(app.locator('#tab-talk')).toBeFocused();await page.keyboard.press('Home');await expect(app.locator('#tab-timeline')).toBeFocused();
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
  // Eight tabs in two rows of four on phones: every tab is on screen without sliding.
 expect(new Set(audit.nav.map(r=>Math.round(r.y))).size).toBe(2);
 expect(audit.nav.every(r=>r.x>=0&&r.x+r.w<=page.viewportSize().width+0.5)).toBe(true);
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
const openSection=async(app,id)=>{
 const d=app.locator(`#panel-price details[data-k="${id}"]`);
 const parents=await d.evaluate(el=>{const keys=[];for(let p=el.parentElement;p;p=p.parentElement)if(p.matches('details[data-k]'))keys.unshift(p.dataset.k);return keys;});
 for(const key of parents){const section=app.locator(`#panel-price details[data-k="${key}"]`);if(!(await section.evaluate(e=>e.open)))await section.locator(':scope > summary').click();}
 if(!(await d.evaluate(e=>e.open)))await d.locator('summary').click();
};
const planTotal=app=>app.locator('.price-builder .price-group-summary strong').nth(1);
const PLAN_SEED=()=>{const seed=structuredClone(SEED);seed.budget.region='서울 강남';seed.budget.items.b05={plan:140,actual:145,paid:50};
 seed.pricePlan={activeGroup:'pa',groups:{pa:{name:'서울 예식안',items:{'hall-rent-1':true,'studio-basic-1':true,'hall-extra-1':true,'hall-extra-6':true},opts:{'hall-rent-1':'reg:서울 강남','studio-basic-1':'studio-basic-4','hall-extra-1':'hall-extra-1','hall-extra-6':'hall-extra-6'}},pb:{name:'가성비안',items:{'package-1':true},opts:{'package-1':'package-1'}}}};return seed;};

test('empty price categories collapse without losing content, input or disclosure state',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-price').click();
 const category=app.locator('#panel-price details[data-k="k13"]');
 const saved=await stored(app);
 await expect(category).toHaveJSProperty('open',false);
 await expect(category.locator('.ptable')).toHaveCount(13);
 await category.locator(':scope > summary').focus();await page.keyboard.press('Enter');
 await expect(category).toHaveJSProperty('open',true);
 await openSection(app,'pt-read');await expect(app.locator('.price-builder-intro')).toBeVisible();
 expect(await stored(app)).toEqual(saved);
 await openSection(app,'pt-hall');await app.locator('[data-act="price-toggle"][data-id="hall-rent-1"]').click();
 await app.locator('[data-price-mine="hall-rent-1"]').fill('420');
 await expect.poll(async()=> (await stored(app))?.pricePlan?.groups?.default?.amounts?.['hall-rent-1']).toBe(420);
 await category.locator(':scope > summary').click();
 await app.locator('#tab-budget').click();await app.locator('#tab-price').click();
 await expect(category).toHaveJSProperty('open',false);
 await openSection(app,'pt-hall');await expect(app.locator('[data-price-mine="hall-rent-1"]')).toHaveValue('420');
 expect(errors).toEqual([]);
});

test('price items are picked one by one, each with one regional reference option',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-price').click();
 await openSection(app,'pt-hall');await openSection(app,'pt-studio');
 const rent=app.locator('[data-act="price-toggle"][data-id="hall-rent-1"]'),studio=app.locator('[data-act="price-toggle"][data-id="studio-basic-1"]'),meal=app.locator('[data-act="price-toggle"][data-id="hall-meal-1"]');
 await expect(rent).toHaveAttribute('aria-checked','false');await rent.click();
 await expect(rent).toHaveAttribute('aria-checked','true');await expect(studio).toHaveAttribute('aria-checked','false');
 // Reference prices are laid out as plain text, not a control; the regional value is the base when no amount is typed.
 const refs=id=>pickRow(app,id).locator('.price-ref-list li');
 await expect(refs('hall-rent-1')).toHaveCount(2);
 await expect(refs('hall-rent-1').nth(0).locator('strong')).toHaveText('350만원 / 250만원');
 await expect(pickRow(app,'hall-rent-1').locator('li.used .price-ref-name')).toContainText('전국 평균');
 await expect(pickRow(app,'hall-rent-1').locator('li.used strong')).toHaveText('317만원');
 await expect(pickRow(app,'hall-rent-1').locator('.price-refs select, .price-refs input, .price-refs button')).toHaveCount(0);
 await expect(pickRow(app,'hall-rent-1').locator('.price-refs-note')).toHaveText('금액을 비우면 ‘기준’ 값으로 계산해요.');
 await expect(pickRow(app,'hall-rent-1').locator('.price-pick-amt')).toHaveText('참고 317만원');
 // Several survey values of one item are shown side by side, but only the base one counts.
 await studio.click();await expect(refs('studio-basic-1')).toHaveCount(6);
 await expect(pickRow(app,'studio-basic-1').locator('li.used strong')).toHaveText('140만원');
 await expect(planTotal(app)).toHaveText('457만원');
 // Meal price is per person, multiplied by the budget's guaranteed guests.
 await meal.click();await expect(pickRow(app,'hall-meal-1').locator('.price-pick-amt')).toHaveText('참고 5.9만원 × 187명 = 1,103만원');
 await expect(planTotal(app)).toHaveText('1,560만원');
 await studio.click();await expect(studio).toHaveAttribute('aria-checked','false');await expect(rent).toHaveAttribute('aria-checked','true');
 await expect(planTotal(app)).toHaveText('1,420만원');
 // Only picked items get an amount field; empty fields show the base reference as a hint.
 await expect(app.locator('#panel-price input[data-price-mine]')).toHaveCount(2);
 await expect(app.locator('[data-price-mine="hall-rent-1"]')).toHaveAttribute('placeholder','참고 317');
 await expect(app.locator('[data-price-mine="hall-meal-1"]')).toHaveAttribute('placeholder','참고 59,000');
 await expect.poll(async()=>{const g=(await stored(app))?.pricePlan?.groups?.default;return g&&g.items['hall-rent-1']===true&&g.opts['hall-rent-1']==='reg:전국'&&g.items['studio-basic-1']===false&&g.opts['hall-meal-1']==='reg:전국';}).toBe(true);
 const saved=await stored(app);expect(saved.pricePlan.groups.default.name).toBe('기본안');expect(noArrays(saved)).toBe(true);
 await app.locator('#tab-budget').click();await app.locator('[data-act="b-open"][data-id="b01"]').click();
 await app.locator('[data-fk="b-total-b01"]').fill('425');
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
 await expect(pickRow(app,'studio-basic-1').locator('li.used .price-ref-name')).toContainText('서울 강남');
 await app.locator('[data-act="price-toggle"][data-id="make-basic-1"]').click();
 await expect(app.locator(`.price-group-tab[data-id="${seoul}"]`)).toContainText('251만원');
 await app.locator('#priceGroupAddName').fill('가성비안');await app.locator('[data-act="price-group-add"]').click();
 const cheap=await app.locator('.price-group-tab[aria-pressed="true"]').getAttribute('data-id');expect(cheap).not.toBe(seoul);
 await expect(app.locator('[data-act="price-toggle"][data-id="studio-basic-1"]')).toHaveAttribute('aria-checked','false');
 await app.locator('[data-act="price-toggle"][data-id="package-1"]').click();
 await expect(pickRow(app,'package-1').locator('li.used .price-ref-name')).toContainText('스드메 서울');
 await expect(pickRow(app,'package-1').locator('li.used .price-ref-name em').first()).toHaveText('지금 지역');
 await expect(app.locator(`.price-group-tab[data-id="${cheap}"]`)).toContainText('399만원');
 await expect(app.locator('.price-group-tab')).toHaveCount(3);
 await app.locator('.price-compare > summary').click();
 const total=app.locator('.price-compare-sec').first();
 await expect(total.locator('li').filter({hasText:'서울 예식안'})).toContainText('251만원 · 2개');
 await expect(total.locator('li').filter({hasText:'가성비안'})).toContainText('399만원 · 1개');
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
 await expect(pickRow(app,'studio-basic-1').locator('li.used strong')).toHaveText('경기·충청 100만원');
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
 await expect(row('b27').locator('.pr-row-nums')).toHaveText('참고 286만원 · 내 예산 -');
 await expect(app.locator('.pr-legend')).toContainText('예산이나 금액을 넣지 않은 1곳은 차액에서 뺐어요.');
 await expect(sum.locator('.pr-diff')).toHaveText('350만원 초과');
 await row('b27').locator('summary').click();
 await row('b27').locator('[data-act="b-plan-import"]').click();
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b27?.plan).toBe(286);
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

test('my own amounts replace the reference price in plans and in the budget review',async({page})=>{
 const {app,errors}=await openApp(page,PLAN_SEED());await app.locator('#tab-price').click();
 await openSection(app,'pt-hall');
 await expect(app.locator('.price-group-tab[data-id="pa"]')).toContainText('1,146만원');
 const rent=app.locator('[data-price-mine="hall-rent-1"]');
 await expect(rent).toHaveValue('');await expect(rent).toHaveAttribute('placeholder','참고 710');
 await rent.fill('520');await expect(rent).toBeFocused();
 await expect(pickRow(app,'hall-rent-1').locator('.price-pick-amt')).toHaveText('내 금액 520만원');
 await expect(pickRow(app,'hall-rent-1').locator('li.used strong')).toHaveText('710만원');
 await expect(pickRow(app,'hall-rent-1').locator('.price-refs-note')).toHaveText('합계에는 직접 넣은 금액을 써요.');
 await expect(planTotal(app)).toHaveText('956만원');
 await expect(app.locator('.price-builder .price-group-summary div').nth(2).locator('strong')).toHaveText('1개 / 3개');
 // Typed amounts are not region-dependent, so changing the region raises no notice for them.
 await app.locator('#priceRegion').selectOption('부산');await expect(app.locator('#panel-price .price-note')).toHaveCount(0);
 await expect(planTotal(app)).toHaveText('956만원');
 await app.locator('[data-act="price-toggle"][data-id="hall-meal-1"]').click();
 await app.locator('[data-price-mine="hall-meal-1"]').fill('65000');
 await expect(pickRow(app,'hall-meal-1').locator('.price-pick-amt')).toHaveText('내 금액 6.5만원 × 187명 = 1,216만원');
 await expect.poll(async()=>{const g=(await stored(app))?.pricePlan?.groups?.pa;return g?.amounts?.['hall-rent-1']===520&&g?.units?.['hall-meal-1']===65000;}).toBe(true);
 await app.locator('#tab-budget').click();await app.locator('details[data-k="pr-box"] > summary').click();
 await app.locator('#bPlanGroup').selectOption('pa');
 await app.locator('[data-act="b-plan-apply"][data-id="hall-rent-1"]').click();
 const row=app.locator('details[data-k="pr-row-b01"]');
 await expect(row.locator('.pr-row-nums')).toHaveText('비교안 520만원 · 내 예산 350만원');
 await expect(row.locator('.pr-row-diff')).toHaveText('170만원 초과');
 await row.locator('summary').click();
 await expect(row.locator('.pr-lines small')).toHaveText('직접 넣은 금액 · 참고 시세 710만원');
 expect((await stored(app)).budget.items.b01).toEqual({plan:350,paid:100});
 await row.locator('[data-act="b-plan-import"]').click();
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b01).toEqual({plan:520,paid:100});
 // A budget equal to my own amount is not called a market price.
 await expect(row.locator('.pr-row-diff')).toHaveText('비교안과 같아요');
 await expect(row.locator('.pr-keep').filter({hasText:'예산이 이미'})).toHaveText('예산이 이미 비교안 금액과 같아요.');
 // Clearing my amount falls back to the reference price.
 await app.locator('#tab-price').click();await rent.fill('');
 await expect(pickRow(app,'hall-rent-1').locator('.price-pick-amt')).toHaveText('참고 710만원');
 await expect.poll(async()=> (await stored(app))?.pricePlan?.groups?.pa?.amounts?.['hall-rent-1']).toBe('');
 expect(noArrays(await stored(app))).toBe(true);expect(errors).toEqual([]);
});

test('extra costs without reference prices and my own items flow into plans and the budget',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-price').click();
 const extra=app.locator('#panel-price details[data-k="k14"]');
 await expect(extra).toContainText('그 밖에 드는 비용');await extra.locator('> summary').click();
 await expect(extra.locator('details.pt-accordion')).toHaveCount(9);
 await extra.locator('details[data-k="px-flower"] > summary').click();
 await expect(extra.locator('details[data-k="px-flower"]')).toContainText('보존하는 비용과, 업체로 보내고 돌려받는 포장·택배비');
 await app.locator('[data-act="price-toggle"][data-id="x-bouquet"]').click();
 await app.locator('[data-act="price-toggle"][data-id="x-bouquet-keep"]').click();
 const bouquet=app.locator('[data-price-mine="x-bouquet"]');
 await expect(bouquet).toHaveAttribute('placeholder','견적이나 예상 금액');await bouquet.fill('35');
 await expect(planTotal(app)).toHaveText('35만원');
 const missing=app.locator('.price-builder .price-group-summary > div').filter({hasText:'금액 미입력'});
 await expect(missing.locator('strong')).toHaveText('1개');
 await extra.locator('details[data-k="px-thanks"] > summary').click();
 await app.locator('[data-act="price-toggle"][data-id="x-song"]').click();await app.locator('[data-price-mine="x-song"]').fill('30');
 // Anything not on the list can be added by name, linked to a budget line.
 await app.locator('.price-custom > summary').click();
 await app.locator('#priceCustomName').fill('축가 반주');await app.locator('#priceCustomBudget').selectOption('b04');
 await app.locator('#priceCustomAmount').fill('20');await app.locator('#priceCustomAmount').press('Enter');
 await expect(app.locator('.price-custom-item')).toHaveCount(1);await expect(app.locator('#priceCustomName')).toBeFocused();
 await expect(planTotal(app)).toHaveText('85만원');
 await expect.poll(async()=>{const g=(await stored(app))?.pricePlan?.groups?.default;const c=g&&Object.values(g.custom||{})[0];
  return !!(g&&g.items['x-bouquet']&&g.amounts['x-bouquet']===35&&c&&c.name==='축가 반주'&&c.budget==='b04'&&c.amount===20);}).toBe(true);
 await app.locator('#tab-budget').click();await app.locator('details[data-k="pr-box"] > summary').click();
 await app.locator('#bPlanGroup').selectOption('default');await app.locator('[data-act="b-plan-apply-all"][data-v="1"]').click();
 const row=key=>app.locator(`details[data-k="pr-row-${key}"]`);
 await expect(row('b04').locator('.pr-row-nums')).toHaveText('비교안 50만원 · 내 예산 -');
 await expect(row('b27').locator('.pr-row-diff')).toHaveText('금액 미입력');
 await expect(row('b27').locator('.pr-row-nums')).toHaveText('비교안 35만원 + 미입력 · 내 예산 -');
 await row('b04').locator('summary').click();await row('b04').locator('[data-fk="pr-plan-b04"]').fill('60');
 await expect(row('b04').locator('.pr-row-diff')).toHaveText('10만원 여유');
 await expect(row('b04').locator('.pr-lines li')).toHaveCount(2);
 await row('b27').locator('summary').click();await expect(row('b27')).toContainText('금액을 넣지 않은 항목이 있어 예산에 넣을 값이 없어요.');
 await app.locator('#tab-price').click();
 const cid=Object.keys((await stored(app)).pricePlan.groups.default.custom)[0];
 await app.locator(`[data-act="price-custom-del"][data-id="${cid}"]`).first().click();
 await expect(app.locator('.price-custom-item')).toHaveCount(0);await expect(planTotal(app)).toHaveText('65만원');
 await expect.poll(async()=> (await stored(app))?.pricePlan?.groups?.default?.custom?.[cid]?.deleted).toBe(true);
 expect((await stored(app)).budget.items.b04).toEqual({plan:60});
 expect(noArrays(await stored(app))).toBe(true);expect(errors).toEqual([]);
});

test('only the open tab is drawn, and the budget shows what is left after gift money',async({page})=>{
 const {app,errors}=await openApp(page);
 const filled=()=>app.locator('body').evaluate(()=>[...document.querySelectorAll('.panel')].filter(p=>p.children.length).map(p=>p.id));
 expect(await filled()).toEqual(['panel-timeline']);
 await app.locator('#tab-guest').click();expect(await filled()).toEqual(['panel-guest']);
 await app.locator('#tab-budget').click();expect(await filled()).toEqual(['panel-budget']);
 // SEED: 350 + 187 × 62,000원 = 1,509.4만원 expected, 30만원 in gifts.
 await expect(app.locator('.who.net')).toHaveText('받은 축의금 30만원축의금을 빼면 실제 부담 1,479만원');
 expect(errors).toEqual([]);
});

test('deleted guests, tasks, budget items and plans can be restored',async({page})=>{
 const {app,errors}=await openApp(page);
 await app.locator('#tab-guest').click();await app.locator('[data-act="g-open"][data-id="g1"]').click();await app.locator('[data-act="g-del"][data-id="g1"]').click();
 const guestTrash=app.locator('details[data-k="trash-guest"]');
 await expect(guestTrash.locator('summary')).toHaveText('지운 하객 (1)');
 await guestTrash.locator('summary').click();await guestTrash.locator('[data-act="restore"][data-id="g1"]').click();
 await expect(app.locator('[data-act="g-open"][data-id="g1"]')).toHaveCount(1);await expect(guestTrash).toHaveCount(0);
 await expect.poll(async()=> (await stored(app)).guests.g1.deleted).toBe(false);
 await app.locator('#tab-timeline').click();
 await app.locator('#addDate').fill('2027-04-01');await app.locator('#addTitle').fill('부케 픽업');await app.locator('[data-act="task-add"]').click();
 await expect.poll(async()=>Object.keys((await stored(app)).custom).length).toBe(1);
 const taskId=Object.keys((await stored(app)).custom)[0];
 await app.locator(`[data-act="open"][data-id="${taskId}"]`).click();await app.locator(`[data-act="delete"][data-id="${taskId}"]`).click();
 await app.locator('details[data-k="trash-task"] > summary').click();await app.locator(`[data-act="restore"][data-id="${taskId}"]`).click();
 await expect(app.locator(`[data-act="open"][data-id="${taskId}"]`)).toHaveCount(1);
 await app.locator('#tab-price').click();
 await app.locator('#priceGroupAddName').fill('지울 안');await app.locator('[data-act="price-group-add"]').click();
 const gid=await app.locator('.price-group-tab[aria-pressed="true"]').getAttribute('data-id');
 await app.locator('[data-act="price-group-delete-ask"]').click();await app.locator('[data-act="price-group-delete"]').click();
 await expect(app.locator('.price-group-tab')).toHaveCount(1);
 await app.locator('details[data-k="trash-price"] > summary').click();await app.locator(`[data-act="restore"][data-id="${gid}"]`).click();
 await expect(app.locator('.price-group-tab')).toHaveCount(2);await expect(app.locator(`.price-group-tab[data-id="${gid}"]`)).toContainText('지울 안');
 expect(noArrays(await stored(app))).toBe(true);expect(errors).toEqual([]);
});

test('backup text and file restore everything into an empty browser',async({page,browser})=>{
 const {app,errors}=await openApp(page);
 await app.locator('#openShare').click();
 await app.locator('#backupCopy').click();
 const box=app.locator('#backupText');await expect(box).toBeVisible();
 const text=await box.inputValue();const backup=JSON.parse(text);
 expect(backup.app).toBe('marry-me');expect(backup.data.groom).toBe('준호');expect(backup.data.guests.g1.name).toBe('김하늘');
 // A second, empty browser takes the backup through the paste box, after one confirmation.
 const other=await browser.newContext({viewport:page.viewportSize(),locale:'ko-KR'});const page2=await other.newPage();
 const {app:app2,errors:errors2}=await openApp(page2,null);
 await app2.locator('#openShare').click();
 await app2.locator('#restoreText').fill('{"nope":1}');await app2.locator('#restoreApply').click();
 await expect(app2.locator('#shareMsg')).toHaveText('결혼 준비 앱의 백업이 아니에요.');
 await app2.locator('#restoreText').fill(text);await app2.locator('#restoreApply').click();
 await expect(app2.locator('#shareMsg')).toContainText('하객 2명');await expect(app2.locator('#restoreApply')).toHaveText('이대로 가져오기');
 expect(await stored(app2)).toBeNull();
 await app2.locator('#restoreApply').click();await expect(app2.locator('#shareMsg')).toHaveText('백업을 가져왔어요.');
 await expect.poll(async()=> (await stored(app2))?.budget?.items?.b01?.plan).toBe(350);
 const restored=await stored(app2);expect(restored.groom).toBe('준호');expect(restored.guests.g2.name).toBe('이수진');expect(noArrays(restored)).toBe(true);
 // The same works from a file.
 const page3=await other.newPage();const {app:app3}=await openApp(page3,null);
 await app3.locator('#openShare').click();
 await app3.locator('#restoreFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(text)});
 await expect(app3.locator('#restoreText')).toHaveValue(text);
 await app3.locator('#restoreApply').click();await app3.locator('#restoreApply').click();
 await expect.poll(async()=> (await stored(app3))?.bride).toBe('민지');
 await other.close();expect(errors).toEqual([]);expect(errors2).toEqual([]);
});

test('standalone page saves the backup as a file',async({page})=>{
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await page.addInitScript(seed=>{localStorage.clear();localStorage.setItem('wedding-plan-v1',JSON.stringify(seed));},SEED);
 await page.goto('/index.html');await expect(page.locator('#status')).toHaveText('이 기기에만 저장돼요');
 await page.locator('#openShare').click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#backupSave').click()]);
 expect(download.suggestedFilename()).toMatch(/^marry-me-backup-\d{4}-\d{2}-\d{2}\.json$/);
 const body=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 expect(body.app).toBe('marry-me');expect(body.data.weddingDate).toBe('2027-05-08');
});

test('claude.ai shared storage: loads, saves patches and follows the partner’s edits',async({page})=>{
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await page.addInitScript(seed=>{
  if(window.top===window)return;
  let data=JSON.parse(JSON.stringify(seed));const listeners=[];window.__writes=[];
  const merge=(t,s)=>{for(const k of Object.keys(s)){if(s[k]&&typeof s[k]==='object'&&t[k]&&typeof t[k]==='object')merge(t[k],s[k]);else t[k]=JSON.parse(JSON.stringify(s[k]));}};
  const snap=()=>({exists:true,data:()=>JSON.parse(JSON.stringify(data))});
  const ref={onSnapshot(cb){listeners.push(cb);setTimeout(()=>cb(snap()),0);},set(d){data=d;window.__writes.push(['set',d]);return Promise.resolve();},update(p){window.__writes.push(['update',p]);merge(data,p);return Promise.resolve();}};
  window.__partner=p=>{merge(data,p);listeners.forEach(cb=>cb(snap()));};
  window.claude={use:name=>Promise.resolve(name==='db'?{doc:()=>ref}:{can:()=>Promise.resolve(true)})};
 },SEED);
 await page.clock.setFixedTime(new Date('2026-10-06T03:00:00Z'));
 await page.goto('/tests/sandbox.html');const app=page.frameLocator('#app');
 await expect(app.locator('.names')).toContainText('준호');await expect(app.locator('#status')).not.toHaveText('이 기기에만 저장돼요');
 await app.locator('#tab-price').click();
 const toggle=app.locator('[data-act="price-toggle"][data-id="hall-rent-1"]');
 await app.locator('#panel-price details[data-k="k13"] > summary').click();
 await app.locator('#panel-price details[data-k="pt-hall"] > summary').click();await toggle.click();
 await expect.poll(()=>app.locator('body').evaluate(()=>window.__writes.length)).toBeGreaterThan(0);
 const writes=await app.locator('body').evaluate(()=>window.__writes);
 const last=writes[writes.length-1];expect(last[0]).toBe('update');expect(last[1].pricePlan.groups.default.items['hall-rent-1']).toBe(true);expect(noArrays(last[1])).toBe(true);
 // The partner adds a guest on their phone; this screen follows.
 await app.locator('#tab-guest').click();await expect(app.locator('.gitem')).toHaveCount(2);
 await app.locator('body').evaluate(()=>window.__partner({guests:{g9:{name:'박서준',side:'groom',group:'직장',count:1}}}));
 await expect(app.locator('.gitem')).toHaveCount(3);await expect(app.locator('.gitem').filter({hasText:'박서준'})).toHaveCount(1);
});

test('legacy price data is read into the new plans and everything survives a reload',async({page})=>{
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await page.goto('/tests/sandbox.html');const app=page.frameLocator('#app');
 await expect(app.locator('#status')).toHaveText('이 기기에만 저장돼요');
 const put=async data=>{await app.locator('body').evaluate((_,d)=>localStorage.setItem('wedding-plan-v1',JSON.stringify(d)),data);await page.reload();await expect(app.locator('#status')).toHaveText('이 기기에만 저장돼요');};
 // First PR #4 shape: one implicit plan, rows marked include, an old per-row amount that is no longer shown.
 const first=structuredClone(SEED);first.pricePlan={'hall-rent-1':{include:true,amount:400}};await put(first);
 await app.locator('#tab-price').click();await expect(app.locator('.price-group-tab')).toHaveCount(1);
 // The old per-row "내 금액" comes back as this plan's own amount.
 await expect(app.locator('.price-group-tab[data-id="default"]')).toContainText('400만원');
 // Later PR #4 shape: plans keyed by table rows, including a superseded survey row and a regional row.
 const later=structuredClone(SEED);later.pricePlan={activeGroup:'default',groups:{default:{name:'기본안',items:{'hall-rent-1':true,'studio-basic-1':false,'studio-basic-2':true,'hall-meal-2':true}},pg1:{name:'옛 조합',items:{'package-2':true}}}};
 await put(later);await app.locator('#tab-price').click();
 await expect(app.locator('.price-group-tab[data-id="default"]')).toContainText('2,028만원 ~ 2,128만원');
 await expect(app.locator('.price-group-tab[data-id="pg1"]')).toContainText('319만원');
 await openSection(app,'pt-studio');await expect(pickRow(app,'studio-basic-1').locator('li.used .price-ref-name')).toContainText('(이전 조사)');
 await app.locator('[data-act="price-toggle"][data-id="studio-extra-1"]').click();
 await expect.poll(async()=>{const g=(await stored(app))?.pricePlan?.groups?.default;return g&&g.items['studio-basic-2']===false&&g.items['studio-basic-1']===true&&g.opts['studio-basic-1']==='studio-basic-2'&&g.items['hall-meal-2']===false&&g.opts['hall-meal-1']==='hall-meal-2';}).toBe(true);
 await app.locator('#tab-budget').click();await app.locator('details[data-k="pr-box"] > summary').click();
 await app.locator('#bPlanGroup').selectOption('default');await app.locator('[data-act="b-plan-apply"][data-id="studio-basic-1"]').click();
 await app.locator('details[data-k="pr-row-b05"] > summary').click();await app.locator('[data-fk="pr-plan-b05"]').fill('128');
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b05?.plan).toBe(128);
 await page.reload();await expect(app.locator('#status')).toHaveText('이 기기에만 저장돼요');
 await expect(app.locator('#tab-budget')).toHaveAttribute('aria-selected','true');
 await expect(app.locator('#bPlanGroup')).toHaveValue('default');
 // The review starts folded after a reload; its title line still names the plan and how many items are reflected.
 await expect(app.locator('details[data-k="pr-box"]')).toHaveJSProperty('open',false);
 await expect(app.locator('details[data-k="pr-box"] .lead')).toContainText('반영 1/');
 await app.locator('details[data-k="pr-box"] > summary').click();
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
 Object.assign(seed.pricePlan.groups.pa.items,{'x-bouquet':true,'x-bouquet-keep':true});Object.assign(seed.pricePlan.groups.pa.apply,{'x-bouquet':true,'x-bouquet-keep':true,u1:true});
 seed.pricePlan.groups.pa.amounts={'x-bouquet':35,'hall-rent-1':520};seed.pricePlan.groups.pa.custom={u1:{name:'축가 반주',budget:'b04',amount:20,created:1}};
 seed.budget.planGroup='pa';seed.budget.quotes={q1:{name:'지운 웨딩홀',deleted:true}};
 const {app,errors}=await openApp(page,seed);
 for(const tab of ['price','budget','dialog']){
  if(tab==='dialog'){await app.locator('#openShare').click();await app.locator('#backupCopy').click();await expect(app.locator('#backupText')).toBeVisible();}
  else{await app.locator('#tab-'+tab).click();await app.locator('#panel-'+tab+' details').evaluateAll(els=>els.forEach(e=>e.open=true));}
  const audit=await app.locator('body').evaluate(()=>{
   const visible=e=>!!e.getClientRects().length&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden';
   const controls=[...document.querySelectorAll('input,textarea,select')].filter(visible);const keys=controls.map(e=>e.dataset.fk);
   const inScroller=e=>{for(let n=e.parentElement;n;n=n.parentElement){if(['auto','scroll'].includes(getComputedStyle(n).overflowX))return true;}return false;};
   // Items inside a sideways-scrolling strip (the tab bar) are reachable by scrolling, so they are not cut off.
   const wide=[...document.querySelectorAll('body *')].filter(visible).filter(e=>!inScroller(e)).filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>innerWidth+0.5||r.left<-0.5);}).map(e=>e.className||e.tagName);
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
 await app.locator('#closeShare').click();
 await expect(app.locator('.pr-row')).toHaveCount(5);await expect(app.locator('details[data-k="trash-budget"] summary')).toHaveText('지운 예산 항목·견적 (1)');
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
 // A facts PR also passes CI by naming, in tests/content-change-allowed.txt, the main commit it was written against.
 // Once that PR is merged main moves on, so the allowance ends by itself.
 const allowFile='tests/content-change-allowed.txt',mainSha=execFileSync('git',['rev-parse','main'],{encoding:'utf8'}).trim();
 if (process.env.ALLOW_CONTENT_CHANGE === '1' || (fs.existsSync(allowFile) && fs.readFileSync(allowFile,'utf8').trim().split(/\s+/)[0] === mainSha)) return;
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
 await expect(row('b05').locator('.refline')).toContainText('스튜디오 전국 중간값 140만원(2026년 9월)');
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
 // The rent table also shows one 'latest official median' row for the region.
 await expect(app.locator('#panel-price .rtable:not(.ptable) tbody tr:not(.latest)')).toHaveCount(3);
 for (const row of await app.locator('#panel-price .rtable:not(.ptable) tbody tr:not(.latest)').all()) await expect(row.locator('th[scope="row"]')).toContainText('서울 강남');
 await app.locator('#tab-budget').click();
 await expect(app.locator('#bRegion')).toHaveValue('서울 강남');
 await app.locator('#panel-budget select[data-bregion]').selectOption('부산');
 await expect.poll(async()=> (await stored(app))?.budget.region).toBe('부산');
 await app.locator('#tab-price').click();
 await expect(app.locator('#priceRegion')).toHaveValue('부산');
 for (const row of await app.locator('#panel-price .rtable:not(.ptable) tbody tr:not(.latest)').all()) await expect(row.locator('th[scope="row"]')).toContainText('부산');
 await expect(section('pt-dress')).toHaveJSProperty('open',true);
 await app.locator('#tab-budget').click();
 await expect(row('b02').locator('.refline')).toContainText('부산 1인 식대 평균 4.7만원');
 await expect(app.locator('#panel-know details[data-k="k13"]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('ceremony decorations are inert, compact and respect motion preferences',async({page})=>{
 const {app}=await openApp(page);
 // The invitation card is folded once the date is set; unfold it to audit its decorations.
 await app.locator('[data-act="hero-toggle"]').click();await expect(app.locator('.invitation')).toBeVisible();
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

test('budget opens with four key numbers and folds the breakdown',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-budget').click();
 const glance=app.locator('.glance');
 // SEED: 350 + 187 × 62,000원 = 1,509.4만원, 100만원 paid, 30만원 in gifts, 5,000만원 total.
 await expect(glance.locator('.sum .k')).toHaveText(['예상 총액(확정 금액 우선)','총예산에서 남은 돈','앞으로 낼 돈','축의금 빼면 실제 부담']);
 await expect(glance.locator('.sum .v')).toHaveText(['1,509만원','3,491만원','1,409만원','1,479만원']);
 await expect(glance.locator('#bTotal')).toHaveValue('5000');
 const more=glance.locator('details[data-k="b-glance-more"]');
 await expect(more).not.toHaveAttribute('open','');await expect(more.locator('.who').first()).toBeHidden();
 await more.locator('summary').click();await expect(more.locator('.who').first()).toHaveText('항목별 총비용 합계 1,509만원낸 돈 100만원');
 // The fold stays open while typing a new total.
 await glance.locator('#bTotal').fill('4000');await expect(glance.locator('.sum .v').nth(1)).toHaveText('2,491만원');
 await expect(more).toHaveAttribute('open','');await expect(glance.locator('#bTotal')).toBeFocused();
 await expect(app.locator('[data-act="q-photo"]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('each quote says in one line how far it is from the regional average',async({page})=>{
 const seed=structuredClone(SEED);seed.budget.region='서울 강남';
 // 서울 강남 average: 대관료 710만원, 1인 식대 8.7만원.
 seed.budget.quotes={qa:{name:'봄날 웨딩홀',heads:200,unit:85000,hall:800,extra:40,created:1},qb:{name:'가을 웨딩홀',heads:200,unit:87000,hall:715,created:2},qc:{name:'식대만 받은 곳',unit:80000,created:3}};
 const {app,errors}=await openApp(page,seed);await app.locator('#tab-budget').click();
 const item=name=>app.locator('.qitem').filter({hasText:name});
 await expect(item('봄날').locator('.q-verdict')).toHaveText('서울 강남 평균보다 약 50만원 비싸요대관료 90만원 비쌈 · 1인 식대 2,000원 쌈(200명이면 40만원)');
 await expect(item('봄날').locator('.q-verdict b')).toHaveClass('up');
 await expect(item('가을').locator('.q-verdict')).toHaveText('서울 강남 평균과 비슷해요대관료 5만원 비쌈 · 1인 식대 평균과 같음');
 await expect(item('식대만').locator('.q-verdict')).toHaveText('서울 강남 평균과 비교1인 식대 7,000원 쌈');
 await expect(app.locator('.q-avg-note')).toContainText('서울 강남 대관료·1인 식대 평균');
 // 부산 average: 대관료 120만원, 1인 식대 4.7만원 → 680 + 3.8만원 × 200명 = 1,440만원.
 await app.locator('#bRegion').selectOption('부산');
 await expect(item('봄날').locator('.q-verdict b')).toHaveText('약 1,440만원 비싸요');
 expect(errors).toEqual([]);
});

test('a quote photo is read by Claude, checked, edited and saved without storing the picture',async({page})=>{
 await page.addInitScript(()=>{
  if(window.top===window)return;
  window.__photo=[];
  const sample=()=>Promise.reject({code:'invalid_request',message:'text calls are not used'});
  sample.limits=()=>Promise.resolve({maxPromptBytes:262144,images:{maxCount:2,maxInputBytes:20e6,mediaTypes:['image/jpeg','image/png']}});
  sample.json=(prompt,opts)=>{window.__photo.push({prompt,count:opts.images.length,signal:!!opts.signal});
   if(window.__photo.length>1)return Promise.reject({code:'not_granted',message:'declined'});
   // The answer waits until the test has checked the 'reading' state, so a slow machine cannot skip past it.
   return new Promise(r=>{window.__releasePhoto=()=>r({name:'봄날 웨딩홀',area:'서울 강남구',when:'2027-05-08 12:30',heads:'200',unit:65000,hall:3000000,extra:null,extras:[{name:'생화 장식',amount:300},{name:'본식 도우미',amount:30}],unsure:['unit'],note:'부가세 별도'});});};
  window.claude={use:name=>Promise.resolve(name==='sample'?sample:null)};
 });
 const {app,errors}=await openApp(page);await app.locator('#tab-budget').click();
 const btn=app.locator('[data-act="q-photo"]');await expect(btn).toHaveText('견적서 사진·PDF로 넣기');
 await expect(app.locator('#qPhotoFile')).toHaveAttribute('accept','image/jpeg,image/png,image/*,.heic,.heif,application/pdf,.pdf,text/plain,.txt');
 await expect(app.locator('#qPhotoFile')).toHaveAttribute('multiple','');
 const png={name:'quote.png',mimeType:'image/png',buffer:Buffer.from('89504e470d0a1a0a','hex')};
 await app.locator('#qPhotoFile').setInputFiles([png,png]);
 await expect(app.locator('[data-act="q-photo-stop"]')).toBeFocused();
 await expect(app.locator('.q-photo-msg')).toHaveText('Claude가 읽는 중이에요. 1분쯤 걸릴 수 있어요.');
 await app.locator('body').evaluate(()=>new Promise(r=>{const go=()=>window.__releasePhoto?(window.__releasePhoto(),r()):setTimeout(go,20);go();}));
 const draft=app.locator('.q-photo-draft');await expect(draft).toBeVisible();
 const call=(await app.locator('body').evaluate(()=>window.__photo))[0];
 expect(call.count).toBe(2);expect(call.signal).toBe(true);expect(call.prompt).toContain('JSON');
 await expect(app.locator('[data-fk="qph-name"]')).toBeFocused();
 const val=k=>app.locator(`[data-fk="qph-${k}"]`);
 await expect(val('name')).toHaveValue('봄날 웨딩홀');await expect(val('area')).toHaveValue('서울 강남구');await expect(val('heads')).toHaveValue('200');
 await expect(val('unit')).toHaveValue('65000');await expect(val('hall')).toHaveValue('300');await expect(val('extra')).toHaveValue('330');
 // Unclear or unit-corrected values are marked for a second look, also for screen readers.
 await expect(app.getByRole('textbox',{name:'1인 식대(원) 확인 필요'})).toHaveCount(1);
 await expect(app.getByRole('textbox',{name:'대관료(만원) 확인 필요'})).toHaveCount(1);
 await expect(draft).toContainText('추가 비용으로 읽은 항목: 생화 장식 300만원 · 본식 도우미 30만원');
 expect((await stored(app)).budget.quotes).toBeUndefined();
 await val('unit').fill('66,000');await expect(val('unit')).toHaveValue('66000');
 await app.locator('[data-act="q-photo-save"]').click();
 await expect.poll(async()=>Object.values((await stored(app)).budget.quotes||{}).length).toBe(1);
 const q=Object.values((await stored(app)).budget.quotes)[0];
 expect(q).toMatchObject({name:'봄날 웨딩홀',area:'서울 강남구',when:'2027-05-08 12:30',heads:200,unit:66000,hall:300,extra:330,memo:'사진에서 읽은 추가 비용: 생화 장식 300만원, 본식 도우미 30만원\n알아둘 점: 부가세 별도'});
 expect(JSON.stringify(q)).not.toContain('png');
 await expect(app.locator('.q-photo-msg')).toHaveText('견적을 저장했어요. 아래 목록에서 확인하세요.');
 await expect(app.locator('[data-act="q-open"]').filter({hasText:'봄날 웨딩홀'})).toBeFocused();
 await expect(app.locator('[data-act="q-open"]').filter({hasText:'봄날 웨딩홀'})).toContainText('서울 강남구');
 await expect(app.locator('[data-fk^="q-unit-"]')).toHaveValue('66000');
 // Declining Claude hides the photo button for this view and points to typing.
 await app.locator('#qPhotoFile').setInputFiles(png);
 await expect(app.locator('.q-photo-msg')).toHaveText('이 화면에서는 견적서 읽기를 쓸 수 없어요. 아래에 직접 넣어 주세요.');
 await expect(btn).toHaveCount(0);await expect(app.locator('#qName')).toBeFocused();
 expect(noArrays(await stored(app))).toBe(true);expect(errors).toEqual([]);
});

test('tabs sit in two rows of four with nothing to slide; empty budget groups start folded',async({page})=>{
 const {app,errors}=await openApp(page);
 expect(await app.locator('.tabs [role=tablist]').evaluate(w=>w.scrollWidth<=w.clientWidth)).toBe(true);
 expect(await app.locator('.tab').evaluateAll(els=>els.map(e=>e.textContent.trim()))).toEqual(['진행 순서','달력','예산','가격 비교','하객','신혼여행','알아둘 것','둘이 정할 것']);
 const rowOf=id=>app.locator('#'+id).evaluate(e=>Math.round(e.getBoundingClientRect().top));
 expect(await rowOf('tab-price')).toBe(await rowOf('tab-timeline'));expect(await rowOf('tab-guest')).toBeGreaterThan(await rowOf('tab-timeline'));expect(await rowOf('tab-talk')).toBe(await rowOf('tab-guest'));
 const tabs=await app.locator('.tab').evaluateAll(els=>els.map(e=>({h:e.getBoundingClientRect().height,lines:Math.round(e.getBoundingClientRect().height/parseFloat(getComputedStyle(e).lineHeight))})));
 expect(tabs.every(t=>t.h>=44&&t.h<=52)).toBe(true);
 const inView=id=>app.locator('.tabs [role=tablist]').evaluate((w,id)=>{const a=document.getElementById(id).getBoundingClientRect(),r=w.getBoundingClientRect();return a.left>=r.left-1&&a.right<=r.right+1;},id);
 await app.locator('#tab-talk').click();expect(await inView('tab-talk')).toBe(true);
 await app.locator('#tab-timeline').click();expect(await inView('tab-timeline')).toBe(true);
 await app.locator('#tab-budget').click();
 // SEED has amounts only under 예식.
 await expect(app.locator('details[data-k="bcat-wed"]')).toHaveJSProperty('open',true);
 await expect(app.locator('details[data-k="bcat-wed"] > summary .meta')).toHaveText('1,509만원5개 중 2개 입력');
 await expect(app.locator('details[data-k="bcat-sdm"]')).toHaveJSProperty('open',false);
 await expect(app.locator('details[data-k="bcat-sdm"] > summary .meta')).toHaveText('입력 전4개 중 0개 입력');
 await expect(app.locator('details[data-k="pr-box"]')).toHaveJSProperty('open',false);
 await app.locator('details[data-k="bcat-sdm"] > summary').click();
 await app.locator('[data-act="b-open"][data-id="b06"]').click();
 const dress=app.locator('[data-fk="b-total-b06"]');await dress.fill('180');
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b06?.plan).toBe(180);
 await expect(app.locator('details[data-k="bcat-sdm"]')).toHaveJSProperty('open',true);await expect(dress).toBeFocused();
 expect(errors).toEqual([]);
});

test('quote PDFs, other picture formats, text files and pasted text are read as well',async({page})=>{
 // pdf.js is loaded from jsDelivr only when a PDF is picked; the test serves a stand-in that draws each page.
 const base='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
 await page.route(base+'pdf.worker.min.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:'window.pdfjsWorker={WorkerMessageHandler:{}};'}));
 await page.route(base+'pdf.min.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:"window.pdfjsLib={GlobalWorkerOptions:{},getDocument:function(o){window.__pdfOpts=o;var locked=o.data[0]===88;return{promise:locked?Promise.reject({name:'PasswordException'}):Promise.resolve({numPages:3,getPage:function(n){return Promise.resolve({getViewport:function(v){return{width:600*v.scale,height:800*v.scale};},render:function(r){r.canvasContext.fillStyle='#000';r.canvasContext.fillRect(10,10,50,50);return{promise:Promise.resolve()};}});}})};}};"}));
 await page.addInitScript(()=>{
  if(window.top===window)return;
  window.__photo=[];
  const sample=()=>Promise.reject({code:'invalid_request'});
  sample.limits=()=>Promise.resolve({images:{maxCount:2,maxInputBytes:20e6,mediaTypes:['image/jpeg','image/png']}});
  sample.json=(prompt,opts)=>{window.__photo.push({prompt,count:opts.images?opts.images.length:0,types:opts.images?[...opts.images].map(b=>b.type):[]});
   return Promise.resolve({name:'가을 웨딩홀',area:'경기 수원시',heads:200,unit:65000,hall:300,extras:[],unsure:[]});};
  window.claude={use:name=>Promise.resolve(name==='sample'?sample:null)};
 });
 const {app,errors}=await openApp(page);await app.locator('#tab-budget').click();
 const calls=()=>app.locator('body').evaluate(()=>window.__photo);
 const file=(name,mimeType,buffer)=>({name,mimeType,buffer:Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer)});
 // An unreadable HEIC is skipped, a 3-page PDF fills the two picture slots, and a text file goes along as text.
 await app.locator('#qPhotoFile').setInputFiles([file('photo.heic','image/heic','not a picture'),file('quote.pdf','application/pdf','%PDF-1.4'),file('memo.txt','text/plain','꽃장식 300만원 포함')]);
 const draft=app.locator('.q-photo-draft');await expect(draft).toBeVisible();
 let c=(await calls())[0];expect(c.count).toBe(2);expect(c.types).toEqual(['image/jpeg','image/jpeg']);expect(c.prompt).toContain('꽃장식 300만원 포함');expect(c.prompt).toContain('PDF');
 expect(await app.locator('body').evaluate(()=>({eval:window.__pdfOpts.isEvalSupported,cmap:window.__pdfOpts.cMapUrl}))).toEqual({eval:false,cmap:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/'});
 await expect(draft).toContainText('그림은 한 번에 2장까지라 나머지 1장은 읽지 않았어요. 읽을 수 없는 파일은 뺐어요: photo.heic.');
 await expect(app.locator('[data-fk="qph-area"]')).toHaveValue('경기 수원시');
 await app.locator('[data-act="q-photo-cancel"]').click();
 // A picture type Claude does not take directly (BMP) is turned into JPEG first.
 const bmp=Buffer.from('424D3A0000000000000036000000280000000100000001000000010018000000000004000000130B0000130B00000000000000000000FFFFFF00','hex');
 await app.locator('#qPhotoFile').setInputFiles(file('scan.bmp','image/bmp',bmp));await expect(draft).toBeVisible();
 c=(await calls())[1];expect(c.count).toBe(1);expect(c.types).toEqual(['image/jpeg']);
 await app.locator('[data-act="q-photo-cancel"]').click();
 // Text from a message is pasted and read without any picture.
 await app.locator('details[data-k="q-paste"] > summary').click();
 await app.locator('[data-fk="q-photo-text"]').fill('대관료 300만원, 식대 6만5천원, 보증 200명');
 await app.locator('[data-act="q-photo-text"]').click();await expect(draft).toBeVisible();
 c=(await calls())[2];expect(c.count).toBe(0);expect(c.prompt).toContain('아래 글은');expect(c.prompt).toContain('대관료 300만원, 식대 6만5천원, 보증 200명');
 await app.locator('[data-act="q-photo-save"]').click();
 await expect.poll(async()=>Object.values((await stored(app)).budget.quotes||{}).length).toBe(1);
 expect(Object.values((await stored(app)).budget.quotes)[0]).toMatchObject({name:'가을 웨딩홀',area:'경기 수원시',heads:200,unit:65000,hall:300});
 await expect(app.locator('[data-fk="q-photo-text"]')).toHaveValue('');
 // A locked PDF and a file nobody can read get a clear next step instead of a silent failure.
 await app.locator('#qPhotoFile').setInputFiles(file('locked.pdf','application/pdf','X-locked'));
 await expect(app.locator('.q-photo-msg')).toHaveText('비밀번호가 걸린 PDF는 열 수 없어요. 화면을 캡처해서 사진으로 넣어 주세요.');
 await app.locator('#qPhotoFile').setInputFiles(file('계약서.hwp','application/x-hwp','HWP'));
 await expect(app.locator('.q-photo-msg')).toHaveText('읽을 수 있는 파일이 없어요(계약서.hwp). 사진(JPG·PNG·HEIC 등), PDF, 글 파일을 골라 주세요. 한글·워드 문서는 PDF로 저장하거나 화면을 캡처해 넣어 주세요.');
 expect((await calls()).length).toBe(3);expect(noArrays(await stored(app))).toBe(true);expect(errors).toEqual([]);
});

test('each budget item is a total cost split into a deposit and a balance with their dates',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-budget').click();
 // SEED b01: 350만원 with 100만원 already paid; the old paid amount reads as the deposit.
 await app.locator('[data-act="b-open"][data-id="b01"]').click();
 await expect(app.locator('[data-fk="b-total-b01"]')).toHaveValue('350');
 await expect(app.locator('[data-fk="b-deposit-b01"]')).toHaveValue('100');
 const item=id=>app.locator(`[data-act="b-open"][data-id="${id}"]`).locator('xpath=ancestor::li[1]');
 await expect(item('b01').locator('.bpay .calcval')).toHaveText('250만원');
 await expect(app.locator('[data-fk="b-actual-b01"],[data-fk="b-paid-b01"],[data-fk="b-plan-b01"]')).toHaveCount(0);
 // A new item: write the total first, then the deposit and both dates.
 await app.locator('details[data-k="bcat-sdm"] > summary').click();await app.locator('[data-act="b-open"][data-id="b06"]').click();
 await app.locator('[data-fk="b-total-b06"]').fill('200');await app.locator('[data-fk="b-deposit-b06"]').fill('50');
 await app.locator('[data-fk="b-depositDate-b06"]').fill('2026-11-01');await app.locator('[data-fk="b-balanceDate-b06"]').fill('2027-04-01');
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b06).toEqual({plan:200,deposit:50,depositDate:'2026-11-01',balanceDate:'2027-04-01'});
 await expect(item('b06').locator('.bpay .calcval')).toHaveText('150만원');
 await expect(item('b06').locator('.bamt')).toHaveText('200만원잔금 150만원 · 2027.4.1(목)');
 // Paid so far = deposits; still to pay = the rest. 1,509 + 200 = 1,709; 100 + 50 paid.
 await expect(app.locator('.glance .sum .v').first()).toHaveText('1,709만원');
 await expect(app.locator('.glance .sum .v').nth(2)).toHaveText('1,559만원');
 await item('b06').locator('[data-act="b-balance-paid"]').click();
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b06?.balancePaid).toBe(true);
 await expect(item('b06').locator('.bamt small')).toHaveText('다 냈어요');
 await expect(app.locator('.glance .sum .v').nth(2)).toHaveText('1,409만원');
 expect(noArrays(await stored(app))).toBe(true);expect(errors).toEqual([]);
});

test('clearing a migrated total or deposit keeps the same field and stays cleared',async({page})=>{
 const seed=structuredClone(SEED);seed.budget.items.b05={plan:140,actual:145,paid:50};
 const {app,errors}=await openApp(page,seed);await app.locator('#tab-budget').click();
 await app.locator('[data-act="b-open"][data-id="b05"]').click();
 const total=app.locator('[data-fk="b-total-b05"]'),dep=app.locator('[data-fk="b-deposit-b05"]');
 await expect(total).toHaveValue('145');await expect(dep).toHaveValue('50');
 // Clear the old confirmed amount and type a new total in the same field.
 await total.fill('');await expect(total).toBeFocused();await expect(total).toHaveValue('');
 await total.pressSequentially('160');await expect(total).toHaveValue('160');await expect(total).toBeFocused();
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b05).toMatchObject({plan:160,actual:'',paid:50});
 // Clearing the deposit does not bring back the old paid amount.
 await dep.fill('');await expect(dep).toHaveValue('');await expect(dep).toBeFocused();
 await dep.pressSequentially('30');await expect(dep).toHaveValue('30');
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b05?.deposit).toBe(30);
 await expect(app.locator('[data-act="b-open"][data-id="b05"]').locator('xpath=ancestor::li[1]').locator('.bpay .calcval')).toHaveText('130만원');
 expect(errors).toEqual([]);
});

test('price tab names hall+SDM costs for what they are, uses checked regional figures and marks value kinds',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-price').click();
 await expect(app.locator('#pt-total')).toHaveText('예식장+스드메 비용');
 await expect(app.locator('#panel-price')).not.toContainText('전체 비용 (예식장+스드메)');
 await openSection(app,'pt-total');
 await expect(app.locator('details[data-k="pt-total"]')).toContainText('예물·예단·혼수·신혼여행·신혼집은 빠진 금액이에요');
 // Median, average and statistics each get their own marker.
 await expect(app.locator('#panel-price .kchip.mid').first()).toHaveText('중간값');
 await expect(app.locator('#panel-price .kchip.avg').first()).toHaveText('평균');
 await expect(app.locator('#panel-price .rcap.cap-extra').first()).toContainText('추가금');
 // Seoul outside Gangnam picks its own studio and dress figures (2025년 4월 조사).
 await app.locator('#priceRegion').selectOption('서울(강남 외)');
 await openSection(app,'pt-studio');await openSection(app,'pt-dress');
 const pick=id=>app.locator('tr.price-pick').filter({has:app.locator(`[data-act="price-toggle"][data-id="${id}"]`)});
 await app.locator('[data-act="price-toggle"][data-id="studio-basic-1"]').click();
 await expect(pick('studio-basic-1').locator('li.used strong')).toHaveText('129만원');
 await app.locator('[data-act="price-toggle"][data-id="dress-basic-1"]').click();
 await expect(pick('dress-basic-1').locator('li.used strong')).toHaveText('서울(강남 외) 110만원');
 await expect(app.locator('#panel-price .region-note').first()).toContainText('강원(스튜디오)·대전(드레스)');
 expect(errors).toEqual([]);
});

test('upcoming balances are gathered by date in the budget, the timeline and the shared summary',async({page})=>{
 const seed=structuredClone(SEED);
 // 2026-10-06: studio balance was due 9/30, dress balance is due 10/20, makeup has no balance date.
 Object.assign(seed.budget.items,{b05:{plan:150,deposit:30,balanceDate:'2026-09-30'},b06:{plan:200,deposit:50,balanceDate:'2026-10-20'},b07:{plan:80,deposit:20}});
 const {app,errors}=await openApp(page,seed);
 await expect(app.locator('.due-note')).toHaveText('지난 잔금 1건 포함, 30일 안에 낼 잔금 2건: 9.30(수) 스튜디오 촬영 120만원 외 1건 예산에서 보기');
 await app.locator('.due-note [data-act="b-go"]').click();
 await expect(app.locator('#tab-budget')).toHaveAttribute('aria-selected','true');
 await expect(app.locator('[data-act="b-open"][data-id="b05"]')).toHaveAttribute('aria-expanded','true');
 const items=app.locator('.glance .due-list li');
 await expect(items).toHaveCount(2);
 await expect(items.nth(0)).toHaveClass('late');await expect(items.nth(0)).toHaveText('9.30(수)6일 지남스튜디오 촬영120만원');
 await expect(items.nth(1)).toHaveText('10.20(화)14일 남음드레스150만원');
 // b01 (old paid amount) and b07 have a balance but no date yet.
 await expect(app.locator('.glance .due-list .tip')).toHaveText('잔금일을 안 넣은 항목 2개는 날짜를 넣으면 여기에 모여요.');
 await items.nth(1).locator('button').click();await expect(app.locator('[data-act="b-open"][data-id="b06"]')).toHaveAttribute('aria-expanded','true');
 await app.locator('[data-act="b-open"][data-id="b06"]').locator('xpath=ancestor::li[1]').locator('[data-act="b-balance-paid"]').click();
 await expect(items).toHaveCount(1);
 await app.locator('#openShare').click();
 await expect(app.locator('#shareText')).toHaveValue(/다가오는 잔금: 9\.30\(수\) 스튜디오 촬영 120만원/);
 expect(errors).toEqual([]);
});

test('inside claude.ai the backup file is saved through the app download prompt',async({page})=>{
 await page.addInitScript(()=>{
  if(window.top===window)return;
  window.__saved=[];
  const downloads={save:r=>{window.__saved.push(r);return window.__saved.length>1?Promise.reject({code:'declined'}):Promise.resolve({});}};
  window.claude={use:name=>Promise.resolve(name==='downloads'?downloads:null)};
 });
 const {app,errors}=await openApp(page);
 await app.locator('#openShare').click();await app.locator('#backupSave').scrollIntoViewIfNeeded();
 await app.locator('#backupSave').click();
 await expect(app.locator('#shareMsg')).toHaveText('백업 파일을 저장했어요.');
 const saved=await app.locator('body').evaluate(async()=>{const r=window.__saved[0];return {name:r.filename,body:JSON.parse(await r.data.text())};});
 expect(saved.name).toBe('marry-me-backup-2026-10-06.json');expect(saved.body.app).toBe('marry-me');expect(saved.body.data.groom).toBe('준호');
 await app.locator('#backupSave').click();
 await expect(app.locator('#shareMsg')).toHaveText('저장을 취소했어요.');
 expect(errors).toEqual([]);
});

test('regional hall rent shows the latest official median next to the survey range',async({page})=>{
 const seed=structuredClone(SEED);seed.budget.region='서울 강남';
 const {app,errors}=await openApp(page,seed);await app.locator('#tab-price').click();await openSection(app,'pt-hall');
 const latest=app.locator('#pt-hall').locator('xpath=ancestor::details[1]').locator('tr.latest');
 await expect(latest).toHaveCount(1);await expect(latest).toContainText('최신 2026년 9월');await expect(latest.locator('td')).toHaveText('750');
 // 광주 has no exact match in the new regions, so no latest row is shown.
 await app.locator('#priceRegion').selectOption('광주');await expect(latest).toHaveCount(0);
 await expect(app.locator('#panel-price')).toContainText('256만원');
 expect(errors).toEqual([]);
});

test('wedding shoot checklist follows the shoot date and saves each item apart from completion',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-timeline').click();
 await app.locator('[data-act="open"][data-id="t16"]').click();
 await expect(app.locator('[data-act="chk"][data-id="t16"]')).toHaveCount(0);
 await app.locator('[data-act="open"][data-id="t17"]').click();
 const box=app.locator('details.shootcl[data-k="cl-t17"]');
 await expect(box).not.toHaveAttribute('open','');
 await expect(app.locator('[data-act="chk"][data-id="t17"]')).toHaveCount(32);
 await box.locator('summary').click();
 // 2027-05-08 wedding → shoot D-120 = 2027-01-08; the first group is two weeks earlier.
 await expect(box.locator('.cl-group h5').first()).toContainText('12.25(금)까지');
 await expect(box.locator('.cl-group h5').last()).toContainText('2027.1.8(금)');
 const w01=app.locator('[data-act="chk"][data-c="w01"]');
 await w01.click();
 await expect(w01).toHaveAttribute('aria-checked','true');
 await expect.poll(async()=> (await stored(app))?.tasks?.t17?.checks?.w01).toBe(true);
 await expect(box.locator('.cl-count')).toHaveText('1 / 32');
 await w01.click();
 await expect.poll(async()=> (await stored(app))?.tasks?.t17?.checks?.w01).toBe(false);
 await app.locator('[data-act="chk"][data-c="w32"]').click();
 await expect.poll(async()=> (await stored(app))?.tasks?.t17?.checks?.w32).toBe(true);
 let st=await stored(app);expect(st.tasks.t17.done).toBeFalsy();expect(st.tasks.ts17a).toBeUndefined();
 await app.locator('[data-act="open"][data-id="t17"]').click();
 const row=app.locator('.task').filter({has:app.locator('[data-act="open"][data-id="t17"]')});
 await expect(row.locator('.tdates')).toContainText('준비물 1 / 32');
 await app.locator('[data-act="open"][data-id="t17"]').click();
 await expect(app.locator('details.shootcl[data-k="cl-t17"]')).toHaveAttribute('open','');
 await app.locator('[data-act="toggle"][data-id="t17"]').click();
 await expect.poll(async()=> (await stored(app))?.tasks?.t17?.done).toBe(true);
 st=await stored(app);expect(st.tasks.t17.checks.w32).toBe(true);expect(noArrays(st)).toBe(true);expect(errors).toEqual([]);
});

test('open rows stand out in colour, show an arrow, and close from the bottom or by tapping the amount',async({page})=>{
 const {app,errors}=await openApp(page);
 const bgOf=l=>l.evaluate(e=>getComputedStyle(e).backgroundColor);
 await app.locator('#tab-budget').click();
 const title=app.locator('[data-act="b-open"][data-id="b01"]'),li=app.locator('li.bitem').filter({has:title});
 // Every row that opens carries an arrow.
 expect(await app.locator('#panel-budget .t-title[aria-expanded]').count()).toBe(await app.locator('#panel-budget .row > .chev').count());
 // Tapping the amount on the right opens the row as well.
 await li.locator('.bamt').click();
 await expect(title).toHaveAttribute('aria-expanded','true');await expect(li).toHaveClass(/is-open/);
 await expect(li.locator('.fhead')).toHaveText(['금액과 날짜','세부 내역','그 밖']);
 const head=await bgOf(li.locator('.row')),body=await bgOf(li.locator('.detail')),closed=await bgOf(app.locator('li.bitem:not(.is-open)').first());
 expect(head).not.toBe(closed);expect(body).not.toBe(closed);expect(head).not.toBe(body);
 expect((await li.locator('.detail').evaluate(e=>getComputedStyle(e).borderLeftWidth))).toBe('4px');
 // Typing still works inside the tinted box, and the bottom button folds the row and returns focus to it.
 await li.locator('[data-fk="b-total-b01"]').fill('360');await expect(li.locator('.bamt')).toContainText('360만원');
 const close=li.locator('[data-act="close-row"]');expect((await close.boundingBox()).height).toBeGreaterThanOrEqual(44);
 await close.click();
 await expect(title).toHaveAttribute('aria-expanded','false');await expect(li).not.toHaveClass(/is-open/);await expect(title).toBeFocused();
 await expect(app.locator('[data-act="close-row"]')).toHaveCount(0);
 await expect.poll(async()=> (await stored(app))?.budget?.items?.b01?.plan).toBe(360);
 // The same card and close button on the other tabs.
 for(const [tab,act] of [['timeline','open'],['guest','g-open'],['talk','talk-open']]){
  await app.locator('#tab-'+tab).click();
  const t=app.locator(`#panel-${tab} [data-act="${act}"]`).first(),id=await t.getAttribute('data-id');
  const row=app.locator(`#panel-${tab} li`).filter({has:app.locator(`[data-act="${act}"][data-id="${id}"]`)});
  await t.click();await expect(row).toHaveClass(/is-open/);await expect(t).toHaveAttribute('aria-expanded','true');
  await row.locator('[data-act="close-row"]').click();
  await expect(t).toHaveAttribute('aria-expanded','false');await expect(app.locator(`#panel-${tab} .is-open`)).toHaveCount(0);
 }
 expect(errors).toEqual([]);
});

test('know tab separates the law in force from the 2027 plan, shows the newlywed loan change and per-card check dates',async({page})=>{
 const {app,errors}=await openApp(page);
 // First screen: a wedding after the 2026 deadline gets a one-line notice; opening it shows the full wording, as not yet decided.
 const notice=app.locator('#hero .notice');
 await expect(notice.locator('summary')).toContainText('2026년 12월 31일');await expect(notice.locator('summary')).toContainText('2027년부터는 확정 전');
 await notice.locator('summary').click();
 await expect(notice.locator('p')).toBeVisible();
 await expect(notice.locator('p')).toContainText('현금 지원(부부 100만원)');await expect(notice.locator('p')).toContainText('아직 확정되지 않았어요');
 await app.locator('#tab-know').click();
 const cardOf=k=>app.locator(`#panel-know details[data-k="${k}"]`);
 await cardOf('k3').locator('summary').click();
 await expect(cardOf('k3')).toContainText('2024년 1월 1일 ~ 2026년 12월 31일');
 await expect(cardOf('k3')).toContainText('혼인지원금');await expect(cardOf('k3')).toContainText('확정 전');
 await expect(cardOf('k3')).toContainText('지급 시기와 신청 방법은 아직 정해지지 않았어요');
 await expect(cardOf('k3').locator('.checked')).toHaveText('2026년 11월 16일에 다시 확인했어요.');
 await cardOf('k3').locator('[data-fk="reg-tax"]').fill('2027-03-01');
 await expect(cardOf('k3').locator('.calc')).toContainText('아직 확정 전이에요');
 await cardOf('k8').locator('summary').click();
 await expect(cardOf('k8')).toContainText('2026년 10월 19일부터');
 await expect(cardOf('k8')).toContainText('신청인 6,000만원 이하');await expect(cardOf('k8')).toContainText('신청인 5,000만원 이하');
 await expect(cardOf('k8')).toContainText('보금자리론은 신청인 7,000만원 이하');
 await expect(cardOf('k8').locator('.checked')).toHaveCount(1);
 // Cards that were not rechecked keep following the date at the top.
 await expect(cardOf('k2').locator('.checked')).toHaveCount(0);await expect(cardOf('k6').locator('.checked')).toHaveCount(0);
 await expect(app.locator('#panel-know .basis')).toContainText('2026년 10월 6일 기준');
 expect(errors).toEqual([]);
});

test('first screen folds to a slim D-day bar once the date is set, and unfolds to the invitation card',async({page})=>{
 const {app,errors}=await openApp(page);
 const bar=app.locator('.hero-bar');
 await expect(bar).toBeVisible();await expect(bar).toHaveAttribute('aria-expanded','false');
 await expect(app.locator('.invitation')).toHaveCount(0);
 await expect(bar.locator('.names')).toContainText('준호');await expect(bar.locator('.names')).toContainText('민지');
 await expect(bar.locator('.when')).toHaveText('2027년 5월 8일 토요일 오후 12시 30분');
 await expect(bar.locator('.hero-dday')).toHaveText('D-214');
 // A screen reader hears what is shown on the bar (names, date, D-day) and what pressing it does.
 await expect(bar).toHaveAccessibleName(/준호.*민지.*2027년 5월 8일 토요일 오후 12시 30분.*결혼식까지.*D-214.*청첩장 카드 펼치기/);
 await expect(app.locator('#hero .stats')).toContainText('132개 중 9개 완료');
 await expect(app.locator('#hero .notice')).toBeVisible();
 // The tabs and the start of the list now sit on the first screen (they were a full screen down).
 const tabsTop=await app.locator('.tabs').evaluate(e=>e.getBoundingClientRect().top);
 expect(tabsTop).toBeLessThan(page.viewportSize().height/2);
 await expect(app.locator('#panel-timeline .phase-head').first()).toBeInViewport();
 // Unfold: the invitation card comes back with a fold button, and the choice is remembered on this device.
 await bar.click();
 await expect(app.locator('.invitation')).toBeVisible();await expect(app.locator('.dday')).toHaveText('D-214');
 const fold=app.locator('.hero-fold');await expect(fold).toHaveAttribute('aria-expanded','true');await expect(fold).toBeFocused();
 expect(await app.locator('body').evaluate(()=>localStorage.getItem('wd-hero'))).toBe('1');
 await fold.click();
 await expect(app.locator('.invitation')).toHaveCount(0);await expect(bar).toBeFocused();
 expect(await app.locator('body').evaluate(()=>localStorage.getItem('wd-hero'))).toBe('0');
 expect(errors).toEqual([]);
});

test('the invitation card stays open on the visit where the date is first set',async({page})=>{
 const {app,errors}=await openApp(page,null);
 await expect(app.locator('.invitation #heroDate')).toBeVisible();await expect(app.locator('.hero-bar')).toHaveCount(0);
 await app.locator('#heroDate').fill('2027-05-08');await app.locator('[data-act="hero-save"]').click();
 await expect(app.locator('.invitation .dday')).toHaveText('D-214');await expect(app.locator('.hero-fold')).toBeVisible();
 expect(errors).toEqual([]);
});

test('the pressed control stays where it was when a tick redraws the page or a section is closed',async({page})=>{
 const {app,errors}=await openApp(page);
 const topOf=sel=>app.locator(sel).first().evaluate(e=>e.getBoundingClientRect().top);
 // A real tap at the control's current place, without Playwright scrolling it first.
 const tapAt=async(sel,block)=>{const loc=app.locator(sel).first();await loc.evaluate((e,b)=>e.scrollIntoView({block:b}),block||'center');
  const before=await topOf(sel),box=await loc.boundingBox();await page.mouse.click(box.x+Math.min(box.width/2,40),box.y+box.height/2);
  await app.locator('body').evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));return before;};
 await app.locator('#tab-price').click();
 await app.locator('#panel-price details[data-k="k14"] > summary').click();await app.locator('#panel-price details[data-k="px-flower"] > summary').click();
 // Ticking the first item adds a "담긴 항목 보기" box above it; the tick box must not slide from under the finger.
 const tick='[data-act="price-toggle"][data-id="x-bouquet"]';
 let before=await tapAt(tick);
 await expect(app.locator(tick)).toHaveAttribute('aria-checked','true');await expect(app.locator('details.price-picked-details')).toHaveCount(1);
 expect(Math.abs(await topOf(tick)-before)).toBeLessThanOrEqual(1);
 before=await tapAt(tick);await expect(app.locator(tick)).toHaveAttribute('aria-checked','false');
 expect(Math.abs(await topOf(tick)-before)).toBeLessThanOrEqual(1);
 // Closing a tall section makes the page shorter than the scroll position; the header that was tapped must stay put.
 const head='#panel-price details[data-k="k14"] > summary';
 await app.locator('#panel-price details[data-k="px-thanks"] > summary').click();
 await app.locator('[data-act="price-toggle"][data-id="x-song"]').evaluate(e=>e.scrollIntoView({block:'end'}));
 const headTop=await topOf(head),y0=await app.locator('body').evaluate(()=>scrollY);
 if(headTop>60&&headTop<page.viewportSize().height-60){   // the header is on screen: tap it where it is
  const box=await app.locator(head).boundingBox();await page.mouse.click(box.x+40,box.y+box.height/2);
  await app.locator('body').evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  expect(Math.abs(await topOf(head)-headTop)).toBeLessThanOrEqual(1);
 } else { before=await tapAt(head,'start');expect(Math.abs(await topOf(head)-before)).toBeLessThanOrEqual(1); }
 await expect(app.locator('#panel-price details[data-k="k14"]')).not.toHaveAttribute('open','');
 // The spare room added at the end goes away again once the page is scrolled back up.
 await app.locator('body').evaluate(()=>{window.scrollTo(0,0);return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 await expect.poll(()=>app.locator('#endSpace').evaluate(e=>e.getBoundingClientRect().height)).toBe(0);
 // Closing an opened row at the end of a list keeps the row title in place as well.
 await app.locator('#tab-talk').click();
 const last=app.locator('#panel-talk [data-act="talk-open"]').last(),lastSel='#panel-talk li:last-child [data-act="talk-open"]';
 await last.click();await last.evaluate(e=>e.scrollIntoView({block:'start'}));
 const rowTop=await last.evaluate(e=>e.getBoundingClientRect().top),rb=await last.boundingBox();
 await page.mouse.click(rb.x+30,rb.y+rb.height/2);
 await app.locator('body').evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await expect(last).toHaveAttribute('aria-expanded','false');
 expect(Math.abs(await last.evaluate(e=>e.getBoundingClientRect().top)-rowTop)).toBeLessThanOrEqual(1);
 // Look-alike buttons (the twelve honeymoon months) are told apart, so choosing one in a lower row does not scroll the page.
 await app.locator('#tab-honey').click();
 const dec=app.locator('#panel-honey [data-act="month"][data-m="12"]');await dec.evaluate(e=>e.scrollIntoView({block:'center'}));
 const decTop=await dec.evaluate(e=>e.getBoundingClientRect().top),janTop=await app.locator('#panel-honey [data-act="month"][data-m="1"]').evaluate(e=>e.getBoundingClientRect().top),db=await dec.boundingBox();
 expect(decTop).toBeGreaterThan(janTop);
 await page.mouse.click(db.x+db.width/2,db.y+db.height/2);
 await app.locator('body').evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await expect(dec).toHaveAttribute('aria-pressed','true');
 expect(Math.abs(await dec.evaluate(e=>e.getBoundingClientRect().top)-decTop)).toBeLessThanOrEqual(1);
 // The save-status line keeps its height on phones, so "저장됨" coming and going does not move the page.
 const barH=()=>app.locator('.bar').evaluate(e=>e.getBoundingClientRect().height);
 const withText=await barH();await app.locator('#status').evaluate(e=>{e.textContent='';});
 expect(await barH()).toBe(withText);
 expect(errors).toEqual([]);
});

test('budget items take dated detail lines whose sum becomes the total; invitation gatherings have their own item',async({page})=>{
 const {app,errors}=await openApp(page);
 await app.locator('#tab-budget').click();
 await app.locator('details[data-k="bcat-card"] > summary').click();
 const title=app.locator('[data-act="b-open"][data-id="b28"]');await expect(title).toHaveText('청첩장 모임');
 await title.click();
 const li=app.locator('li.bitem').filter({has:app.locator('[data-act="b-open"][data-id="b28"]')});
 await expect(li.locator('.fhead')).toHaveText(['금액과 날짜','세부 내역','그 밖']);
 await expect(li.locator('[data-fk="b-total-b28"]')).toBeVisible();
 // Add three gatherings: with Enter, with the button, and one that has no amount yet.
 const name=li.locator('[data-bl="name"]'),date=li.locator('[data-bl="date"]'),amount=li.locator('[data-bl="amount"]');
 await name.fill('대학 동기 모임');await date.fill('2026-10-17');await amount.fill('2a4');await expect(amount).toHaveValue('24');await amount.press('Enter');
 await expect(li.locator('.blines li')).toHaveCount(1);await expect(name).toBeFocused();await expect(name).toHaveValue('');
 await name.fill('회사 팀 모임');await date.fill('2026-10-24');await amount.fill('18');await li.locator('[data-act="bl-add"]').click();
 await name.fill('고등학교 친구');await li.locator('[data-act="bl-add"]').click();
 await expect(li.locator('.blines li')).toHaveCount(3);
 await expect(li.locator('.blines li').nth(0)).toContainText('대학 동기 모임');await expect(li.locator('.blines li').nth(0)).toContainText('10.17(토)');await expect(li.locator('.blines li').nth(0)).toContainText('24만원');
 // The sum is the item's total: shown in place of the total field, on the folded row and in the category.
 await expect(li.locator('.bpay .calcval').first()).toContainText('42만원');await expect(li.locator('.bpay .calcval').first()).toContainText('세부 내역 합계');
 await expect(li.locator('[data-fk="b-total-b28"]')).toHaveCount(0);
 await expect(li.locator('.row .bamt')).toContainText('42만원');
 await expect(app.locator('details[data-k="bcat-card"] > summary .meta')).toContainText('42만원');
 await expect.poll(async()=>Object.keys((await stored(app))?.budget?.items?.b28?.lines||{}).length).toBe(3);
 let st=await stored(app);const lines=Object.values(st.budget.items.b28.lines);
 expect(lines.map(l=>[l.name,l.date,l.amount])).toEqual([['대학 동기 모임','2026-10-17',24],['회사 팀 모임','2026-10-24',18],['고등학교 친구','','']]);
 expect(noArrays(st)).toBe(true);
 // Folded, the row says how many lines it holds.
 await li.locator('[data-act="close-row"]').click();await expect(li.locator('.row .bamt')).toContainText('신랑 3번');
 await title.click();
 // Removing a line keeps it in storage as deleted and lowers the total; with no amounts left the total field comes back.
 await li.locator('[data-act="bl-del"]').first().click();
 await expect(li.locator('.blines li')).toHaveCount(2);await expect(li.locator('.bpay .calcval').first()).toContainText('18만원');
 await li.locator('[data-act="bl-del"]').first().click();
 await expect(li.locator('[data-fk="b-total-b28"]')).toBeVisible();
 await expect.poll(async()=>Object.values((await stored(app)).budget.items.b28.lines).filter(l=>l.deleted).length).toBe(2);
 // The per-guest meal item is calculated from heads × unit, so it has no detail lines.
 await app.locator('[data-act="b-open"][data-id="b02"]').click();
 await expect(app.locator('li.bitem').filter({has:app.locator('[data-act="b-open"][data-id="b02"]')}).locator('.bl-add')).toHaveCount(0);
 // Items added by hand take detail lines too.
 await app.locator('#bAddName').fill('부케');await app.locator('[data-act="b-add"]').click();
 const own=app.locator('[data-act="b-open"]').filter({hasText:'부케'});await own.click();
 const ownLi=app.locator('li.bitem.is-open').filter({hasText:'부케'});
 await ownLi.locator('[data-bl="name"]').fill('본식 부케');await ownLi.locator('[data-bl="amount"]').fill('15');await ownLi.locator('[data-act="bl-add"]').click();
 await expect(ownLi.locator('.bpay .calcval').first()).toContainText('15만원');
 await expect.poll(async()=>Object.values((await stored(app)).budget.custom).some(c=>c.name==='부케'&&c.lines)).toBe(true);
 st=await stored(app);const custom=Object.values(st.budget.custom).find(c=>c.name==='부케');
 expect(Object.values(custom.lines).map(l=>[l.name,l.amount])).toEqual([['본식 부케',15]]);expect(noArrays(st)).toBe(true);
 expect(errors).toEqual([]);
});

test('plan review shows a line-derived total as calculated instead of offering edits that cannot take effect',async({page})=>{
 const seed=structuredClone(SEED);
 seed.budget.planGroup='pa';seed.budget.items.b28={plan:10,lines:{l1:{name:'대학 동기 모임',date:'2026-10-17',amount:24,created:1}}};
 seed.pricePlan={activeGroup:'pa',groups:{pa:{name:'모임 비교안',items:{'x-card-meet':true,'x-bouquet':true},amounts:{'x-card-meet':60,'x-bouquet':35},apply:{'x-card-meet':true,'x-bouquet':true}}}};
 const {app,errors}=await openApp(page,seed);
 await app.locator('#tab-budget').click();await app.locator('details[data-k="pr-box"] > summary').click();
 const row=key=>app.locator(`details[data-k="pr-row-${key}"]`);
 // 청첩장 모임 has a 24만원 detail line: its budget is that sum, compared with the plan's 60만원.
 await expect(row('b28').locator('.pr-row-nums')).toHaveText('비교안 60만원 · 내 예산 24만원');
 await row('b28').locator('summary').click();
 await expect(row('b28').locator('[data-fk="pr-plan-b28"]')).toHaveCount(0);
 await expect(row('b28').locator('.calcval')).toContainText('24만원');await expect(row('b28').locator('.calcval')).toContainText('세부 내역 합계');
 await expect(row('b28').locator('.pr-keep')).toContainText('세부 내역의 합계가 총비용이에요');
 await expect(row('b28').locator('[data-act="b-plan-import"]')).toHaveCount(0);
 // An item without detail lines keeps its editable budget and the import button.
 await row('b27').locator('summary').click();
 await expect(row('b27').locator('[data-fk="pr-plan-b27"]')).toBeVisible();await expect(row('b27').locator('[data-act="b-plan-import"]')).toHaveCount(1);
 expect(errors).toEqual([]);
});

test('calendar view gathers dated tasks, payments and detail lines by month and adds schedules',async({page})=>{
 const seed=structuredClone(SEED);
 seed.budget.items.b05={plan:140,deposit:30,depositDate:'2026-10-12',balanceDate:'2026-10-28'};seed.tasks.t10={book:'2026-10-08'};
 seed.budget.items.b28={lines:{l1:{name:'대학 동기 모임',date:'2026-10-17',amount:24,created:1},l2:{name:'회사 팀 모임',date:'2026-10-24',amount:18,created:2},l3:{name:'지운 모임',date:'2026-10-20',amount:9,deleted:true}}};
 const {app,errors}=await openApp(page,seed);
 // The calendar has its own tab, right after 진행 순서, and the tab is remembered on this device.
 expect(await app.locator('.tab').evaluateAll(els=>els.slice(0,3).map(e=>e.textContent))).toEqual(['진행 순서','달력','예산']);
 await app.locator('#tab-cal').click();
 expect(await app.locator('body').evaluate(()=>localStorage.getItem('wd-tab'))).toBe('cal');
 await expect(app.locator('#panel-timeline .phase')).toHaveCount(0);
 await expect(app.locator('#calTitle')).toHaveText('2026년 10월');
 await expect(app.locator('.cal-day')).toHaveCount(31);
 await expect(app.locator('.cal-day.today')).toHaveAttribute('data-id','2026-10-06');
 // Everything with a date in October: a booking, a task, a deposit, two gatherings, another task and a balance.
 await expect(app.locator('.cal-list h4')).toHaveText('10월 일정 7건');
 const items=app.locator('.cal-item');
 await expect(items).toHaveText([/예약.*예약 · 스드메 계약/,/할 일.*스드메 계약/,/지출.*예약금 · 스튜디오 촬영.*30만원/,/지출.*대학 동기 모임 · 청첩장 모임.*24만원/,/할 일.*본식 스냅·영상 계약/,/지출.*회사 팀 모임 · 청첩장 모임.*18만원/,/지출.*잔금 · 스튜디오 촬영.*110만원/]);
 await expect(app.locator('.cal-list')).not.toContainText('지운 모임');
 // The grid marks the kinds of things on each day and announces how many there are.
 const d17=app.locator('.cal-day[data-id="2026-10-17"]');
 await expect(d17).toHaveAttribute('aria-label','10월 17일 토요일, 일정 1개');await expect(d17.locator('.cal-dots i.p')).toHaveCount(1);
 await expect(app.locator('.cal-day[data-id="2026-10-08"] .cal-dots i.b')).toHaveCount(1);
 await expect(app.locator('.cal-day[data-id="2026-10-06"]')).toHaveAttribute('aria-label','10월 6일 화요일, 오늘, 일정 0개');
 // Nothing overflows sideways and every control is at least 44px, also at 320px.
 const audit=await app.locator('body').evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,small:[...document.querySelectorAll('#panel-cal button, #panel-cal input')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect()).filter(r=>r.width<43.9||r.height<43.9).length}));
 expect(audit).toEqual({overflow:false,small:0});
 // Pick a day: only that day is listed, and a schedule typed below lands on it.
 await d17.click();await expect(d17).toHaveAttribute('aria-pressed','true');
 await expect(app.locator('.cal-list h4')).toHaveText('10월 17일 (토) 1건');await expect(items).toHaveCount(1);
 await expect(app.locator('#addDate')).toHaveValue('2026-10-17');
 await app.locator('#addTitle').fill('웨딩홀 시식');await app.locator('#addTitle').press('Enter');
 await expect.poll(async()=>Object.values((await stored(app)).custom).some(x=>x.title==='웨딩홀 시식'&&x.date==='2026-10-17')).toBe(true);
 await expect(app.locator('.cal-list h4')).toHaveText('10월 17일 (토) 2건');await expect(items.filter({hasText:'웨딩홀 시식'})).toHaveCount(1);
 await expect(app.locator('.cal-day[data-id="2026-10-17"] .cal-dots i')).toHaveCount(2);
 await app.locator('[data-act="cal-all"]').click();await expect(app.locator('.cal-list h4')).toHaveText('10월 일정 8건');
 // Other months, and back to today. The wedding month shows the wedding day.
 await app.locator('[data-act="cal-move"][data-v="-1"]').click();await expect(app.locator('#calTitle')).toHaveText('2026년 9월');
 await app.locator('[data-act="cal-move"][data-v="0"]').click();await expect(app.locator('#calTitle')).toHaveText('2026년 10월');
 for(let i=0;i<7;i++)await app.locator('[data-act="cal-move"][data-v="1"]').click();
 await expect(app.locator('#calTitle')).toHaveText('2027년 5월');
 await expect(app.locator('.cal-day.wed')).toHaveAttribute('data-id','2027-05-08');
 await expect(app.locator('.cal-item.k-wed')).toContainText('결혼식 오후 12시 30분');
 await app.locator('[data-act="cal-move"][data-v="0"]').click();
 // A task opens in 진행 순서; a payment opens its budget item.
 await items.filter({hasText:'본식 스냅·영상 계약'}).locator('button').click();
 await expect(app.locator('#tab-timeline')).toHaveAttribute('aria-selected','true');
 await expect(app.locator('[data-act="open"][data-id="t11"]')).toHaveAttribute('aria-expanded','true');
 await app.locator('#tab-cal').click();
 await items.filter({hasText:'대학 동기 모임'}).locator('button').click();
 await expect(app.locator('#tab-budget')).toHaveAttribute('aria-selected','true');
 await expect(app.locator('[data-act="b-open"][data-id="b28"]')).toHaveAttribute('aria-expanded','true');
 expect(noArrays(await stored(app))).toBe(true);expect(errors).toEqual([]);
});

test('text contrast AA also holds in opened rows, the calendar and detail lines',async({page})=>{
 const seed=structuredClone(SEED);seed.budget.region='서울 강남';
 seed.budget.items.b05={plan:140,deposit:30,depositDate:'2026-10-12',balanceDate:'2026-10-25',balancePaid:true};seed.budget.items.b01={plan:350,actual:420,deposit:100,balanceDate:'2026-09-01'};
 seed.tasks.t10={book:'2026-10-04'};seed.tasks.t09={date:'2026-10-11',done:true};
 seed.budget.items.b28={lines:{l1:{name:'대학 동기 모임',date:'2026-10-18',amount:24,created:1}}};
 seed.budget.custom={x1:{cat:'wed',name:'부케',plan:30,created:5}};
 seed.budget.quotes={q1:{name:'라온홀',heads:200,unit:65000,hall:300,extra:50,created:1},q2:{name:'비싼홀',heads:200,unit:120000,hall:900,extra:50,created:2}};
 const {app,errors}=await openApp(page,seed);
 const failures=()=>app.locator('body').evaluate(()=>{
  function rgba(s){return s.match(/[\d.]+/g).map(Number)}
  function blend(a,b){const alpha=a[3]??1;return a.slice(0,3).map((x,i)=>x*alpha+b[i]*(1-alpha))}
  function bg(e){let c=[255,255,255];const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);for(const n of chain)c=blend(rgba(getComputedStyle(n).backgroundColor),c);return c}
  function lum(c){return c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)}
  const out=[];for(const e of document.querySelectorAll('body *')){if(!e.getClientRects().length||e.closest('[hidden]')||e.matches(':disabled')||['SCRIPT','STYLE','OPTION','SVG','PATH'].includes(e.tagName))continue;const text=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');if(!text)continue;const st=getComputedStyle(e),background=bg(e),foreground=blend(rgba(st.color),background),l=[lum(background),lum(foreground)].sort((a,b)=>b-a),ratio=(l[0]+.05)/(l[1]+.05);if(ratio<4.5)out.push({text:text.slice(0,40),ratio:Math.round(ratio*100)/100});}return out;
 });
 // An overdue task and a done one, opened: red and blue text sits on the tinted band.
 await app.locator('[data-act="open"][data-id="t04"]').click();await app.locator('[data-act="open"][data-id="t01"]').click();
 expect(await failures(),'tasks').toEqual([]);
 // Calendar: a picked Sunday, then the wedding month with a picked Sunday.
 await app.locator('#tab-cal').click();
 await app.locator('[data-act="cal-day"][data-id="2026-10-18"]').click();expect(await failures(),'calendar').toEqual([]);
 for(let i=0;i<7;i++)await app.locator('[data-act="cal-move"][data-v="1"]').click();
 await app.locator('[data-act="cal-day"][data-id="2027-05-09"]').click();expect(await failures(),'wedding month').toEqual([]);
 // Budget: detail lines, an over-budget item, a calculated one, a paid one, one added by hand, and both quotes.
 await app.locator('#tab-budget').click();
 for(const k of ['bcat-card','bcat-wed','bcat-sdm']){const c=app.locator(`details[data-k="${k}"]`);if(!(await c.evaluate(e=>e.open)))await c.locator(':scope > summary').click();}
 for(const id of ['b28','b01','b02','b05'])await app.locator(`[data-act="b-open"][data-id="${id}"]`).click();
 await app.locator('[data-act="b-open"]').filter({hasText:'부케'}).click();
 for(const q of await app.locator('[data-act="q-open"]').all())await q.click();
 await app.locator('details.glance-more > summary').click();
 expect(await failures(),'budget').toEqual([]);
 await app.locator('#tab-guest').click();await app.locator('[data-act="g-open"]').first().click();expect(await failures(),'guest').toEqual([]);
 await app.locator('#tab-talk').click();await app.locator('[data-act="talk-open"]').first().click();expect(await failures(),'talk').toEqual([]);
 expect(errors).toEqual([]);
});

test('invitation gatherings are recorded per side with head counts and grouped by groom, bride and both',async({page})=>{
 const {app,errors}=await openApp(page);
 await app.locator('#tab-budget').click();
 const cat=app.locator('details[data-k="bcat-card"]');if(!(await cat.evaluate(e=>e.open)))await cat.locator(':scope > summary').click();
 await app.locator('[data-act="b-open"][data-id="b28"]').click();
 const li=app.locator('li.bitem').filter({has:app.locator('[data-act="b-open"][data-id="b28"]')});
 const who=v=>li.locator(`[data-act="bl-who"][data-v="${v}"]`);
 await expect(who('groom')).toHaveAttribute('aria-checked','true');
 const add=async(side,name,date,heads,amount)=>{
  await li.locator('[data-bl="name"]').fill(name);if(date)await li.locator('[data-bl="date"]').fill(date);
  if(heads)await li.locator('[data-bl="heads"]').fill(heads);if(amount)await li.locator('[data-bl="amount"]').fill(amount);
  await who(side).click();await expect(who(side)).toHaveAttribute('aria-checked','true');
  // Choosing the side keeps what was typed.
  await expect(li.locator('[data-bl="name"]')).toHaveValue(name);
  await li.locator('[data-act="bl-add"]').click();await expect(li.locator('[data-bl="name"]')).toHaveValue('');};
 await add('groom','대학 동기','2026-10-17','6','24');
 await add('bride','회사 팀','2026-10-24','8','32');
 await add('groom','고등학교 친구','','4','16');
 await add('both','양가 친척','2026-11-07','','');
 // Grouped by side with count, people and subtotal; each line shows people and cost per person.
 await expect(li.locator('.bl-head')).toHaveText([/신랑 쪽.*2번 · 10명 · 40만원/,/신부 쪽.*1번 · 8명 · 32만원/,/함께.*1번 · 0만원/]);
 await expect(li.locator('.bl-groom .blines li').first()).toContainText('6명 · 1인 4만원');
 await expect(li.locator('.bpay .calcval').first()).toContainText('72만원');
 await li.locator('[data-act="close-row"]').click();await expect(li.locator('.row .bamt')).toContainText('신랑 2번 · 신부 1번 · 함께 1번');
 await expect.poll(async()=>Object.keys((await stored(app))?.budget?.items?.b28?.lines||{}).length).toBe(4);
 const lines=Object.values((await stored(app)).budget.items.b28.lines);
 expect(lines.map(l=>[l.name,l.who,l.heads,l.amount])).toEqual([['대학 동기','groom',6,24],['회사 팀','bride',8,32],['고등학교 친구','groom',4,16],['양가 친척','both','','']]);
 expect(noArrays(await stored(app))).toBe(true);
 // The calendar tab names the side.
 await app.locator('#tab-cal').click();
 await expect(app.locator('.cal-item').filter({hasText:'대학 동기'})).toContainText('신랑 쪽 대학 동기 · 청첩장 모임');
 await expect(app.locator('.cal-item').filter({hasText:'회사 팀'})).toContainText('신부 쪽 회사 팀 · 청첩장 모임');
 // Other budget items keep the simple detail lines without sides.
 await app.locator('#tab-budget').click();await app.locator('[data-act="b-open"][data-id="b01"]').click();
 const hall=app.locator('li.bitem').filter({has:app.locator('[data-act="b-open"][data-id="b01"]')});
 await expect(hall.locator('[data-act="bl-who"]')).toHaveCount(0);await expect(hall.locator('[data-bl="heads"]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('price tab shows the September 2026 option medians by nationwide, Seoul and Gyeongin, and links to vendor prices',async({page})=>{
 const {app,errors}=await openApp(page);
 await app.locator('#tab-price').click();
 for(const k of ['pt-studio','pt-dress','pt-makeup','pt-package','pt-check'])await openSection(app,k);
 const row=(sec,label)=>app.locator(`#panel-price details[data-k="${sec}"] tr`).filter({hasText:label});
 await expect(row('pt-studio','담당자(작가) 지정')).toContainText('19만원 / 19만원 / 18만원');
 await expect(row('pt-dress','드레스 지정비')).toContainText('88만원 / 83만원 / 65만원');
 await expect(row('pt-dress','2부 드레스')).toContainText('40만원 / 50만원 / 18만원');
 await expect(row('pt-makeup','헤어 변형')).toContainText('35만원 / 39만원 / 33만원');
 await expect(row('pt-makeup','헤어피스 구매')).toContainText('17만원 / 17만원 / 15만원');
 await expect(row('pt-makeup','담당자 지정')).toContainText('6만원 / 6만원 / 10만원');
 await expect(row('pt-package','패키지 계약금액')).toContainText('300만원 / 350만원 / 220만원');
 for(const r of [row('pt-dress','드레스 지정비'),row('pt-package','패키지 계약금액')]){await expect(r).toContainText('2026년 9월');await expect(r.locator('.kchip.mid')).toHaveCount(1);}
 await expect(app.locator('#panel-price details[data-k="pt-package"]')).toContainText('추가금이 들어 있지 않아요');
 await expect(app.locator('#panel-price details[data-k="pt-package"]')).toContainText('지역 표와 섞어 보지 마세요');
 const check=app.locator('#panel-price details[data-k="pt-check"]');
 await expect(check).toContainText('17곳에 과태료 총 1,560만원');
 await expect(check.locator('a[href="https://ipsajeon.com/tools/wedding"]')).toHaveText('업체 공개 가격 모음(민간, 2026년 9월 확인)');
 await expect(check.locator('a[href="https://www.ftc.go.kr"]')).toHaveCount(1);
 for(const l of await check.locator('.srcs a').all())expect(await l.getAttribute('rel')).toContain('noopener');
 expect(errors).toEqual([]);
});

test('switching tabs neither jumps to the top nor lands mid-page, and returning restores the reading position',async({page})=>{
 const {app,errors}=await openApp(page);
 const state=()=>app.locator('body').evaluate(()=>{const bar=document.querySelector('.tabs').getBoundingClientRect(),p=document.querySelector('.panel:not([hidden])').getBoundingClientRect();return {y:scrollY,barTop:bar.top,barH:bar.height,panelTop:p.top};});
 const tap=async t=>{await app.locator('#tab-'+t).evaluate(e=>{const w=e.parentElement,r=e.getBoundingClientRect(),wr=w.getBoundingClientRect();if(r.left<wr.left||r.right>wr.right)w.scrollLeft+=r.left-wr.left-20;});const b=await app.locator('#tab-'+t).boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await expect(app.locator('#tab-'+t)).toHaveAttribute('aria-selected','true');return state();};
 // At the top of the page a tab tap leaves the page where it is.
 let s=await tap('budget');expect(s.y).toBe(0);
 // Deep in a long list, every other tab opens with its first line right under the stuck tab bar.
 await tap('timeline');await app.locator('body').evaluate(()=>window.scrollTo(0,1500));
 for(const t of ['cal','budget','price','guest','honey','know','talk']){
  s=await tap(t);expect(s.barTop,t).toBeLessThanOrEqual(1);expect(Math.abs(s.panelTop-s.barH),t).toBeLessThanOrEqual(2);expect(s.y,t).toBeGreaterThan(0);
 }
 // Coming back to 진행 순서 returns to where the list was being read.
 s=await tap('timeline');expect(Math.abs(s.y-1500)).toBeLessThanOrEqual(2);
 // Tapping the open tab again goes to the top of that tab, not of the page.
 s=await tap('timeline');expect(Math.abs(s.panelTop-s.barH)).toBeLessThanOrEqual(2);expect(s.barTop).toBeLessThanOrEqual(1);
 // Arrow keys on the tab bar behave the same way.
 await app.locator('body').evaluate(()=>window.scrollTo(0,1500));await app.locator('#tab-timeline').focus();await page.keyboard.press('ArrowRight');
 await expect(app.locator('#tab-cal')).toBeFocused();s=await state();expect(Math.abs(s.panelTop-s.barH)).toBeLessThanOrEqual(2);
 expect(errors).toEqual([]);
});

test('home view gathers the next payment, this week and guides without adding a ninth tab',async({page})=>{
 const seed=structuredClone(SEED);seed.budget.items.b05={plan:140,deposit:30,balanceDate:'2026-10-12'};seed.budget.items.b06={plan:160,deposit:50,balanceDate:'2026-10-02'};
 const {app,errors}=await openApp(page,seed);
 await expect(app.locator('.tab')).toHaveCount(8);await expect(app.locator('#panel-home')).toBeHidden();
 await app.locator('[data-act="home-open"]').click();
 const home=app.locator('#panel-home');await expect(home).toBeVisible();
 await expect(app.locator('.tab[aria-selected="true"]')).toHaveCount(0);await expect(app.locator('#panel-timeline')).toBeHidden();
 expect(await app.locator('body').evaluate(()=>localStorage.getItem('wd-home'))).toBe('1');
 // The nearest balance (dress, already 4 days late) comes first, with the same paid toggle as the budget tab.
 await expect(home.locator('.home-pay .home-when')).toHaveText('10.2(금)까지 · 4일 지남');
 await expect(home.locator('.home-pay .home-what')).toContainText('드레스 잔금');await expect(home.locator('.home-pay .home-what')).toContainText('110만원');
 await home.locator('.home-pay [data-act="b-balance-paid"]').click();
 await expect.poll(async()=>(await stored(app)).budget.items.b06.balancePaid).toBe(true);
 await expect(home.locator('.home-pay .home-what')).toContainText('스튜디오 촬영 잔금');
 await expect(home.locator('.home-done')).toContainText('드레스 잔금을 냈다고 적었어요');
 await home.locator('.home-done [data-act="b-balance-paid"]').click();
 await expect.poll(async()=>(await stored(app)).budget.items.b06.balancePaid).toBe(false);
 await expect(home.locator('.home-pay .home-what')).toContainText('드레스 잔금');await expect(home.locator('.home-done')).toHaveCount(0);
 // Late tasks are named as such; tapping one opens it in 진행 순서 and closes the home view.
 await expect(home.locator('#homeWeekH')).toContainText('놓친 일과 이번 주 할 일');
 await home.locator('.home-list [data-act="cal-go"]').first().click();
 await expect(app.locator('#panel-home')).toBeHidden();await expect(app.locator('#tab-timeline')).toHaveAttribute('aria-selected','true');
 await expect(app.locator('#panel-timeline .task.is-open')).toHaveCount(1);
 // Guides keep their own names and open their tabs.
 await app.locator('[data-act="home-open"]').click();
 await expect(home.locator('.home-go').filter({hasText:'신혼여행'})).toHaveCount(1);await expect(home.locator('.home-go').filter({hasText:'알아둘 것'})).toHaveCount(1);
 await home.locator('[data-act="home-tab"][data-v="honey"]').click();await expect(app.locator('#tab-honey')).toHaveAttribute('aria-selected','true');await expect(app.locator('#panel-home')).toBeHidden();
 // A talk topic opens in 둘이 정할 것; any tab tap also leaves home; 홈 닫기 returns to the tab.
 await app.locator('[data-act="home-open"]').click();await home.locator('[data-act="home-talk"]').first().click();
 await expect(app.locator('#tab-talk')).toHaveAttribute('aria-selected','true');await expect(app.locator('[data-act="talk-open"][data-id="m1"]')).toHaveAttribute('aria-expanded','true');
 await app.locator('[data-act="home-open"]').click();await app.locator('#tab-budget').click();await expect(app.locator('#panel-budget')).toBeVisible();await expect(app.locator('#panel-home')).toBeHidden();
 await app.locator('[data-act="home-open"]').click();await home.locator('[data-act="home-close"]').click();
 await expect(app.locator('#panel-budget')).toBeVisible();await expect(app.locator('[data-act="home-open"]')).toBeFocused();
 expect(await app.locator('body').evaluate(()=>localStorage.getItem('wd-home'))).toBe('0');
 expect(noArrays(await stored(app))).toBe(true);expect(errors).toEqual([]);
});

test('every visible form field is at least 16px so iPhone Safari does not zoom in on focus',async({page})=>{
 test.setTimeout(90000);
 const {app,errors}=await openApp(page);
 const small=()=>app.locator('body').evaluate(()=>[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.dataset.fk||e.id));
 for(const t of ['timeline','cal','budget','price','guest','know','talk']){
  await app.locator('#tab-'+t).click();
  if(t==='timeline')await app.locator('[data-act="open"]').first().click();
  if(t==='budget')await app.locator('[data-act="b-open"]').first().click();
  if(t==='guest')await app.locator('[data-act="g-open"]').first().click();
  if(t==='talk')await app.locator('[data-act="talk-open"]').first().click();
  if(t==='price'||t==='know')await app.locator(`#panel-${t} details`).evaluateAll(els=>els.forEach(e=>e.open=true));
  expect(await small(),t).toEqual([]);
 }
 await app.locator('#openShare').click();expect(await small(),'share').toEqual([]);
 expect(errors).toEqual([]);
});

test('typing then leaving the app right away still saves; a reload starts at the top',async({page})=>{
 const {app,errors}=await openApp(page);
 await app.locator('[data-act="open"][data-id="t05"]').click();
 await app.locator('[data-fk="memo-t05"]').fill('상견례 장소 예약');
 // The page is hidden before the 0.6s save delay ends (switching apps, closing the tab).
 await app.locator('body').evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 expect((await stored(app)).tasks.t05.memo).toBe('상견례 장소 예약');
 await app.locator('[data-fk="memo-t05"]').fill('상견례 장소 예약 완료');
 await app.locator('body').evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
 expect((await stored(app)).tasks.t05.memo).toBe('상견례 장소 예약 완료');
 expect(await app.locator('body').evaluate(()=>history.scrollRestoration)).toBe('manual');
 expect(noArrays(await stored(app))).toBe(true);expect(errors).toEqual([]);
});

test('with a 20px minimum font the tab names stay inside their buttons and the stuck phase header sits below the tabs',async({page})=>{
 const {app,errors}=await openApp(page);
 // Normal size: the stuck phase header is one line (name · range · count).
 const intoPhase=()=>app.locator('body').evaluate(()=>{const sec=document.querySelectorAll('#panel-timeline .phase')[1];window.scrollTo(0,sec.getBoundingClientRect().top+scrollY+150);});
 await intoPhase();
 const head=()=>app.locator('body').evaluate(()=>{const bar=document.querySelector('.tabs').getBoundingClientRect();const h=[...document.querySelectorAll('.phase-head')].map(e=>e.getBoundingClientRect()).find(r=>r.top<bar.bottom+60&&r.bottom>bar.bottom);return {bar:bar.bottom,top:h&&h.top,height:h&&h.height,over:[...document.querySelectorAll('.tab')].filter(t=>t.scrollWidth>t.clientWidth+1||t.scrollHeight>t.clientHeight+1).map(t=>t.textContent)};});
 let r=await head();expect(r.over).toEqual([]);expect(Math.abs(r.top-r.bar)).toBeLessThanOrEqual(1);expect(r.height).toBeLessThanOrEqual(40);
 // Large text: every font below 20px is raised to 20px, as a browser minimum font size does.
 await app.locator('body').evaluate(()=>{for(const e of document.querySelectorAll('body *')){if(parseFloat(getComputedStyle(e).fontSize)<20)e.style.fontSize='20px';}});
 await app.locator('body').evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await intoPhase();
 await expect.poll(async()=>{const x=await head();return x.top!=null&&Math.abs(x.top-x.bar)<=1;}).toBe(true);
 r=await head();expect(r.over).toEqual([]);
 expect(errors).toEqual([]);
});

test('opening a tab or a talk topic from home with the keyboard moves focus there, and reopening home returns focus to that card',async({page})=>{
 const {app,errors}=await openApp(page);
 await app.locator('[data-act="home-open"]').focus();await page.keyboard.press('Enter');
 await app.locator('#panel-home [data-act="home-tab"][data-v="timeline"]').focus();await page.keyboard.press('Enter');
 await expect(app.locator('#tab-timeline')).toBeFocused();
 await app.locator('[data-act="home-open"]').focus();await page.keyboard.press('Enter');
 await expect(app.locator('#panel-home [data-act="home-tab"][data-v="timeline"]')).toBeFocused();
 await app.locator('#panel-home [data-act="home-talk"][data-id="m1"]').focus();await page.keyboard.press('Enter');
 await expect(app.locator('[data-act="talk-open"][data-id="m1"]')).toBeFocused();
 await app.locator('[data-act="home-open"]').focus();await page.keyboard.press('Enter');
 await expect(app.locator('#panel-home [data-act="home-talk"][data-id="m1"]')).toBeFocused();
 expect(errors).toEqual([]);
});

test('the custom-task header explanation wraps inside the screen when there is no wedding date',async({page})=>{
 const seed=structuredClone(SEED);seed.weddingDate='';seed.custom={c1:{title:'축가 리허설',created:1}};
 const {app,errors}=await openApp(page,seed);
 const head=app.locator('#panel-timeline .phase-head').filter({hasText:'직접 추가한 일'});await expect(head).toHaveCount(1);
 const r=await head.evaluate(h=>{const m=h.querySelector('.meta'),hr=h.getBoundingClientRect(),mr=m.getBoundingClientRect();return {right:mr.right,hright:hr.right,vw:innerWidth,clip:m.scrollWidth>m.clientWidth+1};});
 expect(r.right).toBeLessThanOrEqual(r.hright+0.5);expect(r.right).toBeLessThanOrEqual(r.vw);expect(r.clip).toBe(false);
 expect(errors).toEqual([]);
});

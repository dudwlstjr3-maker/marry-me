const {test,expect}=require('@playwright/test');
const {SEED,openApp,stored}=require('./helpers.cjs');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const tabs=['timeline','budget','guest','honey','know','talk'];
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
 await app.locator('#closeShare').click();await app.locator('#tab-timeline').focus();await page.keyboard.press('ArrowRight');await expect(app.locator('#tab-budget')).toBeFocused();await page.keyboard.press('End');await expect(app.locator('#tab-talk')).toBeFocused();await page.keyboard.press('Home');await expect(app.locator('#tab-timeline')).toBeFocused();
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

test('text contrast AA in all tabs including tinted surfaces',async({page})=>{
 const {app}=await openApp(page);
 for(const tab of tabs){await app.locator('#tab-'+tab).click();if(tab==='know')await app.locator('details').evaluateAll(els=>els.forEach(e=>e.open=true));
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
 const normalize=s=>s.replace(/regCalcHTML\('[^']+'\)/g,'regCalcHTML()');
 expect(block(current,'var BASIS =','function esc(')).toBe(block(original,'var BASIS =','function esc('));
 expect(normalize(block(current,'function knowHTML(){','function num('))).toBe(normalize(block(original,'function knowHTML(){','function num(')));
});

test('item-by-item price table and budget reference lines',async({page})=>{
 const {app,errors}=await openApp(page);await app.locator('#tab-budget').click();
 const row=id=>app.locator(`[data-act="b-open"][data-id="${id}"]`).locator('xpath=ancestor::li[1]');
 await expect(row('b01').locator('.refline')).toHaveText('전국 대관료 평균 317만원, 내 금액이 33만원 높아요');
 await expect(row('b02').locator('.refline')).toHaveText('전국 1인 식대 평균 5.9만원, 내 금액이 0.3만원 높아요');
 await expect(row('b05').locator('.refline')).toContainText('스튜디오 전국 중간값 137만원(2026년 2월)');
 await app.locator('[data-act="goto-know"][data-k="k13"][data-sec="pt-hall"]').click();
 const card=app.locator('details[data-k="k13"]');
 await expect(card).toHaveJSProperty('open',true);
 for (const id of ['pt-read','pt-total','pt-hall','pt-studio','pt-dress','pt-makeup','pt-package','pt-timing','pt-check']) await expect(card.locator('#'+id)).toHaveCount(1);
 await expect(card.locator('.ptable')).toHaveCount(11);
 await card.locator('[data-act="pt-jump"][data-sec="pt-dress"]').click();
 await expect(card.locator('#pt-dress')).toBeFocused();
 for (const old of ['k10','k12']) await expect(app.locator(`details[data-k="${old}"]`)).toHaveCount(0);
 expect(errors).toEqual([]);
});

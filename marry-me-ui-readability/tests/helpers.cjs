const { expect } = require('@playwright/test');
const SEED = { v:1, groom:'준호', bride:'민지', weddingDate:'2027-05-08', weddingTime:'12:30', startDate:'2026-01-01', tasks:{t01:{done:true},t02:{done:true},t03:{done:true}}, custom:{}, talks:{}, budget:{total:5000, items:{b01:{plan:350,paid:100},b02:{heads:187,unit:62000}},custom:{}}, guests:{g1:{name:'김하늘',side:'groom',group:'친구',count:2,gift:20,attend:'yes',invite:'sent'},g2:{name:'이수진',side:'bride',group:'친구',count:1,gift:10,attend:'unknown'}} };
async function openApp(page, seed = SEED) {
  const errors=[];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if(m.type()==='error') errors.push(m.text());});
  // Offline tests isolate app behavior from Google Fonts availability.
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({status:200,contentType:'text/css',body:''}));
  await page.addInitScript(seed => { localStorage.clear(); if(seed) localStorage.setItem('wedding-plan-v1',JSON.stringify(seed)); }, seed);
  await page.clock.setFixedTime(new Date('2026-10-06T03:00:00Z'));
  await page.goto('/tests/sandbox.html');
  const app=page.frameLocator('#app');
  await expect(app.locator('#status')).toHaveText('이 기기에만 저장돼요');
  return {app, errors};
}
async function stored(app) { return app.locator('body').evaluate(() => JSON.parse(localStorage.getItem('wedding-plan-v1'))); }
module.exports={SEED,openApp,stored};

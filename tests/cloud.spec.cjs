// 카카오 로그인으로 둘이 함께 쓰기: Supabase 대신 같은 모양의 가짜 서버로 시험해요.
// 가짜 서버의 규칙(멤버만 읽고 쓰기, 바뀐 부분만 깊게 합치기, 초대 7일·한 번·최대 2명)은 supabase/setup.sql과 같아요.
const {test,expect}=require('@playwright/test');
const {SEED}=require('./helpers.cjs');
const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js';
const API='https://fake.supabase.test';

function deepMerge(a,b){if(!a||typeof a!=='object'||Array.isArray(a)||!b||typeof b!=='object'||Array.isArray(b))return structuredClone(b);const r={...a};for(const k of Object.keys(b))r[k]=deepMerge(a[k],b[k]);return r;}
function fakeServer({legacy=false}={}){
 const db={plans:{},members:[],invites:{}};let n=0;
 const calls=[],offline=new Set(),failures=[],holds=[];
 const isMember=(p,u)=>db.members.some(m=>m.plan===p&&m.user===u);
 const myPlan=u=>{const m=db.members.filter(x=>x.user===u).sort((a,b)=>b.at-a.at)[0];return m?m.plan:null;};
 const label=p=>{const d=db.plans[p]||{};return d.title||[d.groom,d.bride].filter(Boolean).join(' · ')||'결혼 준비 수첩';};
 function invite(code,u){
  const inv=db.invites[code];
  if(!inv||inv.expires<Date.now()||(inv.used&&inv.used!==u&&!isMember(inv.plan,u)))throw {message:'invalid invite'};
  return inv;
 }
 const rpc={
  my_plan:u=>myPlan(u),
  list_my_plans:u=>db.members.filter(m=>m.user===u).sort((a,b)=>b.at-a.at).map(m=>({plan_id:m.plan,label:label(m.plan)})),
  create_plan:(u,a)=>{const have=myPlan(u);if(have)return have;const id='p'+(++n);db.plans[id]=structuredClone(a.p_data||{});db.members.push({plan:id,user:u,at:++n});return id;},
  merge_plan:(u,a)=>{if(!isMember(a.p_id,u))throw {code:'42501',message:'not a member'};db.plans[a.p_id]=deepMerge(db.plans[a.p_id],a.p_patch);return null;},
  create_invite:(u,a)=>{if(!isMember(a.p_plan,u))throw {code:'42501',message:'not a member'};if(db.members.filter(m=>m.plan===a.p_plan).length>=2)throw {message:'full'};const c='inv'+(++n)+'abcd';db.invites[c]={plan:a.p_plan,used:null,expires:Date.now()+7*86400000};return c;},
  preview_plan_invite:(u,a)=>{const inv=invite(a.p_code,u);if(!isMember(inv.plan,u)&&db.members.filter(m=>m.plan===inv.plan).length>=2)throw {message:'full'};return [{plan_id:inv.plan,label:label(inv.plan)}];},
  join_plan:(u,a)=>{const inv=invite(a.p_code,u);if(isMember(inv.plan,u))return inv.plan;if(db.members.filter(m=>m.plan===inv.plan).length>=2)throw {message:'full'};db.members=db.members.filter(m=>m.user!==u);db.members.push({plan:inv.plan,user:u,at:++n});inv.used=u;return inv.plan;},
  accept_plan_invite:(u,a)=>{const inv=invite(a.p_code,u);if(isMember(inv.plan,u))return inv.plan;if(db.members.filter(m=>m.plan===inv.plan).length>=2)throw {message:'full'};db.members.push({plan:inv.plan,user:u,at:++n});inv.used=u;return inv.plan;},
 };
 async function handle(route){
  const req=route.request(),path=new URL(req.url()).pathname.slice(1),body=JSON.parse(req.postData()||'{}'),u=req.headers()['x-user']||'';
  const op=path.startsWith('rpc/')?path.slice(4):path+':'+body.table;
  calls.push({op,user:u,args:body.args||body});
  const held=holds.find(h=>!h.entered&&h.op===op&&(!h.user||h.user===u));
  if(held){held.entered=true;await held.wait;}
  if(offline.has(u))return route.abort('internetdisconnected');
  let out;
  try{
   const fault=failures.findIndex(f=>f.op===op&&(!f.user||f.user===u));
   if(fault>=0)throw failures.splice(fault,1)[0].error;
   if(!u)throw {code:'42501',message:'login required'};
   if(path.startsWith('rpc/')){
    if(legacy&&['list_my_plans','preview_plan_invite','accept_plan_invite'].includes(op))throw {code:'PGRST202',message:'missing function'};
    if(!rpc[op])throw {code:'PGRST202',message:'unknown RPC '+op};
    out={data:rpc[op](u,body.args||{}),error:null};
   }else if(path==='select'&&body.table==='plans')out=isMember(body.id,u)?{data:{data:db.plans[body.id]},error:null}:{data:null,error:{code:'PGRST116',message:'no rows'}};
   else if(path==='select'&&body.table==='plan_members')out=isMember(body.id,u)?{data:db.members.filter(m=>m.plan===body.id).map(m=>({user_id:m.user})),error:null}:{data:[],error:null};
   else out={data:null,error:{message:'unknown'}};
  }catch(e){out={data:null,error:e};}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(out)});
 }
 return {db,handle,calls,offline,
  failNext(op,user,error={code:'XX000',message:'temporary server failure'}){failures.push({op,user,error});},
  holdNext(op,user){const h={op,user,entered:false};h.wait=new Promise(resolve=>h.release=resolve);holds.push(h);return h;},
  patch(user,id,patch){return rpc.merge_plan(user,{p_id:id,p_patch:patch});},
 };
}
// supabase-js와 같은 모양의 작은 가짜(UMD). ?code=이름 으로 돌아오면 그 이름으로 로그인돼요.
const FAKE_SDK=`window.supabase={createClient:function(url,key,opts){
 var K='sb-fake-auth-token';
 function sess(){try{return JSON.parse(localStorage.getItem(K));}catch(e){return null;}}
 function call(path,body){var s=sess();return fetch(url+'/'+path,{method:'POST',headers:{'content-type':'application/json','x-user':s?s.user.id:''},body:JSON.stringify(body||{})}).then(function(r){return r.json();});}
 window.__sbOpts=opts;
 return {
  auth:{
   getSession:function(){var m=location.search.match(/[?&]code=([^&]+)/);if(m){var id=decodeURIComponent(m[1]);localStorage.setItem(K,JSON.stringify({user:{id:id,user_metadata:{name:id==='groom'?'준호':'민지'}}}));}return Promise.resolve({data:{session:sess()},error:null});},
   signInWithOAuth:function(o){window.__oauth=o;return Promise.resolve({data:{},error:null});},
   signOut:function(){localStorage.removeItem(K);return Promise.resolve({error:null});}
  },
  rpc:function(fn,args){return call('rpc/'+fn,{args:args});},
  from:function(t){return {select:function(){return {eq:function(c,v){var p=call('select',{table:t,id:v});return {single:function(){return p;},then:function(a,b){return p.then(a,b);}};}};}};},
  removeChannel:function(ch){return ch.unsubscribe();},
  channel:function(){var handlers=[];var ch={
   on:function(ev,f,cb){handlers.push({f:f,cb:cb,last:null});return ch;},
   subscribe:function(ready){ch.timer=setInterval(function(){handlers.forEach(function(h){var id=h.f.filter.split('eq.')[1];call('select',{table:h.f.table,id:id}).then(function(r){if(r.error)return;var j=JSON.stringify(r.data);if(h.last!==null&&j!==h.last)h.cb({new:r.data});h.last=j;}).catch(function(){});});},100);if(ready)ready('SUBSCRIBED');return ch;},
   unsubscribe:function(){clearInterval(ch.timer);return Promise.resolve('ok');}
  };return ch;}
 };}};`;

async function openCloud(browser,testInfo,server,{seed=null,path='/index.html',cloud=true}={}){
 const ctx=await browser.newContext({...testInfo.project.use});
 const errors=[],sdkLoads=[];
 await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await ctx.route(SDK,r=>{sdkLoads.push(1);return r.fulfill({status:200,contentType:'text/javascript',body:FAKE_SDK});});
 await ctx.route(API+'/**',r=>server.handle(r));
 await ctx.addInitScript(([seed,cloud,api])=>{
  window.__CLOUD=cloud?{url:api,anonKey:'public-anon-key'}:{url:'',anonKey:''};
  if(!localStorage.getItem('cloud-test-seeded')){localStorage.clear();localStorage.setItem('cloud-test-seeded','1');if(seed)localStorage.setItem('wedding-plan-v1',JSON.stringify(seed));}
 },[seed,cloud,API]);
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.clock.setFixedTime(new Date('2026-10-06T03:00:00Z'));
 await page.goto(path);
 return {ctx,page,errors,sdkLoads};
}
const status=p=>p.locator('#status');
const cloudSec=p=>p.locator('#cloudSec');
const pendingKeyFor=(user,plan)=>'wd-cloud-pending:'+encodeURIComponent(user)+':'+encodeURIComponent(plan);
const readPending=(page,user,plan)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),pendingKeyFor(user,plan));

test('with the two Supabase values emptied the app stays on this device and never loads the login code',async({browser},testInfo)=>{
 const server=fakeServer();
 const {ctx,page,errors,sdkLoads}=await openCloud(browser,testInfo,server,{seed:SEED,cloud:false});
 await expect(status(page)).toHaveText('이 기기에만 저장돼요');
 await page.locator('#openShare').click();
 await expect(cloudSec(page)).toBeHidden();
 expect(sdkLoads.length).toBe(0);expect(errors).toEqual([]);
 await ctx.close();
});

test('groom logs in with Kakao, his device data goes up, the bride joins by invite link and both see each other’s edits',async({browser},testInfo)=>{
 test.setTimeout(60000);
 const server=fakeServer();
 // Groom: configured, never logged in → still local until he asks; the SDK is not loaded yet.
 const g=await openCloud(browser,testInfo,server,{seed:SEED});
 await expect(status(g.page)).toHaveText('이 기기에만 저장돼요');expect(g.sdkLoads.length).toBe(0);
 await g.page.locator('#openShare').click();
 await expect(cloudSec(g.page)).toBeVisible();
 const login=g.page.locator('#cloudSec [data-cloud="login"]');await expect(login).toHaveText('카카오 로그인');
 await login.click();
 await expect.poll(()=>g.page.evaluate(()=>window.__oauth&&window.__oauth.provider)).toBe('kakao');
 expect(await g.page.evaluate(()=>window.__sbOpts.auth.flowType)).toBe('pkce');
 expect(await g.page.evaluate(()=>window.__oauth.options.redirectTo)).toBe('http://127.0.0.1:4173/index.html');
 // Kakao sends him back with ?code=…; the plan is created from what was on this device.
 await g.page.goto('/index.html?code=groom');
 // Until someone joins, the status line says he is on his own.
 await expect(status(g.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');
 await expect(g.page).toHaveURL('http://127.0.0.1:4173/index.html');
 expect(Object.values(server.db.plans)[0].groom).toBe('준호');
 expect(Object.values(server.db.plans)[0].budget.items.b02.heads).toBe(187);
 // Invite link
 await g.page.locator('#openShare').click();
 await expect(g.page.locator('#cloudSec')).toContainText('준호님으로 카카오 로그인했어요');
 await g.page.locator('#cloudSec [data-cloud="invite"]').click();
 const link=await g.page.locator('#cloudInvite').inputValue();
 expect(link).toMatch(/^http:\/\/127\.0\.0\.1:4173\/index\.html\?join=[A-Za-z0-9]+$/);
 await g.page.locator('#closeShare').click();

 // Bride: opens the link on her own phone (empty device), is told what will happen, logs in.
 const b=await openCloud(browser,testInfo,server,{path:link.replace('http://127.0.0.1:4173','')});
 await expect(b.page.locator('#shareDlg')).toBeVisible();
 await expect(b.page.locator('#cloudSec')).toContainText('초대받았어요');
 await b.page.locator('#cloudSec [data-cloud="login"]').click();
 await expect.poll(()=>b.page.evaluate(()=>window.__oauth&&window.__oauth.options.redirectTo)).toBe(link);
 await b.page.goto(link.replace('http://127.0.0.1:4173','')+'&code=bride');
 await expect(status(b.page)).toHaveText('둘이 함께 저장돼요');
 await expect(b.page).toHaveURL('http://127.0.0.1:4173/index.html');
 await expect(b.page.locator('#hero')).toContainText('준호');
 // She ticks a task; he sees it without reloading. He types a memo; she sees it.
 await b.page.locator('#tab-timeline').click();
 await b.page.locator('[data-act="toggle"][data-id="t05"]').click();
 await expect.poll(()=>Object.values(server.db.plans)[0].tasks.t05&&Object.values(server.db.plans)[0].tasks.t05.done).toBe(true);
 await expect(g.page.locator('[data-act="toggle"][data-id="t05"]')).toHaveAttribute('aria-checked','true');
 await g.page.locator('[data-act="open"][data-id="t06"]').click();
 await g.page.locator('[data-fk="memo-t06"]').fill('본식 계약금 300');
 await b.page.locator('[data-act="open"][data-id="t06"]').click();
 await expect(b.page.locator('[data-fk="memo-t06"]')).toHaveValue('본식 계약금 300');
 // Both edits survive: the server merged them instead of overwriting.
 const plan=Object.values(server.db.plans)[0];
 expect(plan.tasks.t05.done).toBe(true);expect(plan.tasks.t06.memo).toBe('본식 계약금 300');expect(plan.tasks.t01.done).toBe(true);
 await b.page.locator('#openShare').click();
 await expect(b.page.locator('#cloudSec')).toContainText('둘이 같은 기록을 함께 쓰고 있어요');
 // A third person with the same (used) link is turned away, told so at once, and is shown as on their own.
 const c=await openCloud(browser,testInfo,server,{path:link.replace('http://127.0.0.1:4173','')+'&code=stranger'});
 await expect(status(c.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');
 expect(server.db.members.filter(m=>m.plan===Object.keys(server.db.plans)[0]).length).toBe(2);
 await expect(c.page.locator('#shareDlg')).toBeVisible();await expect(c.page.locator('#cloudSec')).toContainText('초대 링크가 지났거나 이미 쓰였어요. 지금은 혼자 쓰는 수첩이에요');
 await c.page.locator('#closeShare').click();
 // Logging out goes back to this device only.
 await b.page.locator('#cloudSec [data-cloud="logout"]').click();
 await expect(status(b.page)).toHaveText('이 기기에만 저장돼요');
 for(const x of [g,b,c]){expect(x.errors).toEqual([]);await x.ctx.close();}
});

test('with no copy of the shared notebook on this phone, a failed connection falls back to this device and says so',async({browser},testInfo)=>{
 const server=fakeServer();
 const {ctx,page,errors}=await openCloud(browser,testInfo,server,{seed:SEED,path:'/index.html?code=groom'});
 await expect(status(page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');
 await ctx.unroute(API+'/**');await ctx.route(API+'/**',r=>r.abort());
 await page.evaluate(()=>Object.keys(localStorage).filter(key=>key==='wd-cloud-cache'||key.startsWith('wd-cloud-cache:')).forEach(key=>localStorage.removeItem(key)));
 await page.reload();
 await expect(status(page)).toHaveText('함께 쓰기에 연결하지 못했어요. 이 기기에만 저장해요.');
 await expect(page.locator('#hero')).toContainText('준호');
 expect(errors.filter(e=>!/Failed to fetch|ERR_FAILED|net::/.test(e))).toEqual([]);
 await ctx.close();
});

const shared=s=>Object.values(s.db.plans)[0];
async function couple(browser,testInfo,server){
 const g=await openCloud(browser,testInfo,server,{seed:SEED,path:'/index.html?code=groom'});
 await expect(status(g.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');
 await g.page.locator('#openShare').click();await g.page.locator('#cloudSec [data-cloud="invite"]').click();
 const link=(await g.page.locator('#cloudInvite').inputValue()).replace('http://127.0.0.1:4173','');await g.page.locator('#closeShare').click();
 const b=await openCloud(browser,testInfo,server,{path:link+'&code=bride'});
 await expect(status(b.page)).toHaveText('둘이 함께 저장돼요');
 return {g,b,link};
}

test('someone already keeping a shared notebook is asked before an invite link moves them, and can stay',async({browser},testInfo)=>{
 test.setTimeout(60000);
 const server=fakeServer();
 const {g,b,link}=await couple(browser,testInfo,server);
 // 수진 already logged in on her own phone with her own notebook, then taps 준호's link (e.g. sent by mistake).
 const s=await openCloud(browser,testInfo,server,{seed:{...SEED,groom:'',bride:'수진'},path:'/index.html?code=sujin'});
 await expect(status(s.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');
 const own=server.db.members.find(m=>m.user==='sujin').plan;
 await g.page.locator('#openShare').click();await g.page.locator('#cloudSec').waitFor();
 await s.page.goto(link);
 await expect(s.page.locator('#shareDlg')).toBeVisible();
 await expect(s.page.locator('#cloudSec')).toContainText('초대받은 수첩으로 옮길까요?');
 expect(server.db.members.find(m=>m.user==='sujin').plan).toBe(own);
 await expect(s.page).toHaveURL('http://127.0.0.1:4173/index.html');
 await s.page.locator('#cloudSec [data-cloud="stay"]').click();
 await expect(s.page.locator('#cloudSec')).toContainText('지금 수첩을 계속 써요.');
 expect(server.db.members.find(m=>m.user==='sujin').plan).toBe(own);
 await expect(s.page.locator('#hero')).toContainText('수진');
 // Choosing to move with a link that is already used is refused and she keeps her own.
 await s.page.goto(link);await s.page.locator('#cloudSec [data-cloud="join"]').click();
 await expect(s.page.locator('#cloudSec')).toContainText('초대 링크가 지났거나 이미 쓰였어요. 지금 수첩을 계속 써요.');
 expect(server.db.members.find(m=>m.user==='sujin').plan).toBe(own);
 // The bride re-opening the link she already used is asked, and moving keeps her where she is.
 await b.page.goto(link);await b.page.locator('#cloudSec [data-cloud="join"]').click();
 await expect(b.page.locator('#cloudSec')).toContainText('이미 이 수첩을 함께 쓰고 있어요.');
 for(const x of [g,b,s]){expect(x.errors).toEqual([]);await x.ctx.close();}
});

test('edits made while the connection is down survive closing the app and go up when it comes back, and the shared notebook still opens offline',async({browser},testInfo)=>{
 test.setTimeout(60000);
 const server=fakeServer();
 const {g,b}=await couple(browser,testInfo,server);
 const down=()=>b.ctx.route(API+'/**',r=>r.abort()),up=()=>b.ctx.unroute(API+'/**',r=>r.abort());
 // Tick while offline, then close the app before the connection returns.
 await b.ctx.unroute(API+'/**');await b.ctx.route(API+'/**',r=>r.abort());
 await b.page.locator('[data-act="toggle"][data-id="t12"]').click();
 await expect(status(b.page)).toHaveText('저장하지 못했어요. 다시 시도하는 중…');
 // Leaving the page (same as closing the app) before the connection returns.
 const p2=b.page;await b.ctx.route('**/leave.html',r=>r.fulfill({status:200,contentType:'text/html',body:'<p>다른 페이지</p>'}));await p2.goto('/leave.html');
 // Reopen while still offline: the shared notebook (not this phone's own old record) is shown, with the tick kept.
 await p2.goto('/index.html');
 await expect(status(p2)).toHaveText('연결 안 됨 · 고친 내용은 보관했다가 올려요');
 await expect(p2.locator('#hero')).toContainText('준호');
 await expect(p2.locator('[data-act="toggle"][data-id="t12"]')).toHaveAttribute('aria-checked','true');
 await p2.locator('[data-act="toggle"][data-id="t13"]').click();
 expect(shared(server).tasks.t12).toBeUndefined();
 // Connection back: both ticks reach the shared notebook and the partner's screen.
 await b.ctx.unroute(API+'/**');await b.ctx.route(API+'/**',r=>server.handle(r));
 await p2.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect.poll(()=>shared(server).tasks.t12&&shared(server).tasks.t13&&shared(server).tasks.t12.done&&shared(server).tasks.t13.done).toBe(true);
 await expect(g.page.locator('[data-act="toggle"][data-id="t13"]')).toHaveAttribute('aria-checked','true');
 await expect(status(p2)).toHaveText('둘이 함께 저장돼요');
 expect(await p2.evaluate(()=>localStorage.getItem('wd-cloud-pending'))).toBeNull();
 expect(await readPending(p2,'bride',server.db.members.find(m=>m.user==='bride').plan)).toBeNull();
 expect(g.errors).toEqual([]);expect(b.errors.filter(e=>!/Failed to fetch|ERR_FAILED|net::/.test(e))).toEqual([]);await g.ctx.close();await b.ctx.close();
});

test('a partner’s edit does not replace what someone is typing; once both stop, both screens show the saved text',async({browser},testInfo)=>{
 test.setTimeout(60000);
 const server=fakeServer();
 const {g,b}=await couple(browser,testInfo,server);
 for(const x of [g,b])await x.page.locator('[data-act="open"][data-id="t08"]').click();
 const bm=b.page.locator('[data-fk="memo-t08"]');await bm.click();await bm.pressSequentially('신부가 천천히',{delay:80});
 await g.page.locator('[data-fk="memo-t08"]').fill('신랑 수정');
 await expect.poll(()=>shared(server).tasks.t08?.memo).toBe('신랑 수정');
 await b.page.waitForTimeout(700);
 await expect(bm).toHaveValue('신부가 천천히');await expect(bm).toBeFocused();
 await bm.pressSequentially(' 쓰는 중',{delay:80});
 await expect.poll(()=>shared(server).tasks.t08?.memo).toBe('신부가 천천히 쓰는 중');
 await expect(g.page.locator('[data-fk="memo-t08"]')).toHaveValue('신부가 천천히 쓰는 중',{timeout:9000});
 // Both versions remain available after the typing has settled. Choosing the partner's text saves that choice.
 const choices=b.page.locator('[data-memo-choice-for="memo-t08"]');
 await expect(choices).toContainText('신부가 천천히 쓰는 중');await expect(choices).toContainText('신랑 수정');
 await choices.locator('[data-memo-choice="remote"]').click();
 await expect.poll(()=>shared(server).tasks.t08?.memo).toBe('신랑 수정');await expect(bm).toHaveValue('신랑 수정');
 await expect(choices).toHaveCount(0);
 for(const x of [g,b]){expect(x.errors).toEqual([]);await x.ctx.close();}
});

test('the plain app link never carries an invite code and says it does not share the notebook; warnings stay visible when scrolled',async({browser},testInfo)=>{
 const server=fakeServer();
 const g=await openCloud(browser,testInfo,server,{seed:SEED,path:'/index.html?code=groom'});
 await g.page.locator('#openShare').click();await g.page.locator('#cloudSec [data-cloud="invite"]').click();
 const link=(await g.page.locator('#cloudInvite').inputValue()).replace('http://127.0.0.1:4173','');await g.page.locator('#closeShare').click();
 const b=await openCloud(browser,testInfo,server,{path:link});
 await expect(b.page.locator('#shareDlg')).toBeVisible();
 await expect(b.page.locator('#shareLink')).toHaveValue('http://127.0.0.1:4173/index.html');
 await expect(b.page.locator('#shareText')).not.toHaveValue(/join=/);
 await expect(b.page.locator('#shareLinkTitle')).toHaveText('앱 주소만 보내기');
 await expect(b.page.locator('#shareLinkHint')).toContainText('각자 따로 기록해요');
 await b.page.locator('#closeShare').click();
 // A warning while the header is scrolled away appears at the bottom of the screen.
 await g.ctx.unroute(API+'/**');await g.ctx.route(API+'/**',r=>r.abort());
 await g.page.evaluate(()=>window.scrollTo(0,1500));
 await g.page.locator('#tab-timeline').evaluate(()=>{});
 await g.page.locator('[data-act="toggle"][data-id="t20"]').click();
 await expect(g.page.locator('#netBanner')).toBeVisible();await expect(g.page.locator('#netBanner')).toHaveText('저장하지 못했어요. 다시 시도하는 중…');
 await g.page.evaluate(()=>window.scrollTo(0,0));await expect(g.page.locator('#netBanner')).toBeHidden();
 for(const x of [g,b]){expect(x.errors.filter(e=>!/Failed to fetch|ERR_FAILED|net::/.test(e))).toEqual([]);await x.ctx.close();}
});

test('a save that succeeds keeps edits made meanwhile in the phone’s keep-list, and replayed old edits never overwrite newer typing',async({browser},testInfo)=>{
 test.setTimeout(60000);
 const server=fakeServer();
 const {g,b}=await couple(browser,testInfo,server);
 // Control the bride's network: cut it, or hold chosen requests so the timing is exact.
 const net={down:false,merge:null,select:null};const release={};
 await b.ctx.unroute(API+'/**');
 await b.ctx.route(API+'/**',async r=>{
  if(net.down)return r.abort();
  const path=new URL(r.request().url()).pathname;
  const kind=path==='/rpc/merge_plan'?'merge':path==='/select'&&JSON.parse(r.request().postData()||'{}').table==='plans'?'select':'';
  if(kind&&net[kind])await net[kind];
  return server.handle(r);
 });
 const hold=k=>{let p;p=new Promise(res=>{release[k]=()=>{if(net[k]===p)net[k]=null;res();};});net[k]=p;};
 const pendingKey=pendingKeyFor('bride',server.db.members.find(m=>m.user==='bride').plan);
 const pending=()=>b.page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),pendingKey);
 // 1) The first save is in flight; a second tick waits in the queue and is written down when the app is hidden.
 hold('merge');
 await b.page.locator('[data-act="toggle"][data-id="t30"]').click();
 await b.page.waitForTimeout(500);
 await b.page.locator('[data-act="toggle"][data-id="t31"]').click();
 await b.page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});});
 expect((await pending()).patch.tasks.t31.done).toBe(true);
 // Hold the follow-up save too, so the moment right after the first one is acknowledged can be inspected.
 // Sample the keep-list in the page every few ms from the moment the first save is acknowledged.
 await b.page.evaluate(key=>{window.__gap=false;window.__watch=setInterval(()=>{const p=JSON.parse(localStorage.getItem(key)||'null');if(!p||!p.patch.tasks||!p.patch.tasks.t31)window.__gap=true;},5);},pendingKey);
 const first=release.merge;hold('merge');first();
 await expect.poll(()=>shared(server).tasks.t30?.done).toBe(true);
 await b.page.waitForTimeout(400);
 expect(shared(server).tasks.t31).toBeUndefined();
 expect(await b.page.evaluate(()=>{clearInterval(window.__watch);return window.__gap;})).toBe(false);
 expect((await pending())?.patch?.tasks?.t31?.done).toBe(true);
 release.merge();
 await expect.poll(()=>shared(server).tasks.t31?.done).toBe(true);
 await expect.poll(pending).toBeNull();
 // 2) Offline, an old memo is kept. On reconnect, while the first snapshot is held, a tick's save is in flight and
 //    a newer memo waits behind it. Replaying the kept old memo must not overwrite the newer one.
 net.down=true;await b.page.reload();
 await expect(status(b.page)).toHaveText('연결 안 됨 · 고친 내용은 보관했다가 올려요');
 await b.page.locator('[data-act="open"][data-id="t06"]').click();
 await b.page.locator('[data-fk="memo-t06"]').fill('예전 메모');
 await expect.poll(async()=>(await pending())?.patch?.tasks?.t06?.memo).toBe('예전 메모');
 net.down=false;hold('select');hold('merge');
 await b.page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await b.page.waitForTimeout(400);
 await b.page.locator('[data-act="toggle"][data-id="t33"]').click();
 await b.page.waitForTimeout(500);
 await b.page.locator('[data-fk="memo-t06"]').fill('새 메모');
 await b.page.waitForTimeout(900);
 release.select();await b.page.waitForTimeout(400);
 release.merge();
 await expect.poll(()=>shared(server).tasks.t06?.memo,{timeout:8000}).toBe('새 메모');
 await b.page.waitForTimeout(1500);
 expect(shared(server).tasks.t06.memo).toBe('새 메모');expect(shared(server).tasks.t33.done).toBe(true);
 expect(g.errors).toEqual([]);expect(b.errors.filter(e=>!/Failed to fetch|ERR_FAILED|net::/.test(e))).toEqual([]);
 await g.ctx.close();await b.ctx.close();
});

async function openShareWhenClosed(page){
 if(!(await page.locator('#shareDlg').isVisible()))await page.locator('#openShare').click();
}
async function createNotebookInvite(client){
 await openShareWhenClosed(client.page);await client.page.locator('[data-cloud="invite"]').click();
 await expect(client.page.locator('#cloudInvite')).not.toHaveValue('');
 const link=await client.page.locator('#cloudInvite').inputValue();await client.page.locator('#closeShare').click();return link;
}
async function twoNotebooks(browser,testInfo,server,{existingInvite=false}={}){
 const g=await openCloud(browser,testInfo,server,{seed:SEED,path:'/index.html?code=groom'});
 await expect(status(g.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');
 const target=server.db.members.find(m=>m.user==='groom').plan;let link;
 if(existingInvite){server.db.invites.storedInvite01={plan:target,used:null,expires:Date.now()+86400000};link='http://127.0.0.1:4173/index.html?join=storedInvite01';}
 else link=await createNotebookInvite(g);
 const ownSeed=structuredClone(SEED);ownSeed.groom='';ownSeed.bride='수진';ownSeed.tasks.t09={memo:'이전 수첩의 메모'};
 const s=await openCloud(browser,testInfo,server,{seed:ownSeed,path:'/index.html?code=sujin'});
 await expect(status(s.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');
 const own=server.db.members.find(m=>m.user==='sujin').plan;
 return {g,s,own,target,link};
}

test('joining preserves the previous notebook, switching keeps edits separate and reopening remembers the selected notebook',async({browser},testInfo)=>{
 test.setTimeout(60000);
 const server=fakeServer();const {g,s,own,target,link}=await twoNotebooks(browser,testInfo,server);
 await s.page.goto(link);await expect(s.page.locator('[data-cloud="join"]')).toBeVisible();
 expect(server.db.members.filter(m=>m.user==='sujin').map(m=>m.plan)).toEqual([own]);
 await s.page.locator('[data-cloud="stay"]').click();await expect(s.page.locator('#hero')).toContainText('수진');
 expect(server.db.invites[new URL(link).searchParams.get('join')].used).toBeNull();
 await s.page.goto(link);await s.page.locator('[data-cloud="join"]').click();await expect(status(s.page)).toHaveText('둘이 함께 저장돼요');
 expect(server.db.members.filter(m=>m.user==='sujin').map(m=>m.plan).sort()).toEqual([own,target].sort());
 expect(server.db.plans[own].tasks.t09.memo).toBe('이전 수첩의 메모');
 await openShareWhenClosed(s.page);await s.page.locator(`[data-cloud="switch"][data-plan="${own}"]`).click();
 await expect(status(s.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');await expect(s.page.locator('#hero')).toContainText('수진');
 await s.page.reload();await expect(status(s.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');await expect(s.page.locator('#hero')).toContainText('수진');
 await s.page.locator('[data-act="open"][data-id="t09"]').click();await s.page.locator('[data-fk="memo-t09"]').fill('내 수첩만 고침');
 await expect.poll(()=>server.db.plans[own].tasks.t09.memo).toBe('내 수첩만 고침');expect(server.db.plans[target].tasks.t09).toBeUndefined();
 await openShareWhenClosed(s.page);await s.page.locator(`[data-cloud="switch"][data-plan="${target}"]`).click();
 await expect(status(s.page)).toHaveText('둘이 함께 저장돼요');await expect(s.page.locator('#hero')).toContainText('준호');
 await s.page.reload();await expect(status(s.page)).toHaveText('둘이 함께 저장돼요');await expect(s.page.locator('#hero')).toContainText('준호');
 expect(server.db.members.filter(m=>m.plan===target)).toHaveLength(2);expect(server.calls.filter(c=>c.op==='join_plan')).toEqual([]);
 for(const client of [g,s]){expect(client.errors).toEqual([]);await client.ctx.close();}
});

test('a server without the new SQL can read existing notebooks but never uses the destructive invitation RPC',async({browser},testInfo)=>{
 test.setTimeout(60000);
 const server=fakeServer({legacy:true});const {g,s,own,target,link}=await twoNotebooks(browser,testInfo,server,{existingInvite:true});
 await openShareWhenClosed(g.page);await expect(g.page.locator('[data-cloud="invite"]')).toHaveCount(0);await g.page.locator('#closeShare').click();
 await s.page.goto(link);await expect(cloudSec(s.page)).toContainText(/서버.*업데이트|업데이트.*필요/);
 await expect(s.page.locator('[data-cloud="join"]')).toHaveCount(0);
 await expect(s.page.locator('#hero')).toContainText('수진');expect(server.db.members.filter(m=>m.user==='sujin').map(m=>m.plan)).toEqual([own]);
 const fresh=await openCloud(browser,testInfo,server,{path:link+'&code=newcomer'});
 await expect(status(fresh.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');await expect(cloudSec(fresh.page)).toContainText(/서버.*업데이트|업데이트.*필요/);
 expect(server.db.members.filter(m=>m.plan===target)).toHaveLength(1);expect(server.db.invites[new URL(link).searchParams.get('join')].used).toBeNull();
 expect(server.calls.filter(c=>c.op==='join_plan')).toEqual([]);
 for(const client of [g,s,fresh]){expect(client.errors).toEqual([]);await client.ctx.close();}
});

test('a failed pending save blocks notebook switching until the original notebook has received it',async({browser},testInfo)=>{
 test.setTimeout(60000);
 const server=fakeServer();const {g,s,own,target,link}=await twoNotebooks(browser,testInfo,server);
 await s.page.goto(link);await s.page.locator('[data-cloud="join"]').click();await expect(status(s.page)).toHaveText('둘이 함께 저장돼요');
 await openShareWhenClosed(s.page);await s.page.locator(`[data-cloud="switch"][data-plan="${own}"]`).click();await expect(status(s.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');
 // Reads stay available: only this participant's writes fail.
 await s.ctx.route(API+'/rpc/merge_plan',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:null,error:{code:'XX000',message:'temporary server failure'}})}));
 await s.page.locator('[data-act="open"][data-id="t09"]').click();await s.page.locator('[data-fk="memo-t09"]').fill('전환 전에 지켜야 할 메모');
 await expect(status(s.page)).toHaveText('저장하지 못했어요. 다시 시도하는 중…');
 await openShareWhenClosed(s.page);await s.page.locator(`[data-cloud="switch"][data-plan="${target}"]`).click();
 await expect(cloudSec(s.page)).toContainText('현재 수첩에 아직 보내지 못한 수정이 있어요',{timeout:7000});
 await expect(s.page.locator('#hero')).toContainText('수진');expect(server.db.plans[target].tasks.t09).toBeUndefined();
 expect((await readPending(s.page,'sujin',own)).patch.tasks.t09.memo).toBe('전환 전에 지켜야 할 메모');
 await s.ctx.unroute(API+'/rpc/merge_plan');await s.page.locator(`[data-cloud="switch"][data-plan="${target}"]`).click();
 await expect(status(s.page)).toHaveText('둘이 함께 저장돼요');expect(server.db.plans[own].tasks.t09.memo).toBe('전환 전에 지켜야 할 메모');expect(server.db.plans[target].tasks.t09).toBeUndefined();
 for(const client of [g,s]){expect(client.errors).toEqual([]);await client.ctx.close();}
});

test('choosing my memo draft preserves it on the server and after reopening',async({browser},testInfo)=>{
 test.setTimeout(60000);
 const server=fakeServer();const {g,b}=await couple(browser,testInfo,server);
 for(const client of [g,b])await client.page.locator('[data-act="open"][data-id="t08"]').click();
 await b.page.locator('[data-fk="memo-t08"]').fill('내가 쓰던 초안');
 await expect.poll(()=>shared(server).tasks.t08?.memo).toBe('내가 쓰던 초안');
 await g.page.locator('[data-fk="memo-t08"]').fill('상대가 저장한 메모');
 await expect.poll(()=>shared(server).tasks.t08?.memo).toBe('상대가 저장한 메모');
 const choices=b.page.locator('[data-memo-choice-for="memo-t08"]');
 await expect(choices).toContainText('내가 쓰던 초안');await expect(choices).toContainText('상대가 저장한 메모');
 await choices.locator('[data-memo-choice="mine"]').click();
 await expect.poll(()=>shared(server).tasks.t08?.memo).toBe('내가 쓰던 초안');await expect(choices).toHaveCount(0);
 await b.page.reload();await expect(status(b.page)).toHaveText('둘이 함께 저장돼요');
 await b.page.locator('[data-act="open"][data-id="t08"]').click();await expect(b.page.locator('[data-fk="memo-t08"]')).toHaveValue('내가 쓰던 초안');
 await expect(b.page.locator('[data-memo-choice-for="memo-t08"]')).toHaveCount(0);
 for(const client of [g,b]){expect(client.errors).toEqual([]);await client.ctx.close();}
});

test('two tabs of the same account keep different offline notebooks and replay each patch only to its own notebook',async({browser},testInfo)=>{
 test.setTimeout(60000);
 const server=fakeServer();const {g,s,own,target,link}=await twoNotebooks(browser,testInfo,server);
 await s.page.goto(link);await s.page.locator('[data-cloud="join"]').click();await expect(status(s.page)).toHaveText('둘이 함께 저장돼요');
 const ownPage=await s.ctx.newPage();
 ownPage.on('pageerror',e=>s.errors.push(e.message));ownPage.on('console',m=>{if(m.type()==='error')s.errors.push(m.text());});
 await ownPage.clock.setFixedTime(new Date('2026-10-06T03:00:00Z'));await ownPage.goto('/index.html');
 await expect(status(ownPage)).toHaveText('둘이 함께 저장돼요');await openShareWhenClosed(ownPage);
 await ownPage.locator(`[data-cloud="switch"][data-plan="${own}"]`).click();await expect(status(ownPage)).toHaveText('혼자 쓰는 중 · 공유에서 초대');
 // Each tab remembers its own selection even though localStorage is shared.
 await s.ctx.unroute(API+'/**');await s.ctx.route(API+'/**',r=>r.abort());
 for(const page of [s.page,ownPage]){await page.reload();await expect(status(page)).toHaveText('연결 안 됨 · 고친 내용은 보관했다가 올려요');}
 await expect(s.page.locator('#hero')).toContainText('준호');await expect(ownPage.locator('#hero')).toContainText('수진');
 for(const [page,value] of [[s.page,'함께 쓰는 수첩의 오프라인 메모'],[ownPage,'내 수첩의 오프라인 메모']]){
  await page.locator('[data-act="open"][data-id="t09"]').click();await page.locator('[data-fk="memo-t09"]').fill(value);
 }
 await expect.poll(async()=>(await readPending(s.page,'sujin',target))?.patch?.tasks?.t09?.memo).toBe('함께 쓰는 수첩의 오프라인 메모');
 await expect.poll(async()=>(await readPending(ownPage,'sujin',own))?.patch?.tasks?.t09?.memo).toBe('내 수첩의 오프라인 메모');
 expect(server.db.plans[target].tasks.t09).toBeUndefined();expect(server.db.plans[own].tasks.t09.memo).toBe('이전 수첩의 메모');
 // Reload both while still offline: neither loses its patch or borrows the other tab's notebook.
 for(const [page,value] of [[s.page,'함께 쓰는 수첩의 오프라인 메모'],[ownPage,'내 수첩의 오프라인 메모']]){
  await page.reload();await expect(status(page)).toHaveText('연결 안 됨 · 고친 내용은 보관했다가 올려요');
  await page.locator('[data-act="open"][data-id="t09"]').click();await expect(page.locator('[data-fk="memo-t09"]')).toHaveValue(value);
 }
 await s.ctx.unroute(API+'/**');await s.ctx.route(API+'/**',r=>server.handle(r));
 await Promise.all([s.page,ownPage].map(page=>page.evaluate(()=>window.dispatchEvent(new Event('online')))));
 await expect.poll(()=>server.db.plans[target].tasks.t09?.memo).toBe('함께 쓰는 수첩의 오프라인 메모');
 await expect.poll(()=>server.db.plans[own].tasks.t09?.memo).toBe('내 수첩의 오프라인 메모');
 await expect.poll(()=>readPending(s.page,'sujin',target)).toBeNull();await expect.poll(()=>readPending(ownPage,'sujin',own)).toBeNull();
 expect(server.db.plans[target].groom).toBe('준호');expect(server.db.plans[own].bride).toBe('수진');
 expect(g.errors).toEqual([]);expect(s.errors.filter(e=>!/Failed to fetch|ERR_FAILED|net::/.test(e))).toEqual([]);
 await g.ctx.close();await s.ctx.close();
});

test('legacy pending edits migrate only after membership is verified and do not replace newer scoped edits',async({browser},testInfo)=>{
 const server=fakeServer();const g=await openCloud(browser,testInfo,server,{seed:SEED,path:'/index.html?code=groom'});
 await expect(status(g.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');const plan=server.db.members.find(m=>m.user==='groom').plan;
 await g.page.evaluate(({plan,key})=>{
  localStorage.setItem('wd-cloud-pending',JSON.stringify({planId:plan,patch:{tasks:{t15:{done:true},t16:{memo:'이전 저장 방식'}}}}));
  localStorage.setItem(key,JSON.stringify({planId:plan,patch:{tasks:{t16:{memo:'나중에 수정한 메모'}}}}));
 },{plan,key:pendingKeyFor('groom',plan)});
 await g.page.reload();await expect(status(g.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');
 await expect.poll(()=>server.db.plans[plan].tasks.t15?.done).toBe(true);await expect.poll(()=>server.db.plans[plan].tasks.t16?.memo).toBe('나중에 수정한 메모');
 expect(await g.page.evaluate(()=>localStorage.getItem('wd-cloud-pending'))).toBeNull();await expect.poll(()=>readPending(g.page,'groom',plan)).toBeNull();
 // A legacy record for a notebook this account cannot open must never be sent to the current notebook.
 await g.page.evaluate(()=>localStorage.setItem('wd-cloud-pending',JSON.stringify({planId:'other-person',patch:{tasks:{t18:{done:true}}}})));
 await g.page.reload();await expect(status(g.page)).toHaveText('혼자 쓰는 중 · 공유에서 초대');
 expect(server.db.plans[plan].tasks.t18).toBeUndefined();
 expect(await g.page.evaluate(()=>JSON.parse(localStorage.getItem('wd-cloud-pending')).planId)).toBe('other-person');
 expect(server.calls.filter(c=>c.op==='merge_plan'&&c.args.p_id==='other-person')).toEqual([]);
 expect(g.errors).toEqual([]);await g.ctx.close();
});

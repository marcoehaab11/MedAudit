import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve('frontend/dental-clinic-app/dist/dental-clinic-app/browser');
const out=path.resolve('tmp/frontend-shell-qa');
fs.mkdirSync(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const permissions=['Patients.View','Patients.Create','Doctors.View','Appointments.View','Appointments.Create','TreatmentPlans.View','Treatments.View','Prescriptions.View','TreatmentCatalog.View','Finance.View','Finance.Revenue.View','Finance.Payments.View','Finance.Expenses.View','Finance.Categories.View','CRM.View','Lab.View','Insurance.View','Inventory.View','Settings.PublicBooking','Notifications.View','Reports.View','Users.View','Settings.View','Backup.Create'];
let allowed=permissions;
const clinics=[{tenantId:'qa-clinic',name:'Garden Dental Clinic',accessible:true}];
const session=()=>({expiresAt:'2099-01-01T00:00:00Z',userId:'qa-user',displayName:'Dr. Sara Ahmed',roles:['ClinicAdmin'],permissions:allowed,tenantId:'qa-clinic',tenantName:clinics[0].name,clinics});
const patients=[{id:'patient-1',patientNumber:'PT-001',fullName:'Mona Hassan',phone:'01000000001',email:'mona@example.test',gender:1,status:1,createdAt:'2026-11-10T10:00:00Z'},{id:'patient-2',patientNumber:'PT-002',fullName:'Omar Mohamed Abdelrahman',phone:'01000000002',email:'omar@example.test',gender:2,status:1,createdAt:'2026-11-09T10:00:00Z'},{id:'patient-3',patientNumber:'PT-003',fullName:'ليلى أحمد عبدالرحمن',phone:'01000000003',email:null,gender:1,status:1,createdAt:'2026-11-08T10:00:00Z'}];
let patientMode='normal'; const apiLog=[],unexpected=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')) {
   apiLog.push(url.pathname+url.search);
   let result;
   if(url.pathname==='/api/auth/session')result=session();
   else if(url.pathname==='/api/auth/permissions')result=allowed;
   else if(url.pathname==='/api/auth/clinics')result=clinics;
   else if(url.pathname==='/api/branches/theme')result={primaryColor:'#087b68',secondaryColor:'#0d9488',accentColor:'#f59e0b',canManage:true};
   else if(url.pathname==='/api/patients'){
     if(patientMode==='error'){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({title:'Synthetic service failure'}));return;}
     let items=patientMode==='empty'?[]:patients.filter(p=>!url.searchParams.get('search')||p.fullName.toLowerCase().includes(url.searchParams.get('search').toLowerCase()));
     if(url.searchParams.get('gender'))items=items.filter(p=>p.gender===Number(url.searchParams.get('gender')));
     result={items,page:1,pageSize:50,totalCount:items.length,totalPages:items.length?1:0};
   }
   else if(url.pathname==='/api/doctors/lookup')result=[{id:'doctor-1',displayName:'Dr. Sara Ahmed'}];
   else if(url.pathname==='/api/finance/billing-queue')result=[];
   else if(url.pathname==='/api/appointments'){
     const date=(url.searchParams.get('from')||'2026-11-11').slice(0,10);
     const item={id:'appointment-1',patientId:'patient-1',patientName:'Mona Hassan',doctorProfileId:'doctor-1',doctorName:'Dr. Sara Ahmed',type:1,status:1,startAt:date+'T09:00:00Z',endAt:date+'T10:00:00Z',durationMinutes:60,timeZone:'UTC'};
     result={page:{items:[item],page:1,pageSize:250,totalCount:1,totalPages:1},timeZone:'UTC'};
   } else {unexpected.push(url.pathname);res.writeHead(404,{'Content-Type':'application/json'});res.end('{}');return;}
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
 }
 let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(5321,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'planora-shell-qa-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try {
 const portFile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<100&&!fs.existsSync(portFile);i++)await pause(100);
 const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
 const version=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();
 ws=new WebSocket(version.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let serial=0,sessionId;const pending=new Map(),exceptions=[],networkFailures=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);else if(m.method==='Network.loadingFailed')networkFailures.push(m.params);};
 const send=(method,params={},browser=false)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(!browser&&sessionId?{sessionId}:{})}));});
 const target=await send('Target.createTarget',{url:'about:blank'},true);
 sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},true)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}console.log(await evaluate(`JSON.stringify({focusCalls:window.focusCalls,active:document.activeElement?.outerHTML?.slice(0,500),open:!!document.querySelector('.mobile-open'),sidebar:document.querySelector('.sidebar')?.outerHTML?.slice(0,450),visibility:document.querySelector('.sidebar')&&getComputedStyle(document.querySelector('.sidebar')).visibility,rect:document.querySelector('.sidebar')?.getBoundingClientRect().toJSON()})`));await shot('timeout');throw Error('Timed out: '+expression);};
 const click=async selector=>{const pos=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);if(!e.contains(hit))throw Error('Control obstructed: '+e.className+' by '+hit?.outerHTML?.slice(0,160));return{x,y}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos});await pause(150);};
 const key=async(key,code,modifiers=0)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:code||key,modifiers});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:code||key,modifiers});await pause(80);};
 const viewport=async(width,height=900)=>{await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(250);};
 const shot=async name=>{await evaluate('document.fonts.ready');await pause(250);const data=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.data,'base64'));};
 const navigate=async route=>{await send('Page.navigate',{url:'http://127.0.0.1:5321'+route});await wait("document.querySelector('.workspace-filters') && !document.querySelector('.workspace-results[aria-busy=\"true\"]')");await pause(200);};
 const noOverflow=async()=>{const info=await evaluate(`(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && r.right>innerWidth+1 && !e.closest('.sidebar') && getComputedStyle(e).position!=='fixed'}).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,rect:e.getBoundingClientRect().toJSON()}))}))()`);if(info.scroll>info.width+1){console.log(JSON.stringify(info,null,2));await shot('overflow-'+info.width);throw Error('Page horizontal overflow');}};
 const setLanguage=async lang=>{if(await evaluate('document.documentElement.lang')!==lang){await click('.lang-btn');await wait(`document.documentElement.lang===${JSON.stringify(lang)}`);}};
 await viewport(1440);await navigate('/patients');await setLanguage('en');
 assert.equal(await evaluate("document.querySelectorAll('tbody tr').length"),3);
 assert.equal(await evaluate("document.querySelectorAll('.sidebar [aria-current=page]').length"),1);
 await noOverflow();await shot('patients-desktop-en');
 await click('.collapse-btn');await wait("document.querySelector('.app-shell.collapsed')");
 await evaluate("document.querySelector('.sidebar a[href=\"/patients\"]').focus()");await wait("!!document.querySelector('.nav-tooltip')");
 assert.ok(await evaluate("document.querySelector('.nav-tooltip').textContent.includes('Patients')"));
 assert.ok(await evaluate("document.querySelector('.collapse-btn').getClientRects().length>0 && document.querySelector('.signout-btn').getClientRects().length>0"));
 await shot('sidebar-collapsed-en');
 await send('Page.reload');await wait("document.querySelector('.app-shell.collapsed') && document.querySelector('tbody tr')");
 await click('.collapse-btn');
 // Filter submission and reset preserve the current server contract.
 await evaluate("(()=>{const e=document.querySelector('input[type=search]');e.value='Mona';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await click('.filter-actions button[type=submit]');await wait("document.querySelectorAll('tbody tr').length===1");
 await click('.filter-reset');await wait("document.querySelectorAll('tbody tr').length===3");
 for(const width of [1024,768,390,320]){await viewport(width,844);await noOverflow();if(width===390)await shot('patients-mobile-en');}
 await viewport(390,844);await evaluate(`(()=>{window.focusCalls=[];const focus=HTMLElement.prototype.focus;HTMLElement.prototype.focus=function(...args){window.focusCalls.push({cls:this.className,inert:this.closest('[inert]')?.className,visibility:getComputedStyle(this).visibility});return focus.apply(this,args)}})()`);await click('.mobile-menu-btn');await wait("document.querySelector('.sidebar [aria-label=\"Close navigation\"]')===document.activeElement");
 assert.ok(await evaluate("document.querySelector('.main-area').inert && document.body.style.overflow==='hidden'"));
 await shot('sidebar-mobile-en');
 await evaluate("document.querySelector('.sidebar-brand').focus()");await key('Tab','Tab',8);assert.ok(await evaluate("document.activeElement===document.querySelector('.signout-btn')"),'Reverse focus wraps within drawer');
 await key('Tab','Tab');assert.ok(await evaluate("document.activeElement===document.querySelector('.sidebar-brand')"),'Forward focus wraps within drawer');
 await key('Escape');await wait("!document.querySelector('.app-shell.mobile-open')");
 assert.ok(await evaluate("document.activeElement===document.querySelector('.mobile-menu-btn') && !document.querySelector('.main-area').inert"));
 await click('.mobile-menu-btn');await pause(250);await click('#nav-heading-finance');assert.equal(await evaluate("document.querySelector('#nav-heading-finance').getAttribute('aria-expanded')"),'true');
 await key('Escape');
 await setLanguage('ar');await noOverflow();await shot('patients-mobile-ar');
 await click('.mobile-menu-btn');await shot('sidebar-mobile-ar');await key('Escape');
 await viewport(1440);await noOverflow();await shot('patients-desktop-ar');
 assert.equal(await evaluate("Math.round(document.querySelector('.sidebar').getBoundingClientRect().right)"),1440);
 assert.equal(await evaluate("Math.round(document.querySelector('.main-area').getBoundingClientRect().right)"),1180);
 // Empty and recoverable failure are distinct.
 patientMode='empty';await click('.filter-actions button[type=submit]');await wait("document.querySelector('.empty')?.textContent.includes('لا يوجد مرضى')");await shot('patients-empty-ar');
 patientMode='error';await click('.filter-actions button[type=submit]');await wait("document.querySelector('.empty')?.textContent.includes('تعذر عرض دليل المرضى')");await shot('patients-error-ar');
 patientMode='normal';await click('.empty button');await wait("document.querySelectorAll('tbody tr').length===3");
 await navigate('/appointments');await setLanguage('en');await wait("!!document.querySelector('.timeline-card')");await noOverflow();await shot('appointments-desktop-en');
 await click('.view-toggle button:nth-child(2)');assert.equal(await evaluate("document.querySelector('.view-toggle button:nth-child(2)').getAttribute('aria-pressed')"),'true');
 await viewport(390,844);await noOverflow();await shot('appointments-mobile-en');await setLanguage('ar');await noOverflow();await shot('appointments-mobile-ar');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 assert.ok(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"));
 // A restricted role sees no empty management groups after restoring its server session.
 allowed=['Patients.View'];await navigate('/patients');
 assert.ok(await evaluate("!document.querySelector('#nav-heading-finance') && !document.querySelector('.sidebar a[href=\"/doctors\"]')"));
 assert.equal(unexpected.length,0,'Unmocked API request: '+unexpected.join(','));
 assert.equal(exceptions.length,0,'Browser exceptions: '+JSON.stringify(exceptions));
 const result={passed:true,viewports:[1440,1024,768,390,320],languages:['en','ar'],checks:['permission-aware navigation','exact active destination','collapse persistence','collapsed labels/controls','filter submission/reset','mobile background isolation','focus entry/wrap/restore','Escape close','group expand','RTL geometry','empty/error/retry','calendar view toggle','reduced motion'],unexpectedApi:unexpected,browserExceptions:exceptions,networkFailures:networkFailures.map(x=>({error:x.errorText,blocked:x.blockedReason})),data:'Synthetic local API fixtures; live backend not exercised',screenshots:fs.readdirSync(out).filter(x=>x.endsWith('.png')&&!/^(overflow-|timeout|finance-expanded)/.test(x))};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally { if(ws)ws.close();chrome.kill();await new Promise(r=>server.close(r)); }

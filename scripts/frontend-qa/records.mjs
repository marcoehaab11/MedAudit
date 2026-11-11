import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve('frontend/dental-clinic-app/dist/dental-clinic-app/browser');
const out=path.resolve('tmp/frontend-plans-qa');
fs.mkdirSync(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const permissions=['Patients.View','Patients.Create','Doctors.View','Appointments.View','Appointments.Create','TreatmentPlans.View','Treatments.View','Prescriptions.View','TreatmentCatalog.View','Finance.View','Finance.Revenue.View','Finance.Payments.View','Finance.Expenses.View','Finance.Categories.View','CRM.View','Lab.View','Insurance.View','Inventory.View','Settings.PublicBooking','Notifications.View','Reports.View','Users.View','Settings.View','Backup.Create'];
permissions.push('Doctors.Create','Doctors.Edit','Doctors.Archive','TreatmentPlans.Create','TreatmentPlans.Edit','TreatmentPlans.Propose','TreatmentPlans.Accept','TreatmentPlans.Reject','TreatmentPlans.Cancel');let allowed=permissions;
const clinics=[{tenantId:'qa-clinic',name:'Garden Dental Clinic',accessible:true}];
const session=()=>({expiresAt:'2099-01-01T00:00:00Z',userId:'qa-user',displayName:'Dr. Sara Ahmed',roles:['ClinicAdmin'],permissions:allowed,tenantId:'qa-clinic',tenantName:clinics[0].name,clinics});
const patients=[{id:'patient-1',patientNumber:'PT-001',fullName:'Mona Hassan',phone:'01000000001',email:'mona@example.test',gender:1,status:1,createdAt:'2026-11-10T10:00:00Z'},{id:'patient-2',patientNumber:'PT-002',fullName:'Omar Mohamed Abdelrahman',phone:'01000000002',email:'omar@example.test',gender:2,status:1,createdAt:'2026-11-09T10:00:00Z'},{id:'patient-3',patientNumber:'PT-003',fullName:'ليلى أحمد عبدالرحمن',phone:'01000000003',email:null,gender:1,status:1,createdAt:'2026-11-08T10:00:00Z'}];
let patientMode='normal',doctorFailure=false,planFailure=false,listFailure=false,catalogFailure=false,saveScheduleError=false,writeError=false,conflict=false,readOnly=false,planVersion='v1'; const apiLog=[],unexpected=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')) {
   apiLog.push(url.pathname+url.search);res.setHeader('Content-Type','application/json');
   const fail=code=>{res.writeHead(code);res.end('{}');};
   const doctor={id:'doctor-1',clinicUserId:'user-1',displayName:'Dr. Sara Ahmed',email:'sara@example.test',phone:'+201000000001',specialization:'General dentistry and restorative care',licenseNumber:'DEN-1234',status:1,accountStatus:2,bio:'Preventive and restorative dental care.',consultationDurationMinutes:30,createdAt:'2026-11-01T10:00:00Z',updatedAt:'2026-11-10T12:00:00Z',canManageSchedule:!readOnly,canManageCompensation:!readOnly};
   const item={id:'item-1',catalogItemId:'catalog-1',treatmentName:'Composite restoration',toothNumber:16,quantity:1,unitPrice:100,discountAmount:0,total:100};
   const plan={id:'plan-1',patientId:'patient-1',patientName:'Mona Hassan',doctorProfileId:'doctor-1',doctorName:'Dr. Sara Ahmed',title:'Restorative care plan',notes:'Existing notes',status:1,subtotal:100,discountAmount:0,total:100,createdAt:'2026-11-01T10:00:00Z',updatedAt:'2026-11-10T12:00:00Z',version:planVersion,items:[item]};
   let result;
   if(url.pathname==='/api/auth/session')result=session();
   else if(url.pathname==='/api/auth/permissions')result=allowed;
   else if(url.pathname==='/api/auth/clinics')result=clinics;
   else if(url.pathname==='/api/branches/theme')result={primaryColor:'#087b68',secondaryColor:'#0d9488',accentColor:'#f59e0b',canManage:true};
   else if(url.pathname==='/api/patients'){result={items:patients,page:1,pageSize:50,totalCount:3,totalPages:1};}
   else if(url.pathname==='/api/doctors/candidates')result=[{clinicUserId:'candidate-1',displayName:'Dr. Omar',email:'omar@example.test'}];
   else if(url.pathname==='/api/roles')result=[{id:'role-1',name:'Doctor',permissions:[]}];
   else if(url.pathname==='/api/doctors/lookup')result=[doctor];
   else if(url.pathname==='/api/doctors/doctor-1'){
     if(req.method==='PUT'){if(writeError)return fail(403);res.writeHead(204);res.end();return;}
     if(doctorFailure)return fail(503);result=doctor;
   }
   else if(url.pathname==='/api/doctors/doctor-1/schedule'){
     if(req.method==='PUT'){if(saveScheduleError)return fail(403);res.writeHead(204);res.end();return;}
     result=[{dayOfWeek:1,startTime:'09:00',endTime:'17:00',slotDurationMinutes:30,breaks:[{startTime:'13:00',endTime:'14:00'}]}];
   }
   else if(url.pathname==='/api/doctors/doctor-1/compensation')result=[{id:'comp-1',compensationType:1,fixedAmount:1000,effectiveFrom:'2026-11-01',createdAt:'2026-11-01T10:00:00Z'}];
   else if(url.pathname==='/api/doctors'){
     const items=url.searchParams.get('search')?.includes('missing')?[]:[doctor];result={items,page:1,pageSize:50,totalCount:items.length,totalPages:1};
   }
   else if(url.pathname==='/api/treatment-catalog'){
     if(catalogFailure)return fail(503);
     result=[{id:'catalog-1',type:1,code:'REST-1',name:'Composite restoration',isActive:true,defaultPrice:100,description:JSON.stringify({nameEn:'Composite restoration',nameAr:'ترميم تجميلي',priceTiers:[{id:'standard',nameEn:'Standard',nameAr:'أساسي',price:100},{id:'premium',nameEn:'Premium',nameAr:'مميز',price:200}]})}];
   }
   else if(url.pathname==='/api/treatment-plans/plan-1'){
     if(req.method==='PUT'){if(writeError)return fail(403);res.writeHead(204);res.end();return;}
     if(planFailure)return fail(503);result=plan;
   }
   else if(url.pathname==='/api/treatment-plans/plan-1/propose'){
     if(conflict)return fail(409);res.writeHead(204);res.end();return;
   }
   else if(url.pathname==='/api/treatment-plans'){
     if(req.method==='POST'){if(writeError)return fail(403);result={id:'plan-1'};}
     else {if(listFailure)return fail(503);result={items:[plan],page:Number(url.searchParams.get('page')||1),pageSize:20,totalCount:21,totalPages:2};}
   }
   else {unexpected.push(url.pathname);return fail(404);}
   res.writeHead(200);res.end(JSON.stringify(result));return;
 }
 let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(5323,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'planora-plans-qa-'));
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
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Page.bringToFront');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}console.log(await evaluate(`JSON.stringify({focusCalls:window.focusCalls,active:document.activeElement?.outerHTML?.slice(0,500),open:!!document.querySelector('.mobile-open'),sidebar:document.querySelector('.sidebar')?.outerHTML?.slice(0,450),visibility:document.querySelector('.sidebar')&&getComputedStyle(document.querySelector('.sidebar')).visibility,rect:document.querySelector('.sidebar')?.getBoundingClientRect().toJSON()})`));await shot('timeout');throw Error('Timed out: '+expression);};
 const click=async selector=>{const pos=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);if(!e.contains(hit))throw Error('Control obstructed: '+e.className+' by '+hit?.outerHTML?.slice(0,160));return{x,y}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos});await pause(150);};
 const key=async(key,code,modifiers=0)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:code||key,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{}),windowsVirtualKeyCode:({Enter:13,Tab:9,' ':32,Escape:27})[key]||0,modifiers});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:code||key,windowsVirtualKeyCode:({Enter:13,Tab:9,' ':32,Escape:27})[key]||0,modifiers});await pause(80);};
 const viewport=async(width,height=900)=>{await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(250);};
 const shot=async name=>{await evaluate('document.fonts.ready');await pause(250);const data=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.data,'base64'));};
 const navigate=async route=>{await send('Page.navigate',{url:'http://127.0.0.1:5323'+route});await wait("document.querySelector('.workspace-filters') && !document.querySelector('.workspace-results[aria-busy=\"true\"]')");await pause(200);};
 const noOverflow=async()=>{const info=await evaluate(`(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && r.right>innerWidth+1 && !e.closest('.sidebar') && getComputedStyle(e).position!=='fixed'}).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,rect:e.getBoundingClientRect().toJSON()}))}))()`);if(info.scroll>info.width+1){console.log(JSON.stringify(info,null,2));await shot('overflow-'+info.width);throw Error('Page horizontal overflow');}};
 const setLanguage=async lang=>{if(await evaluate('document.documentElement.lang')!==lang){await click('.lang-btn');await wait(`document.documentElement.lang===${JSON.stringify(lang)}`);}};


 const goto=async(route,ready)=>{await send('Page.navigate',{url:'http://127.0.0.1:5323'+route});await wait(ready);await evaluate('document.fonts.ready');await pause(200);};
 const setValue=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
 const responsive=async(name)=>{await viewport(1440);await setLanguage('en');await evaluate('window.scrollTo(0,0)');await noOverflow();await shot(name+'-desktop-en');await setLanguage('ar');await noOverflow();await shot(name+'-desktop-ar');for(const width of [1024,768,390,320]){await viewport(width,844);await noOverflow();if(width===390)await shot(name+'-mobile-ar');}};
 {
 await viewport(1440);await goto('/doctors',"document.querySelector('.doctor-directory tbody tr')");await responsive('doctors');
 await setValue('[formcontrolname=search]','missing');await click('.filter-actions button[type=submit]');await wait("!document.querySelector('tbody tr') && !document.querySelector('.workspace-results[aria-busy=true]')");
 await click('.filter-reset');await wait("!!document.querySelector('tbody tr')");
 await goto('/doctors/create',"!!document.querySelector('.mode-card')");await responsive('doctor-create');
 await evaluate("document.querySelectorAll('.mode-card')[1].focus()");await key(' ','Space');await wait("!!document.querySelector('select[formcontrolname=clinicUserId]')");
 assert.equal(await evaluate("document.querySelectorAll('.mode-card')[1].getAttribute('aria-pressed')"),'true');
 await goto('/doctors/doctor-1/edit',"!!document.querySelector('[formcontrolname=displayName]')");await responsive('doctor-edit');
 writeError=true;await setValue('[formcontrolname=displayName]','Dr. Sara Updated');await click('button.primary');await wait("!!document.querySelector('.doctor-form-page .alert[role=alert]')");assert.equal(await evaluate("document.querySelector('[formcontrolname=displayName]').value"),'Dr. Sara Updated');writeError=false;
 await goto('/doctors/doctor-1',"!!document.querySelector('#doctor-section')");await responsive('doctor-profile');
 await click('[data-section=schedule]');await wait("!!document.querySelector('.schedule-list article')");await responsive('doctor-schedule');
 saveScheduleError=true;await click('.form-actions button');await wait("!!document.querySelector('.doctor-profile .alert[role=alert]')");assert.ok(await evaluate("!!document.querySelector('.schedule-list article') && !!document.querySelector('#doctor-section')"));saveScheduleError=false;
 await click('[data-section=compensation]');await wait("!!document.querySelector('app-date-input')");await responsive('doctor-compensation');
 // Failed editor loads must not expose blank forms.
 doctorFailure=true;await goto('/doctors/doctor-1/edit',"document.querySelector('.state button')");assert.ok(await evaluate("!document.querySelector('form')"));doctorFailure=false;await click('.state button');await wait("!!document.querySelector('form')");
 await goto('/treatment-plans',"!!document.querySelector('.plan-directory tbody tr')");await responsive('plans');
 await click('.pagination button:last-child');await wait("document.querySelector('.pagination span').textContent.includes('2 / 2')");await click('.filter-reset');await wait("document.querySelector('.pagination span').textContent.includes('1 / 2')");
 listFailure=true;await click('.filter-actions button[type=submit]');await wait("!!document.querySelector('.workspace-results .state[role=alert]')");listFailure=false;await click('.workspace-results .state button');await wait("!!document.querySelector('tbody tr')");
 await goto('/treatment-plans/plan-1',"!!document.querySelector('.plan-details h1')");await responsive('plan-details');
 conflict=true;await click('.head-actions button');await wait("!!document.querySelector('.conflict-recovery')");await shot('plan-version-conflict-ar');planVersion='v2';conflict=false;await click('.conflict-recovery button');await wait("!document.querySelector('.conflict-recovery') && !!document.querySelector('.plan-details h1')");
 }
 await goto('/treatment-plans/create',"!!document.querySelector('.plan-editor form') && !!document.querySelector('app-patient-select .selected-display')");await responsive('plan-create');
 // Native triggers/options allow selecting both relationships from the keyboard.
 await evaluate("document.querySelector('app-patient-select .selected-display').focus()");await key('Enter');await wait("!!document.querySelector('app-patient-select .picker-option')");await evaluate("document.querySelector('app-patient-select .picker-option').focus()");await key('Enter');
 await wait("document.querySelector('app-patient-select .selected-display').textContent.includes('Mona')");
 await evaluate("document.querySelector('app-doctor-select .selected-display').focus()");await key('Enter');await wait("!!document.querySelector('app-doctor-select .picker-option')");await evaluate("document.querySelector('app-doctor-select .picker-option').focus()");await key('Enter');
 await setValue('select[formcontrolname=catalogItemId]','catalog-1');await wait("document.querySelectorAll('.tier-select-card').length===2");await evaluate("document.querySelectorAll('.tier-select-card')[1].focus()");await key(' ','Space');
 assert.equal(await evaluate("document.querySelectorAll('.tier-select-card')[1].getAttribute('aria-pressed')"),'true');
 await noOverflow();await shot('plan-builder-mobile-ar');
 await evaluate("document.querySelector('.estimated-total-highlight-card').scrollIntoView({block:'center'})");await shot('plan-total-mobile-ar');
 writeError=true;await setValue('[formcontrolname=title]','Unsaved treatment plan');await click('.btn-submit-main');await wait("!!document.querySelector('.alert-box-modern[role=alert]')");assert.equal(await evaluate("document.querySelector('[formcontrolname=title]').value"),'Unsaved treatment plan');writeError=false;
 await goto('/treatment-plans/plan-1/edit',"!!document.querySelector('.plan-editor form')");await responsive('plan-edit');
 planFailure=true;await goto('/treatment-plans/plan-1/edit',"!!document.querySelector('.state button')");assert.ok(await evaluate("!document.querySelector('form')"));planFailure=false;await click('.state button');await wait("!!document.querySelector('.plan-editor form')");
 // View-only roles see no state transitions or administrative mutations.
 allowed=['TreatmentPlans.View','Doctors.View','Patients.View'];readOnly=true;
 await goto('/treatment-plans/plan-1',"!!document.querySelector('.plan-details h1')");assert.equal(await evaluate("document.querySelectorAll('.head-actions button').length"),0);
 await goto('/doctors/doctor-1',"!!document.querySelector('#doctor-section')");assert.ok(await evaluate("!document.querySelector('[data-section=compensation]') && !document.querySelector('.head-actions .danger')"));await click('[data-section=schedule]');await wait("!!document.querySelector('.schedule-list select')");assert.ok(await evaluate("[...document.querySelectorAll('.schedule-list input,.schedule-list select')].every(e=>e.disabled)"));
 assert.equal(unexpected.length,0,'Unmocked API requests: '+unexpected.join(','));assert.equal(exceptions.length,0,'Browser exceptions: '+JSON.stringify(exceptions));
 const result={passed:true,viewports:[1440,1024,768,390,320],languages:['en','ar'],checks:['doctor filters/reset','native account mode buttons','doctor create/edit/profile/schedule/compensation layouts','rejected doctor save retains values','failed editor load/retry','plan pagination/filter reset','plan list failure/retry','version conflict recovery','keyboard patient/doctor pickers','keyboard price tiers','plan create/edit layouts and retained input','view-only actions and schedule controls'],unexpectedApi:unexpected,browserExceptions:exceptions,networkFailures:networkFailures.map(x=>({error:x.errorText,blocked:x.blockedReason})),data:'Synthetic local API fixtures; no live backend',screenshots:fs.readdirSync(out).filter(x=>x.endsWith('.png')&&!/^(overflow-|timeout)/.test(x))};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

} finally { if(ws)ws.close();chrome.kill();server.closeAllConnections();await new Promise(r=>server.close(r)); }

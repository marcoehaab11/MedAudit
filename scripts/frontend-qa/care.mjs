import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve('frontend/dental-clinic-app/dist/dental-clinic-app/browser');
const out=path.resolve('tmp/frontend-care-qa');
fs.mkdirSync(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const permissions=['Patients.View','Patients.Create','Doctors.View','Appointments.View','Appointments.Create','TreatmentPlans.View','Treatments.View','Prescriptions.View','TreatmentCatalog.View','Finance.View','Finance.Revenue.View','Finance.Payments.View','Finance.Expenses.View','Finance.Categories.View','CRM.View','Lab.View','Insurance.View','Inventory.View','Settings.PublicBooking','Notifications.View','Reports.View','Users.View','Settings.View','Backup.Create'];
let allowed=permissions;
const clinics=[{tenantId:'qa-clinic',name:'Garden Dental Clinic',accessible:true}];
const session=()=>({expiresAt:'2099-01-01T00:00:00Z',userId:'qa-user',displayName:'Dr. Sara Ahmed',roles:['ClinicAdmin'],permissions:allowed,tenantId:'qa-clinic',tenantName:clinics[0].name,clinics});
const patients=[{id:'patient-1',patientNumber:'PT-001',fullName:'Mona Hassan',phone:'01000000001',email:'mona@example.test',gender:1,status:1,createdAt:'2026-11-10T10:00:00Z'},{id:'patient-2',patientNumber:'PT-002',fullName:'Omar Mohamed Abdelrahman',phone:'01000000002',email:'omar@example.test',gender:2,status:1,createdAt:'2026-11-09T10:00:00Z'},{id:'patient-3',patientNumber:'PT-003',fullName:'ليلى أحمد عبدالرحمن',phone:'01000000003',email:null,gender:1,status:1,createdAt:'2026-11-08T10:00:00Z'}];
let patientMode='normal', scheduleMode='normal', notesMode='normal', detailMode='normal', medicalAlerts=false; const apiLog=[],unexpected=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')) {
   apiLog.push(url.pathname+url.search);
   let result;
   if(url.pathname==='/api/auth/session')result=session();
   else if(url.pathname==='/api/auth/permissions')result=allowed;
   else if(url.pathname==='/api/auth/clinics')result=clinics;
   else if(url.pathname==='/api/branches/theme')result={primaryColor:'#087b68',secondaryColor:'#0d9488',accentColor:'#f59e0b',canManage:true};
   else if(url.pathname==='/api/patients/patient-1'){
     if(detailMode==='error'){res.writeHead(503,{'Content-Type':'application/json'});res.end('{}');return;}
     result={id:'patient-1',patientNumber:'PT-001',firstName:'Mona',middleName:'Ali',lastName:'Hassan',gender:1,status:1,dateOfBirth:'1990-05-12',phone:'01000000001',alternatePhone:'01000000002',email:'mona.long.email@example.test',address:'Garden district',city:'Cairo',country:'Egypt',nationality:'Egyptian',occupation:'Teacher',emergencyContactName:'Ahmed Hassan',emergencyContactPhone:'01000000003',notes:'Contact after 3 pm',createdAt:'2026-11-01T10:00:00Z',updatedAt:'2026-11-09T12:00:00Z',medicalNotes:'Original note',canViewMedicalInformation:allowed.includes('Patients.ViewMedicalHistory'),canEditMedicalInformation:allowed.includes('Patients.EditMedicalHistory'),allergies:medicalAlerts?[{id:'allergy-1',name:'Penicillin'}]:[],medicalConditions:[],medications:[],surgeries:[]};
   }
   else if(url.pathname==='/api/patients/patient-1/medical-notes'){
     res.writeHead(notesMode==='error'?403:204,{'Content-Type':'application/json'});res.end();return;
   }
   else if(url.pathname==='/api/patients/patient-1/clinical-history')result={timeZone:'Africa/Cairo',items:[{id:'event-1',toothNumbers:[16],procedureName:'Filling',step:'completed',stepEn:'Treatment recorded',stepAr:'تم تسجيل العلاج',date:'2026-11-10',dayEn:'Tuesday',dayAr:'الثلاثاء',time:'10:30',corrected:false}],page:1,pageSize:100,totalCount:1,uncertainLegacyRecords:0};
   else if(url.pathname==='/api/branches/patients/patient-1/transfer-history')result=null;
   else if(url.pathname==='/api/treatments')result={items:[],page:1,pageSize:50,totalCount:0,totalPages:0};
   else if(url.pathname==='/api/doctors')result={items:[{id:'doctor-1',displayName:'Dr. Sara Ahmed'}],totalCount:1,totalPages:1,page:1};
   else if(url.pathname==='/api/reports/dashboard')result={newPatients:3,appointmentsCount:1,completedTreatments:12,prescriptionsIssued:8,paymentsReceived:1200,currency:'EGP',timeZone:'Africa/Cairo'};
   else if(url.pathname==='/api/appointments/availability')result=[];
   else if(url.pathname==='/api/appointments/appointment-1')result={id:'appointment-1',patientId:'patient-1',patientName:'Mona Hassan',doctorProfileId:'doctor-1',doctorName:'Dr. Sara Ahmed',type:1,status:1,startAt:'2026-11-11T09:00:00Z',endAt:'2026-11-11T10:00:00Z',durationMinutes:60,timeZone:'UTC'};
   else if(url.pathname==='/api/patients'){
     if(patientMode==='error'){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({title:'Synthetic service failure'}));return;}
     let items=patientMode==='empty'?[]:patients.filter(p=>!url.searchParams.get('search')||p.fullName.toLowerCase().includes(url.searchParams.get('search').toLowerCase()));
     if(url.searchParams.get('gender'))items=items.filter(p=>p.gender===Number(url.searchParams.get('gender')));
     result={items,page:1,pageSize:50,totalCount:items.length,totalPages:items.length?1:0};
   }
   else if(url.pathname==='/api/doctors/lookup')result=[{id:'doctor-1',displayName:'Dr. Sara Ahmed'}];
   else if(url.pathname==='/api/finance/billing-queue')result=[];
   else if(url.pathname==='/api/appointments'){
     if(scheduleMode==='error'){res.writeHead(503,{'Content-Type':'application/json'});res.end('{}');return;}
     const date=(url.searchParams.get('from')||'2026-11-11').slice(0,10);
     const item={id:'appointment-1',patientId:'patient-1',patientName:'Mona Hassan',doctorProfileId:'doctor-1',doctorName:'Dr. Sara Ahmed',type:1,status:1,startAt:date+'T09:00:00Z',endAt:date+'T10:00:00Z',durationMinutes:60,timeZone:'UTC'};
     result={page:{items:scheduleMode==='empty'?[]:[item],page:1,pageSize:250,totalCount:scheduleMode==='empty'?0:1,totalPages:1},timeZone:'UTC'};
   } else {unexpected.push(url.pathname);res.writeHead(404,{'Content-Type':'application/json'});res.end('{}');return;}
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
 }
 let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(5322,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'planora-care-qa-'));
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
 const navigate=async route=>{await send('Page.navigate',{url:'http://127.0.0.1:5322'+route});await wait("document.querySelector('.workspace-filters') && !document.querySelector('.workspace-results[aria-busy=\"true\"]')");await pause(200);};
 const noOverflow=async()=>{const info=await evaluate(`(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && r.right>innerWidth+1 && !e.closest('.sidebar') && getComputedStyle(e).position!=='fixed'}).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,rect:e.getBoundingClientRect().toJSON()}))}))()`);if(info.scroll>info.width+1){console.log(JSON.stringify(info,null,2));await shot('overflow-'+info.width);throw Error('Page horizontal overflow');}};
 const setLanguage=async lang=>{if(await evaluate('document.documentElement.lang')!==lang){await click('.lang-btn');await wait(`document.documentElement.lang===${JSON.stringify(lang)}`);}};

 const readyDashboard = "document.querySelector('.workspace-dashboard .appointment-open')";
 const goto=async(route,ready)=>{await send('Page.navigate',{url:'http://127.0.0.1:5322'+route});await wait(ready);await evaluate('document.fonts.ready');await pause(250);};
 await viewport(1440);await goto('/dashboard',readyDashboard);await setLanguage('en');
 assert.equal(await evaluate("document.querySelector('main h1').textContent.trim()"),'Clinic overview');
 assert.equal(await evaluate("document.querySelectorAll('button a, button button').length"),0,'No nested interactive controls');
 await noOverflow();await shot('dashboard-desktop-en');await evaluate('window.scrollTo(0,document.body.scrollHeight)');await shot('dashboard-summary-desktop-en');
 await click('.appointment-open');await wait("!!document.querySelector('.calendar-layout .details')");await shot('dashboard-visit-details-en');await noOverflow();
 for(const width of [1024,768,390,320]){await viewport(width,844);await noOverflow();if(width===390){await shot('dashboard-mobile-en');await evaluate('window.scrollTo(0,document.body.scrollHeight)');await shot('dashboard-summary-mobile-en');}}
 await viewport(390,844);await setLanguage('ar');await noOverflow();await shot('dashboard-mobile-ar');
 await viewport(1440);await noOverflow();await shot('dashboard-desktop-ar');
 scheduleMode='error';await click('.view-toggle button:nth-child(2)');await wait("!!document.querySelector('.calendar [role=alert]')");
 assert.ok(await evaluate("!document.querySelector('.calendar').textContent.includes('لا توجد مواعيد')"),'Failure must not appear empty');await shot('dashboard-schedule-error-ar');
 scheduleMode='empty';await click('.calendar .state button');await wait("document.querySelector('.calendar').textContent.includes('لا توجد مواعيد')");
 scheduleMode='normal';
 // Full clinical role: preserve the existing timeline and medical edit flows.
 allowed=[...permissions,'Patients.Edit','Patients.ViewMedicalHistory','Patients.EditMedicalHistory','Patients.Archive','Dental.View'];
 await goto('/patients/patient-1',"document.querySelector('.patient-profile-header') && document.querySelector('.clinical-history tbody tr')");
 await setLanguage('en');await noOverflow();await shot('patient-timeline-desktop-en');
 assert.ok(await evaluate("document.querySelector('.patient-primary-actions a').search.includes('patientId=patient-1')"),'Booking retains patient context');
 await click('[data-section=contact]');await wait("document.querySelector('#patient-section').textContent.includes('Emergency contact')");
 assert.equal(await evaluate("document.querySelector('[data-section=contact]').getAttribute('aria-pressed')"),'true');
 await shot('patient-contact-desktop-en');
 await click('.patient-more-actions summary');assert.ok(await evaluate("!!document.querySelector('.patient-more-actions[open]')"));await click('.patient-more-actions summary');
 await click('[data-section=medical]');await wait("!!document.querySelector('[formcontrolname=dosage]')");
 const unnamed=await evaluate("[...document.querySelectorAll('#patient-section input')].filter(e=>!e.labels?.length && !e.getAttribute('aria-label')).map(e=>e.outerHTML)");assert.deepEqual(unnamed,[],'Every medical input has a persistent label');
 await shot('patient-medical-desktop-en');await evaluate("document.querySelector('app-date-input').scrollIntoView({block:'center'})");await shot('patient-medical-inputs-desktop-en');
 for(const width of [1024,768,390,320]){await viewport(width,844);await noOverflow();if(width===390)await shot('patient-medical-mobile-en');}
 await viewport(390,844);await setLanguage('ar');await noOverflow();await shot('patient-medical-mobile-ar');await evaluate("document.querySelector('app-date-input').scrollIntoView({block:'center'})");await shot('patient-medical-inputs-mobile-ar');
 await click('[data-section=notes]');await wait("!!document.querySelector('textarea[formcontrolname=medicalNotes]')");
 // This rejected save uses a synthetic API response.
 notesMode='error';await evaluate("(()=>{const e=document.querySelector('textarea[formcontrolname=medicalNotes]');e.value='Unsaved note';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await click('#patient-section form button');await wait("!!document.querySelector('.patient-details-page > .alert[role=alert]')");
 assert.equal(await evaluate("document.querySelector('textarea').value"),'Unsaved note');assert.ok(await evaluate("!!document.querySelector('.patient-profile-header')"));
 await shot('patient-note-save-error-ar');notesMode='normal';
 // Existing automatic medical alert must still open and remain reviewable.
 medicalAlerts=true;await goto('/patients/patient-1',"!!document.querySelector('.close-alert-btn')");await click('.close-alert-btn');await wait("!document.querySelector('.alert-modal-overlay')");
 assert.ok(await evaluate("!!document.querySelector('.patient-alert-summary')"));await shot('patient-alert-summary-mobile-ar');
 await click('.patient-alert-summary button');await wait("!!document.querySelector('.alert-modal-overlay')");await click('.close-alert-btn');medicalAlerts=false;
 // A failed initial request remains recoverable.
 detailMode='error';await goto('/patients/patient-1',"!!document.querySelector('.patient-load-error button')");await shot('patient-load-error-ar');
 detailMode='normal';await click('.patient-load-error button');await wait("!!document.querySelector('.patient-profile-header')");
 // Reception role sees overview without hidden clinical or administrative actions.
 allowed=['Patients.View'];await goto('/patients/patient-1',"!!document.querySelector('.patient-profile-header')");
 assert.ok(await evaluate("!document.querySelector('[data-section=medical]') && !document.querySelector('[data-section=timeline]') && !document.querySelector('.patient-primary-actions a') && !document.querySelector('.patient-more-actions')"));
 await noOverflow();await shot('patient-overview-mobile-ar');await viewport(1440);await noOverflow();await shot('patient-overview-desktop-ar');
 assert.equal(unexpected.length,0,'Unmocked API requests: '+unexpected.join(','));
 assert.equal(exceptions.length,0,'Browser exceptions: '+JSON.stringify(exceptions));
 const result={passed:true,viewports:[1440,1024,768,390,320],languages:['en','ar'],checks:['dashboard hierarchy','no nested controls','appointment details','responsive layouts','schedule failure/empty/retry','patient identity and booking context','section selection semantics','labeled medical inputs','notes preserved after rejected save','automatic medical alerts and review action','patient load failure/retry','restricted-role overview'],unexpectedApi:unexpected,browserExceptions:exceptions,networkFailures:networkFailures.map(x=>({error:x.errorText,blocked:x.blockedReason})),data:'Synthetic local API fixtures; live backend not exercised',screenshots:fs.readdirSync(out).filter(x=>x.endsWith('.png')&&!/^(overflow-|timeout)/.test(x))};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

} finally { if(ws)ws.close();chrome.kill();await new Promise(r=>server.close(r)); }

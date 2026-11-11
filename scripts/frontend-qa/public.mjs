import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve('frontend/dental-clinic-public/dist/dental-clinic-public/browser');
const out=path.resolve('tmp/frontend-public-qa');
fs.mkdirSync(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const permissions=['Patients.View','Patients.Create','Doctors.View','Appointments.View','Appointments.Create','TreatmentPlans.View','Treatments.View','Prescriptions.View','TreatmentCatalog.View','Finance.View','Finance.Revenue.View','Finance.Payments.View','Finance.Expenses.View','Finance.Categories.View','CRM.View','Lab.View','Insurance.View','Inventory.View','Settings.PublicBooking','Notifications.View','Reports.View','Users.View','Settings.View','Backup.Create'];
permissions.push('Patients.Edit','Patients.ViewMedicalHistory','Doctors.Create','Doctors.Edit','Doctors.Archive','TreatmentPlans.Create','TreatmentPlans.Edit','TreatmentPlans.Propose','TreatmentPlans.Accept','TreatmentPlans.Reject','TreatmentPlans.Cancel');let allowed=permissions;
const clinics=[{tenantId:'qa-clinic',name:'Garden Dental Clinic',accessible:true}];
const session=()=>({expiresAt:'2099-01-01T00:00:00Z',userId:'qa-user',displayName:'Dr. Sara Ahmed',roles:['ClinicAdmin'],permissions:allowed,tenantId:'qa-clinic',tenantName:clinics[0].name,clinics});
const patients=[{id:'patient-1',patientNumber:'PT-001',fullName:'Mona Hassan',phone:'01000000001',email:'mona@example.test',gender:1,status:1,createdAt:'2026-11-10T10:00:00Z'},{id:'patient-2',patientNumber:'PT-002',fullName:'Omar Mohamed Abdelrahman',phone:'01000000002',email:'omar@example.test',gender:2,status:1,createdAt:'2026-11-09T10:00:00Z'},{id:'patient-3',patientNumber:'PT-003',fullName:'ليلى أحمد عبدالرحمن',phone:'01000000003',email:null,gender:1,status:1,createdAt:'2026-11-08T10:00:00Z'}];
let patientMode='normal',intakeFailure=false,availabilityFailure=false,bookingConflict=false,doctorFailure=false,planFailure=false,listFailure=false,catalogFailure=false,saveScheduleError=false,writeError=false,conflict=false,readOnly=false,planVersion='v1'; const apiLog=[],unexpected=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')) {
 res.setHeader('Content-Type','application/json');let result;
 if(url.pathname==='/api/public/clinics/garden')result={tenantId:'qa',name:'Garden Dental Clinic',slug:'garden',phone:'+201000000001',email:'clinic@example.test',address:'Example Street',city:'Cairo',country:'Egypt',timeZone:'Africa/Cairo',currency:'EGP',publicBookingEnabled:true,publicBookingHorizonDays:30,publicPriceVisibility:true,primaryColor:'#087b68',secondaryColor:'#0d9488',accentColor:'#f59e0b',hours:[]};
 else if(url.pathname==='/api/public/clinics/customers')result=[];
 else if(url.pathname.endsWith('/doctors'))result=[{doctorProfileId:'d1',displayName:'Dr. Sara Ahmed',specialization:'General dentistry',bio:'Preventive and restorative care.',consultationDurationMinutes:30}];
 else if(url.pathname.endsWith('/services'))result=[{id:'s1',name:'Consultation',code:'CONS',durationMinutes:30,price:100}];
 else if(url.pathname.endsWith('/availability'))result=[{startAt:'2026-11-13T07:00:00Z',endAt:'2026-11-13T07:30:00Z',date:'2026-11-13',startTime:'09:00',endTime:'09:30',timeZone:'Africa/Cairo'}];
 else if(url.pathname.endsWith('/visits')){res.writeHead(204);res.end();return;}
 else if(url.pathname.endsWith('/bookings')){res.writeHead(503);res.end(JSON.stringify({title:'Test: booking could not be saved.'}));return;}
 else {unexpected.push(url.pathname);res.writeHead(404);res.end('{}');return;}
 res.writeHead(200);res.end(JSON.stringify(result));return;
 }
 let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(5326,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'planora-intake-qa-'));
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
 const navigate=async route=>{await send('Page.navigate',{url:'http://127.0.0.1:5326'+route});await wait("document.querySelector('.workspace-filters') && !document.querySelector('.workspace-results[aria-busy=\"true\"]')");await pause(200);};
 const noOverflow=async()=>{const info=await evaluate(`(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && r.right>innerWidth+1 && !e.closest('.sidebar') && getComputedStyle(e).position!=='fixed'}).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,rect:e.getBoundingClientRect().toJSON()}))}))()`);if(info.scroll>info.width+1){console.log(JSON.stringify(info,null,2));await shot('overflow-'+info.width);throw Error('Page horizontal overflow');}};
 const setLanguage=async lang=>{if(await evaluate('document.documentElement.lang')!==lang){await click('.lang-toggle');await wait(`document.documentElement.lang===${JSON.stringify(lang)}`);}};


 const goto=async(route,ready)=>{await send('Page.navigate',{url:'http://127.0.0.1:5326'+route});await wait(ready);await evaluate('document.fonts.ready');await pause(200);};
 const setValue=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
 const responsive=async(name)=>{await viewport(1440);await setLanguage('en');await evaluate('window.scrollTo(0,0)');await noOverflow();await shot(name+'-desktop-en');await setLanguage('ar');await noOverflow();await shot(name+'-desktop-ar');for(const width of [1024,768,390,320]){await viewport(width,844);await noOverflow();if(width===390)await shot(name+'-mobile-ar');}};


 const check=async(name)=>{for(const width of [1440,768,390,320]){await viewport(width);await noOverflow();if(width===1440||width===390)await shot(name+'-'+width);}};
 await viewport(1440);await goto('/register',"document.querySelector('.signup-card')");await check('registration');
 await goto('/confirm-email',"document.querySelector('.signup-card')");await check('confirm-email');
 await goto('/book/garden',"document.querySelector('.doctor-card')");await check('booking-doctor');
 await viewport(1440);await evaluate("document.querySelector('.doctor-card').focus()");await key('Enter');
 assert.equal(await evaluate("document.querySelector('.doctor-card').getAttribute('aria-pressed')"),'true');
 await click('.step-card .actions .btn-primary');await wait("document.querySelector('.service-item')");
 await check('booking-service');await viewport(1440);await evaluate("document.querySelector('.service-item').focus()");await key('Enter');
 assert.equal(await evaluate("document.querySelector('.service-item').getAttribute('aria-pressed')"),'true');
 await click('.step-card .actions .btn-primary');await wait("document.querySelector('.slot-chip')");await check('booking-slots');
 await viewport(1440);await click('.slot-chip');await click('.step-card .actions .btn-primary');await wait("document.querySelector('.patient-form')");await check('booking-patient');
 await viewport(1440);await setValue('#fullName','Synthetic QA Patient');await setValue('#phone','01000000001');await click('.patient-form button[type=submit]');await wait("document.querySelector('.error-banner')");assert.equal(await evaluate("document.querySelector('#fullName').value"),'Synthetic QA Patient');await shot('booking-save-error');
 await goto('/book/confirmation/QA-REFERENCE',"document.querySelector('.error-card')");await check('private-confirmation');
 await goto('/',"document.querySelector('iframe')");await check('landing-frame');
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(unexpected.length,0,JSON.stringify(unexpected));
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'passed',routes:['/','/register','/confirm-email','/book/:clinicSlug','/book/confirmation/:reference'],viewports:[1440,768,390,320],checks:['keyboard doctor/service selection','failed booking retains input','private confirmation without token','responsive layouts'],data:'Synthetic fixtures'},null,2));console.log('Public browser QA passed');
} finally {if(ws)ws.close();chrome.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}

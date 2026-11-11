import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve('frontend/dental-clinic-app/dist/dental-clinic-app/browser');
const out=path.resolve('tmp/frontend-intake-qa');
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
   apiLog.push(url.pathname+url.search);res.setHeader('Content-Type','application/json');
   const fail=code=>{res.writeHead(code);res.end('{}');};
   const doctor={id:'doctor-1',clinicUserId:'user-1',displayName:'Dr. Sara Ahmed',email:'sara@example.test',phone:'+201000000001',specialization:'General dentistry and restorative care',licenseNumber:'DEN-1234',status:1,accountStatus:2,bio:'Preventive and restorative dental care.',consultationDurationMinutes:30,createdAt:'2026-11-01T10:00:00Z',updatedAt:'2026-11-10T12:00:00Z',canManageSchedule:!readOnly,canManageCompensation:!readOnly};
   const item={id:'item-1',catalogItemId:'catalog-1',treatmentName:'Composite restoration',toothNumber:16,quantity:1,unitPrice:100,discountAmount:0,total:100};
   const plan={id:'plan-1',patientId:'patient-1',patientName:'Mona Hassan',doctorProfileId:'doctor-1',doctorName:'Dr. Sara Ahmed',title:'Restorative care plan',notes:'Existing notes',status:1,subtotal:100,discountAmount:0,total:100,createdAt:'2026-11-01T10:00:00Z',updatedAt:'2026-11-10T12:00:00Z',version:planVersion,items:[item]};
   let result;
   if(url.pathname==='/api/patients/patient-1') { if(intakeFailure)return fail(503); if(req.method==='PUT')return fail(403); result={...patients[0],firstName:'Mona',lastName:'Hassan',dateOfBirth:'1990-01-01',canEditMedicalInformation:true,allergies:[{name:'Latex'}],medicalConditions:[],medications:[]}; }
   else if(url.pathname==='/api/appointments/availability') {if(availabilityFailure)return fail(503); const date=url.searchParams.get('date');result=[9,10,14,15].map(h=>({startAt:date+'T'+String(h-2).padStart(2,'0')+':00:00Z',endAt:date+'T'+String(h-2).padStart(2,'0')+':30:00Z',localDate:date,localStartTime:String(h).padStart(2,'0')+':00:00',localEndTime:String(h).padStart(2,'0')+':30:00',timeZone:'Africa/Cairo'})); }
   else if(url.pathname==='/api/appointments' && req.method==='POST')return fail(bookingConflict?409:403);
   else if(url.pathname==='/api/auth/session')result=session();
   else if(url.pathname==='/api/auth/permissions')result=allowed;
   else if(url.pathname==='/api/auth/clinics')result=clinics;
   else if(url.pathname==='/api/branches/theme')result={primaryColor:'#087b68',secondaryColor:'#0d9488',accentColor:'#f59e0b',canManage:true};
   else if(url.pathname==='/api/patients'){if(req.method==='POST')return fail(403);result={items:patients,page:1,pageSize:50,totalCount:3,totalPages:1};}
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
   else if(url.pathname==='/api/treatments'){result={items:[],totalCount:0};}
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
await new Promise(r=>server.listen(5324,'127.0.0.1',r));
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
 const navigate=async route=>{await send('Page.navigate',{url:'http://127.0.0.1:5324'+route});await wait("document.querySelector('.workspace-filters') && !document.querySelector('.workspace-results[aria-busy=\"true\"]')");await pause(200);};
 const noOverflow=async()=>{const info=await evaluate(`(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && r.right>innerWidth+1 && !e.closest('.sidebar') && getComputedStyle(e).position!=='fixed'}).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,rect:e.getBoundingClientRect().toJSON()}))}))()`);if(info.scroll>info.width+1){console.log(JSON.stringify(info,null,2));await shot('overflow-'+info.width);throw Error('Page horizontal overflow');}};
 const setLanguage=async lang=>{if(await evaluate('document.documentElement.lang')!==lang){await click('.lang-btn');await wait(`document.documentElement.lang===${JSON.stringify(lang)}`);}};


 const goto=async(route,ready)=>{await send('Page.navigate',{url:'http://127.0.0.1:5324'+route});await wait(ready);await evaluate('document.fonts.ready');await pause(200);};
 const setValue=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
 const responsive=async(name)=>{await viewport(1440);await setLanguage('en');await evaluate('window.scrollTo(0,0)');await noOverflow();await shot(name+'-desktop-en');await setLanguage('ar');await noOverflow();await shot(name+'-desktop-ar');for(const width of [1024,768,390,320]){await viewport(width,844);await noOverflow();if(width===390)await shot(name+'-mobile-ar');}};

 await viewport(1440);
 await goto('/patients/create',"document.querySelector('.patient-form')");
 await responsive('patient-create');
 await setLanguage('en'); await viewport(1440);
 await click('.patient-form button.primary');
 await wait("document.activeElement?.getAttribute('formcontrolname')==='firstName'");
 await shot('patient-invalid-focus');
 intakeFailure=true;
 await goto('/patients/patient-1/edit',"document.querySelector('.intake-recovery') || document.querySelector('.workspace-intake .state') || document.querySelector('.workspace-intake button')");
 await wait("document.querySelector('.workspace-intake')?.innerText.includes('Try again')");
 assert.equal(await evaluate("!!document.querySelector('.patient-form')"),false);
 intakeFailure=false;await click('.workspace-intake button');await wait("document.querySelector('.patient-form')");
 await responsive('patient-edit');
 await setLanguage('en');await viewport(1440);await click('.patient-form button.primary');
 await wait("document.querySelector('.alert.error')");assert.equal(await evaluate("document.querySelector('[formcontrolname=firstName]').value"),'Mona');
 await shot('patient-edit-save-error');
 await goto('/appointments/create?patientId=patient-1&doctorProfileId=doctor-1',"document.querySelector('.slot-card')");
 await responsive('booking-create');await setLanguage('en');await viewport(1440);
 await click('.slot-card');await wait("document.querySelector('.booking-review')");await shot('booking-review');
 bookingConflict=true;await click('.appointment-form button.primary');await wait("document.querySelector('.alert.error') && !document.querySelector('.booking-review') && document.querySelector('.slot-card')");
 await shot('booking-conflict');
 availabilityFailure=true;await goto('/appointments/create?doctorProfileId=doctor-1',"document.querySelector('.availability-error')");
 await shot('booking-availability-error');availabilityFailure=false;await click('.availability-error button');await wait("document.querySelector('.slot-card')");
 await click('.booking-patient-choice > button');await wait("document.querySelector('dialog')?.open");
 assert.equal(await evaluate("document.querySelector('dialog').matches(':modal')"),true);
 assert.equal(await evaluate("document.activeElement.getAttribute('formcontrolname')"),'firstName');
 assert.equal(await evaluate("document.body.style.overflow"),'hidden');
 await shot('quick-patient-desktop');await viewport(390,844);await noOverflow();await shot('quick-patient-mobile');
 await key('Escape');await wait("!document.querySelector('dialog')");
 assert.equal(await evaluate("document.body.style.overflow"),'');
 assert.equal(await evaluate("document.activeElement.closest('.booking-patient-choice')!==null"),true);
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));
 assert.equal(unexpected.length,0,JSON.stringify(unexpected));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'passed',viewports:[1440,1024,768,390,320],languages:['en','ar'],checks:['patient-create-invalid-focus','patient-edit-load-retry','failed-save-preserves-fields','booking-review','booking-conflict-refresh','availability-error-retry','native-modal-focus-escape-restore'],screenshots:fs.readdirSync(out).filter(f=>f.endsWith('.png')).length,exceptions},null,2));
 console.log('Intake and booking browser QA passed');
} finally {if(ws)ws.close();chrome.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}

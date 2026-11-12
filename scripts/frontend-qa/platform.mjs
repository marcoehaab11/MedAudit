import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const out=path.resolve('tmp/frontend-platform-qa');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync('src/DentalClinic.PlatformAdmin/Pages/Account/Login.cshtml','utf8');
const script=fs.readFileSync('src/DentalClinic.PlatformAdmin/wwwroot/js/site.js','utf8');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const html=(error=false)=>{
 let html=source.slice(source.indexOf('<!doctype'));
 html=html.replaceAll('@@media','@media').replace(/@if \(!string.IsNullOrEmpty\(Model.ErrorMessage\)\)\s*\{([\s\S]*?)\}/,(_,body)=>error?body.replace('@Model.ErrorMessage','Invalid email or password.'):'');
 html=html.replace(/asp-for="([^"]+)"/g,(_,name)=>`name="${name}"`).replace(/asp-validation-for="[^"]+"/g,'');
 return html;
};
const server=http.createServer((req,res)=>{
 if(req.url.startsWith('/images/')){res.setHeader('Content-Type','image/jpeg');fs.createReadStream('src/DentalClinic.PlatformAdmin/wwwroot/images/planora-logo.jpg').pipe(res);return;}
 res.setHeader('Content-Type','text/html');res.end(html(req.url.includes('error')));
});
await new Promise(r=>server.listen(5328,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'planora-platform-qa-'));
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
 const navigate=async route=>{await send('Page.navigate',{url:'http://127.0.0.1:5328'+route});await wait("document.querySelector('.workspace-filters') && !document.querySelector('.workspace-results[aria-busy=\"true\"]')");await pause(200);};
 const noOverflow=async()=>{const info=await evaluate(`(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && r.right>innerWidth+1 && !e.closest('.sidebar') && getComputedStyle(e).position!=='fixed'}).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,rect:e.getBoundingClientRect().toJSON()}))}))()`);if(info.scroll>info.width+1){console.log(JSON.stringify(info,null,2));await shot('overflow-'+info.width);throw Error('Page horizontal overflow');}};
 const setLanguage=async lang=>{if(await evaluate('document.documentElement.lang')!==lang){await click('.lang-btn');await wait(`document.documentElement.lang===${JSON.stringify(lang)}`);}};


 const goto=async(route,ready)=>{await send('Page.navigate',{url:'http://127.0.0.1:5328'+route});await wait(ready);await evaluate('document.fonts.ready');await pause(200);};
 const setValue=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
 const responsive=async(name)=>{await viewport(1440);await setLanguage('en');await evaluate('window.scrollTo(0,0)');await noOverflow();await shot(name+'-desktop-en');await setLanguage('ar');await noOverflow();await shot(name+'-desktop-ar');for(const width of [1024,768,390,320]){await viewport(width,844);await noOverflow();if(width===390)await shot(name+'-mobile-ar');}};


 await viewport(1440);await goto('/login',"document.querySelector('#email')");
 for(const width of [1440,1024,768,390,320]){await viewport(width,900);await noOverflow();if(width===1440||width===390)await shot('login-'+width);}
 assert.equal(await evaluate("document.querySelector('#email').getAttribute('aria-describedby')"),'email-error');
 await viewport(1440);await evaluate("document.querySelector('.skip-link').focus()");await key('Enter');
 assert.equal(await evaluate("document.activeElement.id"),'admin-sign-in');
 await goto('/login-error',"document.querySelector('[role=alert]')");assert.match(await evaluate("document.querySelector('[role=alert]').textContent"),/Invalid email/);await shot('login-error');
 const behavior=await evaluate(`(()=>{
  document.body.innerHTML='<form id="qa-form" data-confirm="Confirm?" data-loading-form><input name="value" required value="fixture"><button type="submit" name="operation" value="save">Save</button><button type="submit" disabled>Unavailable</button></form>';
  const f=document.querySelector('form'),b=f.querySelector('button');window.confirm=()=>false;
  ${script}
  const cancelled=new SubmitEvent('submit',{cancelable:true,submitter:b});f.dispatchEvent(cancelled);
  const result={cancelled:cancelled.defaultPrevented,unchangedAfterCancel:!f.classList.contains('is-loading')&&!f.hasAttribute('aria-busy')};
  window.confirm=()=>true;f.dispatchEvent(new SubmitEvent('submit',{cancelable:true,submitter:b}));
  result.pending=f.getAttribute('aria-busy')==='true';result.submitterPreserved=new FormData(f,b).get('operation')==='save';result.submitterEnabled=!b.disabled;
  const duplicate=new SubmitEvent('submit',{cancelable:true,submitter:b});f.dispatchEvent(duplicate);result.duplicateBlocked=duplicate.defaultPrevented;
  window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
  result.restored=!f.classList.contains('is-loading')&&!f.hasAttribute('aria-busy')&&!b.hasAttribute('aria-disabled');
  result.disabledPreserved=f.querySelectorAll('button')[1].disabled;
  f.querySelector('input').value='';f.dispatchEvent(new SubmitEvent('submit',{cancelable:true,submitter:b}));result.invalidNotPending=!f.classList.contains('is-loading');
  return result;
 })()`);
 assert.ok(Object.values(behavior).every(Boolean),JSON.stringify(behavior));assert.equal(exceptions.length,0,JSON.stringify(exceptions));
 const result={passed:true,kind:'Static Razor markup/CSS preview and real browser DOM behavior; not a running ASP.NET server',viewports:[1440,1024,768,390,320],checks:behavior,exceptions};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {if(ws)ws.close();chrome.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}

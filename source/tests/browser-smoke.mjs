import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../../',import.meta.url));
await mkdir(path.join(root,'artifacts'),{recursive:true});
const server=createServer(async(req,res)=>{
  const name=req.url==='/'?'index.html':req.url.slice(1);
  if(!['index.html','dev.html'].includes(name)){res.writeHead(404).end();return;}
  try{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(path.join(root,name)));}catch{res.writeHead(500).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}/`;
const url=origin+(process.argv.includes('--dev')?'dev.html':'');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11']});
const errors=[],external=[];
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',req=>{if(!req.url().startsWith(origin))external.push(req.url());});
  await page.goto(url);
  await page.waitForFunction(()=>!document.querySelector('#start').disabled||!document.querySelector('#failure').hidden,{timeout:45000});
  const failure=await page.locator('#error-message').textContent();
  assert.equal(await page.locator('#failure').isVisible(),false,'GPU startup: '+failure+'\n'+errors.join('\n'));
  await page.screenshot({path:path.join(root,'artifacts/manhattan-dusk.png')});
  console.log('PASS: production HTML compiled all WGSL shaders and rendered the city');
  await page.locator('#start').click();
  await page.keyboard.press('KeyH');
  await page.waitForFunction(()=>document.querySelector('#stats').textContent.includes('fps'));
  const before=await page.locator('#stats').textContent();
  await page.keyboard.down('KeyW');await page.waitForTimeout(1300);await page.keyboard.up('KeyW');
  await page.waitForTimeout(1100);
  const after=await page.locator('#stats').textContent();
  assert.notEqual(before.match(/x .*$/s)[0],after.match(/x .*$/s)[0]);
  console.log('PASS: keyboard changes the actual camera position');
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(600);
  await page.keyboard.press('KeyH');
  await page.screenshot({path:path.join(root,'artifacts/manhattan-rooftops.png')});
  await page.keyboard.press('Digit2');await page.waitForTimeout(600);
  await page.screenshot({path:path.join(root,'artifacts/manhattan-street.png')});
  await page.locator('#help').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#settings').isVisible(),true,'Space must activate a focused button, not move the camera');
  await page.locator('#close-settings').click();
  await page.locator('#help').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#hud').isVisible(),false,'Escape must still open the menu after using a focused button');
  await page.locator('#help').click();
  assert.equal(await page.locator('#settings').isVisible(),true);
  await page.locator('[data-quality="low"]').click();
  assert.equal(await page.locator('[data-quality="low"]').getAttribute('aria-pressed'),'true');
  await page.locator('#exposure').fill('1.2');
  await page.locator('#close-settings').click();
  await page.setViewportSize({width:1100,height:700});await page.waitForTimeout(600);
  assert.equal(await page.locator('#failure').isVisible(),false);
  console.log('PASS: help, quality, light control and canvas resizing');
  console.log('RENDER_STATS '+after.replaceAll('\n',' | '));
  assert.deepEqual(external,[],'runtime must remain offline/self-contained');
  assert.deepEqual(errors,[],'no JavaScript or GPU validation errors');
  await page.close();

  const unsupported=await browser.newPage();
  await unsupported.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
  await unsupported.goto(url);await unsupported.locator('#failure').waitFor({state:'visible'});
  assert.match(await unsupported.locator('#error-message').textContent(),/WebGPU/);
  console.log('PASS: unsupported GPU produces a readable error');
  await unsupported.close();

  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await mobile.goto(url);
  await mobile.waitForFunction(()=>!document.querySelector('#start').disabled||!document.querySelector('#failure').hidden,{timeout:45000});
  assert.equal(await mobile.locator('#failure').isVisible(),false);
  await mobile.locator('#start').click();assert.equal(await mobile.locator('#touch').isVisible(),true);
  await mobile.screenshot({path:path.join(root,'artifacts/manhattan-mobile.png')});
  console.log('PASS: mobile layout renders with touch movement controls');
  await mobile.close();

  const offline=await browser.newPage();
  await offline.goto(pathToFileURL(path.join(root,'index.html')).href);
  await offline.waitForFunction(()=>!document.querySelector('#start').disabled||!document.querySelector('#failure').hidden,{timeout:45000});
  assert.equal(await offline.locator('#failure').isVisible(),false,'the downloaded file must also render directly from disk');
  console.log('PASS: standalone HTML also runs directly from file://');
  await offline.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

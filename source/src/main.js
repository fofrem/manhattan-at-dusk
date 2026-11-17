const $=id=>document.getElementById(id),canvas=$('scene');
const status=message=>{$('s').textContent=message;};
const showError=message=>{$('failure').hidden=false;$('error-message').textContent=message;$('intro').hidden=true;};
if(!navigator.gpu)throw new Error('WebGPU n’est pas disponible dans ce navigateur.');
status('Réveil de la carte graphique…');
const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
if(!adapter)throw new Error('Aucune carte graphique compatible WebGPU n’a été trouvée.');
const device=await adapter.requestDevice();
let stopped=false;
device.lost.then(info=>{stopped=true;showError('La connexion à la carte graphique a été interrompue. Rechargez la page pour reprendre la promenade.');});
device.addEventListener('uncapturederror',event=>{console.error(event.error);if(!stopped)showError('Le rendu a rencontré une erreur graphique : '+event.error.message);stopped=true;});
const context=canvas.getContext('webgpu'),format=navigator.gpu.getPreferredCanvasFormat();
context.configure({device,format,alphaMode:'opaque'});
const U=GPUBufferUsage,TU=GPUTextureUsage,S=GPUShaderStage;
const buffer=(array,usage)=>{const b=device.createBuffer({size:Math.max(4,array.byteLength),usage:usage|U.COPY_DST});device.queue.writeBuffer(b,0,array);return b;};
const uniform=device.createBuffer({size:224,usage:U.UNIFORM|U.COPY_DST});
const uniformLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:S.VERTEX|S.FRAGMENT,buffer:{type:'uniform'}}]});
const geometryLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:S.VERTEX|S.FRAGMENT,buffer:{type:'uniform'}},{binding:1,visibility:S.FRAGMENT,texture:{sampleType:'depth'}},{binding:2,visibility:S.FRAGMENT,sampler:{type:'comparison'}}]});
const postLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:S.FRAGMENT,buffer:{type:'uniform'}},{binding:1,visibility:S.FRAGMENT,texture:{}},{binding:2,visibility:S.FRAGMENT,sampler:{}},{binding:3,visibility:S.FRAGMENT,texture:{}}]});
const uniBind=device.createBindGroup({layout:uniformLayout,entries:[{binding:0,resource:{buffer:uniform}}]});
const shadowTexture=device.createTexture({size:[2048,2048],format:'depth32float',usage:TU.RENDER_ATTACHMENT|TU.TEXTURE_BINDING});
const shadowView=shadowTexture.createView();
const geometryBind=device.createBindGroup({layout:geometryLayout,entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:shadowView},{binding:2,resource:device.createSampler({compare:'less-equal',minFilter:'linear',magFilter:'linear'})}]});
const linear=device.createSampler({minFilter:'linear',magFilter:'linear'});
const module=async(code,label)=>{
  const m=device.createShaderModule({code,label}),info=await m.getCompilationInfo();
  const errors=info.messages.filter(m=>m.type==='error');
  if(errors.length)throw new Error(label+' : '+errors.map(m=>`ligne ${m.lineNum}:${m.linePos} — ${m.message}`).join('; '));
  return m;
};
status('Éclairage des fenêtres…');
const [geomModule,skyModule,postModule]=await Promise.all([module(CITY_GEOMETRY,'Façades'),module(CITY_SKY,'Ciel'),module(CITY_POST,'Lumière')]);
const vertexBuffers=[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'}]},
  {arrayStride:64,stepMode:'instance',attributes:[0,1,2,3].map((j)=>({shaderLocation:j+2,offset:j*16,format:'float32x4'}))}];
const layout=b=>device.createPipelineLayout({bindGroupLayouts:[b]});
const geometryPipeline=await device.createRenderPipelineAsync({layout:layout(geometryLayout),vertex:{module:geomModule,entryPoint:'vs',buffers:vertexBuffers},fragment:{module:geomModule,entryPoint:'fs',targets:[{format:'rgba16float'}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
const shadowPipeline=await device.createRenderPipelineAsync({layout:layout(uniformLayout),vertex:{module:geomModule,entryPoint:'shadowVS',buffers:vertexBuffers},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less',depthBias:2,depthBiasSlopeScale:2}});
const skyPipeline=await device.createRenderPipelineAsync({layout:layout(uniformLayout),vertex:{module:skyModule,entryPoint:'screen'},fragment:{module:skyModule,entryPoint:'fs',targets:[{format:'rgba16float'}]},primitive:{topology:'triangle-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'always'}});
const postPipeline=async(entry,target)=>device.createRenderPipelineAsync({layout:layout(postLayout),vertex:{module:postModule,entryPoint:'screen'},fragment:{module:postModule,entryPoint:entry,targets:[{format:target}]},primitive:{topology:'triangle-list'}});
const downPipeline=await postPipeline('downsample','rgba16float'),blurPipeline=await postPipeline('blur','rgba16float'),compositePipeline=await postPipeline('composite',format);

// One hard-edged unit cube, instanced for every building, cornice, tree and cab part.
const vertices=[];
for(const [n,u,v] of [ [[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]] ]){
  for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])vertices.push(...n.map((c,j)=>(c+u[j]*a+v[j]*b)*.5),...n);
}
const cubeBuffer=buffer(new Float32Array(vertices),U.VERTEX),city=makeCity();
const staticBuffer=buffer(city.instances,U.VERTEX),instanceCount=city.instances.length/16;
const cabData=new Float32Array(city.taxis.length*20*16),cabBuffer=buffer(cabData,U.VERTEX);
const cabCount=fillTaxis(cabData,city.taxis,0);
const audio=makeCityAudio();

const dot=(a,b)=>a.reduce((s,v,j)=>s+v*b[j],0);
const normal=a=>{const l=hypot(...a)||1;return a.map(v=>v/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const multiply=(a,b)=>{const out=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let j=0;j<4;j++)out[col*4+row]+=a[j*4+row]*b[col*4+j];return out;};
const lookAt=(eye,target)=>{
  const z=normal(eye.map((v,j)=>v-target[j])),x=normal(cross([0,1,0],z)),y=cross(z,x);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
};
const perspective=(aspect)=>{
  const near=.15,far=1800,f=1/Math.tan(PI/6);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,far/(near-far),-1,0,0,near*far/(near-far),0]);
};
const sun=normal([-.56,.26,-.78]),lightEye=sun.map(v=>v*700),lightView=lookAt(lightEye,[0,25,0]);
const ortho=new Float32Array([1/420,0,0,0,0,1/420,0,0,0,0,-1/1500,0,0,0,0,1]);
const lightMatrix=multiply(ortho,lightView);
const g=new Float32Array(56);
let position=[...VIEWPOINTS[0].position],yaw=0,pitch=0,selectedView=0;
let active=false,touring=false,tourTime=0,worldTime=0,previousTime=0,frameCount=0,fps=60,frameBudget=0,firstFrame=true;
let quality='high',renderScale=1,exposure=1,loaded=false,lastWidth=0,lastHeight=0;
const touchDevice=matchMedia('(pointer: coarse)').matches;
try{quality=localStorage.getItem('manhattan-quality')||(touchDevice?'medium':'high');}catch{}
if(!['low','medium','high'].includes(quality))quality='high';
let hdr,depth,bloomA,bloomB,downBind,blurBind,compositeBind;
const postBind=(source,bloom)=>device.createBindGroup({layout:postLayout,entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:source},{binding:2,resource:linear},{binding:3,resource:bloom}]});
const resize=()=>{
  const scale=quality==='low'?.55:quality==='medium'?.78:1;
  const dpr=Math.min(devicePixelRatio,quality==='high'?1.5:1);
  const maxSize=device.limits.maxTextureDimension2D;
  const w=Math.max(1,Math.min(maxSize,Math.round(innerWidth*dpr*scale*renderScale))),h=Math.max(1,Math.min(maxSize,Math.round(innerHeight*dpr*scale*renderScale)));
  if(w===lastWidth&&h===lastHeight)return;
  lastWidth=canvas.width=w;lastHeight=canvas.height=h;
  for(const t of [hdr,depth,bloomA,bloomB])t?.destroy();
  const tex=(ww,hh,format,usage=TU.RENDER_ATTACHMENT|TU.TEXTURE_BINDING)=>device.createTexture({size:[ww,hh],format,usage});
  hdr=tex(w,h,'rgba16float');depth=tex(w,h,'depth24plus',TU.RENDER_ATTACHMENT);
  bloomA=tex(Math.max(1,w>>2),Math.max(1,h>>2),'rgba16float');bloomB=tex(Math.max(1,w>>2),Math.max(1,h>>2),'rgba16float');
  downBind=postBind(hdr.createView(),hdr.createView());blurBind=postBind(bloomA.createView(),bloomA.createView());compositeBind=postBind(hdr.createView(),bloomB.createView());
};
const keys=new Set();
const hint=message=>{$('hint').textContent=message;$('hint').classList.add('show');clearTimeout(hint.timer);hint.timer=setTimeout(()=>$('hint').classList.remove('show'),4500);};
const updateViewLabel=()=>{$('view').textContent=String(selectedView+1).padStart(2,'0')+' · '+VIEWPOINTS[selectedView].name;};
const aimAt=target=>{const d=target.map((v,j)=>v-position[j]);yaw=atan2(d[0],-d[2]);pitch=atan2(d[1],hypot(d[0],d[2]));};
const setView=index=>{selectedView=index;position=[...VIEWPOINTS[index].position];aimAt(VIEWPOINTS[index].target);updateViewLabel();};
setView(0);
const setTour=value=>{touring=value;tourTime=0;$('tour').setAttribute('aria-pressed',String(value));$('tour').textContent=value?'Ⅱ Arrêter':'▷ Visite';};
const start=()=>{
  if(!loaded)return;
  active=true;document.body.classList.add('active');$('hud').hidden=false;$('crosshair').hidden=touchDevice;$('touch').hidden=!touchDevice;
  canvas.focus();audio.resume();
  if(!touchDevice){try{const promise=canvas.requestPointerLock();promise?.catch(()=>hint('Cliquez dans la scène pour regarder autour de vous, ou glissez la souris.'));}catch{hint('Glissez la souris pour regarder autour de vous.');}}
  hint(touchDevice?'Glissez pour regarder · flèches pour avancer':'ZQSD / WASD · E pour monter · C pour descendre · Shift pour accélérer');
};
const pause=()=>{
  active=false;keys.clear();setTour(false);document.body.classList.remove('active');$('hud').hidden=true;$('crosshair').hidden=true;$('touch').hidden=true;
  if(document.pointerLockElement)document.exitPointerLock();audio.pause();
};
const openSettings=()=>{keys.clear();if(document.pointerLockElement)document.exitPointerLock();$('settings').showModal();};
$('start').onclick=start;
$('tour-start').onclick=()=>{start();setTour(true);};
$('tour').onclick=()=>{setTour(!touring);hint(touring?'Visite en cours · une touche de déplacement rend la main':'À vous d’explorer.');};
$('pause').onclick=pause;$('home').onclick=e=>{e.preventDefault();pause();};
$('help').onclick=openSettings;$('close-settings').onclick=()=>$('settings').close();
$('settings').addEventListener('close',()=>{keys.clear();if(active)canvas.focus();});
$('view').onclick=()=>{setTour(false);setView((selectedView+1)%VIEWPOINTS.length);};
$('sound').onclick=async()=>{
  try{const on=await audio.toggle();$('sound').setAttribute('aria-pressed',String(on));$('sound').setAttribute('aria-label',on?'Couper l’ambiance sonore':'Activer l’ambiance sonore');$('sound').innerHTML=(on?'♫':'♪')+' <span class="sound-label">'+(on?'Son activé':'Ambiance sonore')+'</span>';}catch{hint('Le son n’est pas disponible. Vous pouvez continuer la promenade.');}
};
for(let index=0;index<VIEWPOINTS.length;index++){
  const button=document.createElement('button');button.innerHTML='<span>0'+(index+1)+'</span>'+VIEWPOINTS[index].name;
  button.onclick=()=>{setTour(false);setView(index);$('settings').close();if(!active)start();};$('places').append(button);
}
const syncQuality=()=>{document.querySelectorAll('[data-quality]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.quality===quality)));};
syncQuality();
document.querySelectorAll('[data-quality]').forEach(button=>button.onclick=()=>{quality=button.dataset.quality;renderScale=1;try{localStorage.setItem('manhattan-quality',quality);}catch{}syncQuality();resize();});
$('exposure').oninput=()=>{exposure=Number($('exposure').value);};
const moveCodes=new Set(['KeyW','KeyA','KeyS','KeyD','KeyZ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','KeyQ','KeyC','ControlLeft','ControlRight','Space','ShiftLeft','ShiftRight']);
addEventListener('keydown',e=>{
  if($('settings').open)return;
  if(e.code==='Escape'){if(active)pause();return;}
  if(e.target instanceof Element&&e.target.closest('button,a,input,select,textarea,[contenteditable="true"]'))return;
  if(e.code==='KeyH'){$('stats').hidden=!$('stats').hidden;return;}
  if(e.code==='KeyM'&&!e.repeat){$('sound').click();return;}
  if(!active)return;
  const digit=Number(e.code.replace('Digit',''));
  if(digit>=1&&digit<=6){setTour(false);setView(digit-1);hint(VIEWPOINTS[digit-1].name);return;}
  if(moveCodes.has(e.code)){e.preventDefault();keys.add(e.code);if(touring)setTour(false);}
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{keys.clear();previousTime=0;if(document.hidden)audio.pause();else if(active)audio.resume();});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&active)hint('Souris libérée · cliquez dans la scène pour reprendre');});
let drag=null;
canvas.addEventListener('pointerdown',e=>{
  if(!active||$('settings').open)return;
  if(!touring&&!touchDevice&&!document.pointerLockElement){try{canvas.requestPointerLock()?.catch(()=>{});}catch{}}
  drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
canvas.addEventListener('pointermove',e=>{
  if(!active||touring||$('settings').open)return;
  let dx=0,dy=0;
  if(document.pointerLockElement===canvas){dx=e.movementX;dy=e.movementY;}
  else if(drag&&drag.id===e.pointerId){dx=e.clientX-drag.x;dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;}
  yaw+=dx*.0025;pitch=clamp(pitch-dy*.0025,-1.5,1.5);
});
for(const button of document.querySelectorAll('[data-move]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();setTour(false);keys.add(button.dataset.move);button.setPointerCapture(e.pointerId);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.move));
}

function updateCamera(dt){
  if(!active||$('settings').open)return;
  if(touring){
    tourTime+=dt;const angle=tourTime*.055;
    const targetPosition=[sin(angle)*150,95+sin(angle*.7)*32,cos(angle)*185];
    const desired=targetPosition.map((v,j)=>v-position[j]);
    position=moveCamera(position,desired.map(v=>v*Math.min(1,dt*.45)),city.buildings);
    aimAt([10,40,-40]);return;
  }
  const held=(...codes)=>codes.some(c=>keys.has(c))?1:0;
  const forward=held('KeyW','KeyZ','ArrowUp')-held('KeyS','ArrowDown');
  const side=held('KeyD','ArrowRight')-held('KeyA','ArrowLeft');
  const vertical=held('KeyE','Space')-held('KeyQ','KeyC','ControlLeft','ControlRight');
  const speed=(held('ShiftLeft','ShiftRight')?38:12)*dt;
  let delta=[(sin(yaw)*cos(pitch)*forward+cos(yaw)*side),sin(pitch)*forward+vertical,(-cos(yaw)*cos(pitch)*forward+sin(yaw)*side)];
  const length=hypot(...delta);if(length>1)delta=delta.map(v=>v/length);
  position=moveCamera(position,delta.map(v=>v*speed),city.buildings);
}

function render(timestamp){
  if(stopped)return;
  requestAnimationFrame(render);
  if(document.hidden){previousTime=0;return;}
  const dt=previousTime?Math.min((timestamp-previousTime)/1000,.05):1/60;previousTime=timestamp;
  worldTime+=dt;updateCamera(dt);resize();
  fillTaxis(cabData,city.taxis,worldTime);device.queue.writeBuffer(cabBuffer,0,cabData);
  const forward=[sin(yaw)*cos(pitch),sin(pitch),-cos(yaw)*cos(pitch)],right=[cos(yaw),0,sin(yaw)],up=cross(right,forward);
  const vp=multiply(perspective(lastWidth/lastHeight),lookAt(position,position.map((v,j)=>v+forward[j])));
  g.set(vp,0);g.set(lightMatrix,16);g.set([...position,worldTime],32);g.set([...forward,Math.tan(PI/6)],36);g.set([...right,lastWidth/lastHeight],40);g.set([...up,exposure],44);g.set([...sun,0],48);g.set([lastWidth,lastHeight,quality==='low'?0:1,0],52);
  device.queue.writeBuffer(uniform,0,g);
  const encoder=device.createCommandEncoder();
  // Shadows are static except for the little cabs, so render them less often.
  if(frameCount%4===0||firstFrame){
    const pass=encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:shadowView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
    pass.setPipeline(shadowPipeline);pass.setBindGroup(0,uniBind);pass.setVertexBuffer(0,cubeBuffer);pass.setVertexBuffer(1,staticBuffer);pass.draw(36,instanceCount);pass.setVertexBuffer(1,cabBuffer);pass.draw(36,cabCount);pass.end();
  }
  const scenePass=encoder.beginRenderPass({colorAttachments:[{view:hdr.createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}});
  scenePass.setPipeline(skyPipeline);scenePass.setBindGroup(0,uniBind);scenePass.draw(3);
  scenePass.setPipeline(geometryPipeline);scenePass.setBindGroup(0,geometryBind);scenePass.setVertexBuffer(0,cubeBuffer);scenePass.setVertexBuffer(1,staticBuffer);scenePass.draw(36,instanceCount);scenePass.setVertexBuffer(1,cabBuffer);scenePass.draw(36,cabCount);scenePass.end();
  const post=(pipeline,bind,target)=>{const pass=encoder.beginRenderPass({colorAttachments:[{view:target,loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.draw(3);pass.end();};
  post(downPipeline,downBind,bloomA.createView());post(blurPipeline,blurBind,bloomB.createView());post(compositePipeline,compositeBind,context.getCurrentTexture().createView());
  device.queue.submit([encoder.finish()]);
  fps=fps*.96+(1/dt)*.04;frameCount++;frameBudget+=dt;
  if(frameBudget>1){
    if(!$('stats').hidden)$('stats').textContent=`${Math.round(fps)} fps · ${lastWidth} × ${lastHeight}\n${instanceCount} objets · ${city.taxis.length} taxis\nx ${position[0].toFixed(1)} · y ${position[1].toFixed(1)} · z ${position[2].toFixed(1)}`;
    if(frameCount>150&&fps<32&&renderScale>.55){renderScale=Math.max(.55,renderScale-.08);resize();}frameBudget=0;
  }
  if(firstFrame){firstFrame=false;device.queue.onSubmittedWorkDone().then(()=>{if(stopped)return;loaded=true;$('start').disabled=false;$('tour-start').disabled=false;status('36 blocs · 40 taxis · une infinité de détours');});}
}
status('Les premiers taxis arrivent…');
requestAnimationFrame(render);

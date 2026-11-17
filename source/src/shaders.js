const CITY_COMMON = /*wgsl*/`
struct Globals {
  vp: mat4x4f, light: mat4x4f,
  camera: vec4f, forward: vec4f, right: vec4f, up: vec4f, sun: vec4f, info: vec4f,
};
@group(0) @binding(0) var<uniform> g: Globals;
fn hash2(p:vec2f)->f32 { return fract(sin(dot(p,vec2f(127.1,311.7)))*43758.5453); }
fn noise(p:vec2f)->f32 {
  let a=floor(p);let b=fract(p);let u=b*b*(3.-2.*b);
  return mix(mix(hash2(a),hash2(a+vec2f(1.,0.)),u.x),mix(hash2(a+vec2f(0.,1.)),hash2(a+1.),u.x),u.y);
}
fn sky(rd:vec3f)->vec3f {
  let h=max(rd.y,0.);
  let toward=pow(max(dot(rd,g.sun.xyz),0.),8.);
  var c=mix(vec3f(1.05,.46,.32),vec3f(.21,.25,.42),smoothstep(0.,.55,h));
  c=mix(c,vec3f(.085,.13,.28),smoothstep(.35,1.,h));
  c+=vec3f(.9,.33,.09)*toward*exp(-h*3.);
  c+=vec3f(6.,3.1,1.2)*smoothstep(.99945,.99975,dot(rd,g.sun.xyz));
  let cp=rd.xz/max(.07,h)*vec2f(1.4,2.6)+vec2f(g.camera.w*.001,0.);
  let cloud=noise(cp*2.)*.65+noise(cp*5.)*.25+noise(cp*11.)*.1;
  let wisps=smoothstep(.56,.77,cloud)*smoothstep(.03,.14,h)*(1.-smoothstep(.3,.65,h));
  c=mix(c,c*.65+vec3f(.30,.18,.22),wisps*.55);
  return c;
}
fn atmosphere(c:vec3f,p:vec3f)->vec3f {
  let v=p-g.camera.xyz;let d=length(v);
  let haze=(1.-exp(-d*.0028))*exp(-max(p.y,0.)*.002);
  return mix(c,sky(normalize(v))*.8,haze);
}
struct Screen { @builtin(position) position:vec4f, @location(0) uv:vec2f };
@vertex fn screen(@builtin(vertex_index) i:u32)->Screen {
  let p=vec2f(f32((i<<1u)&2u),f32(i&2u));
  var o:Screen;o.position=vec4f(p*2.-1.,1.,1.);o.uv=vec2f(p.x,1.-p.y);return o;
}
`;

const CITY_SKY = CITY_COMMON + /*wgsl*/`
@fragment fn fs(i:Screen)->@location(0) vec4f {
  let p=vec2f(i.uv.x*2.-1.,1.-i.uv.y*2.);
  let rd=normalize(g.forward.xyz+g.right.xyz*p.x*g.forward.w*g.right.w+g.up.xyz*p.y*g.forward.w);
  return vec4f(sky(rd),1.);
}
`;

const CITY_GEOMETRY = CITY_COMMON + /*wgsl*/`
@group(0) @binding(1) var shadowTex:texture_depth_2d;
@group(0) @binding(2) var shadowSampler:sampler_comparison;
struct Vertex {
  @location(0) p:vec3f, @location(1) n:vec3f,
  @location(2) a:vec4f, @location(3) b:vec4f, @location(4) c:vec4f, @location(5) d:vec4f,
};
struct Varying {
  @builtin(position) cp:vec4f, @location(0) wp:vec3f, @location(1) n:vec3f,
  @location(2) lp:vec3f, @location(3) @interpolate(flat) a:vec4f,
  @location(4) @interpolate(flat) b:vec4f, @location(5) @interpolate(flat) colour:vec4f,
};
fn rotate(p:vec3f,y:f32)->vec3f {let s=sin(y);let c=cos(y);return vec3f(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);}
@vertex fn vs(i:Vertex)->Varying {
  var o:Varying;let w=rotate(i.p*i.b.xyz,i.d.x)+i.a.xyz;
  o.cp=g.vp*vec4f(w,1.);o.wp=w;o.n=rotate(i.n,i.d.x);o.lp=i.p*i.b.xyz;
  o.a=i.a;o.b=i.b;o.colour=i.c;return o;
}
@vertex fn shadowVS(i:Vertex)->@builtin(position) vec4f {
  return g.light*vec4f(rotate(i.p*i.b.xyz,i.d.x)+i.a.xyz,1.);
}
fn visibility(p:vec3f,n:vec3f)->f32 {
  let s=g.light*vec4f(p+n*.20,1.);let uv=vec2f(s.x*.5+.5,.5-s.y*.5);
  if(any(uv<vec2f(.001))||any(uv>vec2f(.999))){return 1.;}
  var v=0.;
  for(var x=-1;x<=1;x++){for(var y=-1;y<=1;y++){
    v+=textureSampleCompareLevel(shadowTex,shadowSampler,uv+vec2f(f32(x),f32(y))/2048.,s.z-.00045);
  }}return v/9.;
}
@fragment fn fs(i:Varying)->@location(0) vec4f {
  let n=normalize(i.n);let view=normalize(g.camera.xyz-i.wp);let mat=i.a.w;
  var colour=i.colour.rgb;var emissive=colour*i.colour.w;
  let vis=visibility(i.wp,n);let ndl=max(dot(n,g.sun.xyz),0.);
  let sun=vec3f(1.45,.70,.36)*ndl*vis;
  let ambient=mix(vec3f(.24,.27,.39),vec3f(.45,.43,.53),n.y*.5+.5);
  let dist=length(i.wp-g.camera.xyz);
  var spec=vec3f(0.);
  // Derivatives must be evaluated before material-dependent branches in WGSL.
  let u=select(i.lp.x,i.lp.z,abs(n.x)>.5);
  let v=i.lp.y+i.b.y*.5;
  let scale=select(vec2f(2.05,3.15),vec2f(1.75,3.3),mat==2.);
  let coord=vec2f(u+i.b.x*.5,v)/scale;
  let aa=max(fwidth(coord),vec2f(.005));
  if((mat==1.||mat==2.)&&abs(n.y)<.5){
    let cell=floor(coord);let f=fract(coord);
    let margin=select(vec2f(.19,.18),vec2f(.055,.045),mat==2.);
    // A product remains in [0,1] even when grazing angles make a pixel wider
    // than a window. Subtracting overlapping ramps would make negative light.
    let aperture=vec2f(.5)-margin;
    let coverage=vec2f(1.)-smoothstep(aperture-aa,aperture+aa,abs(f-.5));
    let win=coverage.x*coverage.y;
    let rand=hash2(cell+vec2f(i.b.w*3.7,i.b.w));
    let detail=1.-smoothstep(.25,1.2,max(aa.x,aa.y));
    let on=mix(.52,smoothstep(.46,.50,rand),detail);
    let warm=mix(vec3f(1.0,.37,.10),vec3f(1.,.77,.41),hash2(cell+i.b.w+11.));
    let blinds=.65+.35*smoothstep(.15,.35,fract(f.y*5.+rand));
    let interior=warm*(.45+rand*1.4)*on*blinds;
    let reflection=sky(reflect(-view,n))*(.22+.65*pow(1.-max(dot(n,view),0.),3.));
    colour=mix(colour,vec3f(.035,.06,.09)+reflection*.23,win);
    emissive+=interior*win*1.15+reflection*win*.13;
    if(mat==1.){
      let brickUV=vec2f(u*2.6+step(.5,fract(v*2.))*0.5,v*2.);
      let brickF=fract(brickUV);let mortar=step(brickF.x,.045)+step(brickF.y,.07);
      colour*=1.-min(mortar,1.)*.22*(1.-win);
    }
    spec=reflection*win*.10;
  }
  if(mat==3.){
    let p=i.wp.xz;let road=abs(p-vec2f(64.,86.)*floor(p/vec2f(64.,86.)+.5));
    let grain=hash2(floor(p*35.));colour*=.75+grain*.5;
    let yellow=(1.-smoothstep(.08,.17,abs(road.x-.30)))*step(9.5,road.y);
    let white=(1.-smoothstep(.06,.16,abs(road.x-6.6)))*step(9.5,road.y);
    let crossZ=(1.-smoothstep(.48,.6,abs(road.y-11.)))*step(.55,fract((p.x+8.)/2.))*(1.-step(7.5,road.x));
    let crossX=(1.-smoothstep(.48,.6,abs(road.x-11.)))*step(.55,fract((p.y+8.)/2.))*(1.-step(6.5,road.y));
    colour=mix(colour,vec3f(.65,.39,.08),yellow);colour=mix(colour,vec3f(.58,.57,.52),max(white,max(crossZ,crossX)));
    let puddles=smoothstep(.65,.8,noise(p*.13))*.2;
    spec=sky(reflect(-view,n))*(.05+puddles)*pow(1.-max(dot(n,view),0.),4.);
    // Pools of warm lamplight around each procedurally placed street lamp.
    let lx=abs(road.x-8.85);let zcell=fract((p.y-17.)/86.)*86.;
    let lz=min(min(zcell,86.-zcell),abs(zcell-40.));
    emissive+=vec3f(.55,.25,.065)*exp(-(.07*lx*lx+.05*lz*lz));
  }
  if(mat==4.){
    let tile=fract(i.wp.xz/1.8);let seam=step(tile.x,.025)+step(tile.y,.025);colour*=1.-min(seam,1.)*.25;
  }
  if(mat==7.){colour*=.75+.25*step(.1,fract((i.wp.x+i.wp.z)*3.));}
  if(mat==8.){colour*=.7+.5*noise(i.wp.xz*2.);}
  if(mat==9.||mat==10.){
    let green=select(0.,1.,fract(g.camera.w/14.)<10./14.);
    emissive*=select(1.-green,green,mat==10.);
  }
  let ao=.6+.4*smoothstep(0.,12.,i.wp.y);
  var lit=colour*(sun+ambient*ao)+emissive+spec;
  if(mat==2.){lit+=vec3f(1.2,.7,.4)*pow(max(dot(reflect(-g.sun.xyz,n),view),0.),70.)*vis*.3;}
  return vec4f(atmosphere(lit,i.wp),1.);
}
`;

const CITY_POST = CITY_COMMON + /*wgsl*/`
@group(0) @binding(1) var source:texture_2d<f32>;
@group(0) @binding(2) var linearSampler:sampler;
@group(0) @binding(3) var bloom:texture_2d<f32>;
@fragment fn downsample(i:Screen)->@location(0) vec4f {
  let px=1./vec2f(textureDimensions(source));var c=vec3f(0.);
  for(var x=-1;x<=1;x++){for(var y=-1;y<=1;y++){
    let s=textureSample(source,linearSampler,i.uv+vec2f(f32(x),f32(y))*px*2.).rgb;
    c+=max(s-vec3f(.8),vec3f(0.));
  }}return vec4f(c/9.,1.);
}
@fragment fn blur(i:Screen)->@location(0) vec4f {
  let px=1./vec2f(textureDimensions(source));var c=vec3f(0.);var weight=0.;
  for(var x=-3;x<=3;x++){for(var y=-3;y<=3;y++){
    let w=exp(-f32(x*x+y*y)/7.);c+=textureSample(source,linearSampler,i.uv+vec2f(f32(x),f32(y))*px*1.5).rgb*w;weight+=w;
  }}return vec4f(c/weight,1.);
}
@fragment fn composite(i:Screen)->@location(0) vec4f {
  var c=textureSample(source,linearSampler,i.uv).rgb;
  c+=textureSample(bloom,linearSampler,i.uv).rgb*.30*g.info.z;
  c*=g.up.w;
  c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);
  let edge=length((i.uv-.5)*vec2f(1.,.8));c*=1.-edge*edge*.22;
  c=pow(max(c,vec3f(0.)),vec3f(1./2.2));
  c+=(hash2(i.uv*g.info.xy+fract(g.camera.w)*31.)-.5)/255.;
  return vec4f(c,1.);
}
`;

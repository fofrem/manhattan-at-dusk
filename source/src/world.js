// Native GPU instances: centre/material, dimensions/seed, colour/emission, yaw/spare.
function makeCity() {
  rseed(74);
  const instances=[], buildings=[], taxis=[];
  const box=(x,y,z,w,h,d,c,mat=0,emission=0,yaw=0)=>instances.push(x,y,z,mat,w,h,d,rnd()*1000,...c,emission,yaw,0,0,0);
  const solid=(x,y,z,w,h,d,c,mat=1)=>{
    box(x,y,z,w,h,d,c,mat);
    buildings.push({minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2});
  };
  const brick=[[.25,.14,.12],[.34,.23,.18],[.22,.25,.29],[.43,.38,.30],[.19,.22,.24],[.33,.21,.17]];
  box(0,-.25,0,1500,.5,1500,[.055,.07,.10],3);
  const tower=(x,z,w,d,h,c,glass,hero=false)=>{
    const mat=glass?2:1;
    solid(x,h/2+.3,z,w,h,d,c,mat);
    box(x,h+.5,z,w+.6,.7,d+.6,c.map(v=>v*1.2));
    box(x,h+1.3,z,w-.8,1.2,d-.8,[.09,.11,.14]);
    let top=h+1.9;
    if(h>45||hero){
      const hh=hero?20:rr(7,15);
      solid(x,top+hh/2,z,w*.72,hh,d*.72,c,mat);top+=hh;
      box(x,top+.2,z,w*.75,.5,d*.75,c.map(v=>v*1.3));
      if(hero){
        solid(x,top+8,z,w*.44,16,d*.44,c,mat);top+=16;
        box(x,top+3,z,w*.24,6,d*.24,[.65,.52,.33],0,.3);top+=6;
        box(x,top+6,z,.35,12,.35,[.58,.47,.30],0,.15);top+=12;
      }
    }
    if(!glass&&rnd()>.32){
      const tx=x+w*.22,tz=z-d*.19,ty=top+4;
      for(const dx of [-1.5,1.5])for(const dz of [-1.5,1.5])box(tx+dx,top+1.2,tz+dz,.15,2.4,.15,[.09,.08,.075]);
      for(let j=0;j<8;j++)box(tx,ty,tz,3.7,3.6,1.55,[.20,.12,.075],7,0,j*PI/4);
      box(tx,ty+2,tz,4.2,.45,4.2,[.12,.10,.09]);
    }
    for(let j=0;j<2;j++)box(x+rr(-w*.25,w*.25),top+.8,z+rr(-d*.2,d*.2),rr(1.6,3),1.5,2,[.22,.25,.27]);
    if(!glass){for(let y=4;y<h;y+=rr(9,15))box(x,y,z,w+.18,.20,d+.18,c.map(v=>v*1.3));}
    else{for(let dx=-w/2;dx<=w/2;dx+=w/5)for(const side of [-1,1])box(x+dx,h/2,z+side*(d/2+.04),.14,h,.14,[.27,.30,.33]);}
    for(const side of [-1,1]){
      box(x,1.9,z+side*(d/2+.04),w*.78,2.5,.09,[.25,.31,.33],2);
      box(x,3.5,z+side*(d/2+.8),w*.88,.35,1.7,rnd()>.5?[.17,.25,.23]:[.33,.15,.12]);
      box(x,3.1,z+side*(d/2+.1),w*.58,.32,.10,[1,.58,.22],6,1.2);
    }
    if(!glass&&rnd()>.42){
      const xx=x+w/2+.8;
      for(let y=7;y<Math.min(h,34);y+=3.5){
        box(xx,y,z,1.6,.12,3.7,[.08,.085,.09]);
        box(xx+.7,y+.5,z,.08,1.1,3.7,[.08,.085,.09]);
        box(xx,y-1.5,z,.12,3.7,.16,[.08,.085,.09],0,0,.24);
      }
    }
  };
  for(let gx=-3;gx<3;gx++)for(let gz=-3;gz<3;gz++){
    const cx=gx*64+32,cz=gz*86+43;
    box(cx,.11,cz,46,.22,70,[.32,.31,.30],4);
    if(gx===1&&gz===1){
      box(cx,.27,cz,40,.15,63,[.13,.19,.13],8);
      box(cx,.39,cz,3,.08,63,[.43,.38,.29]);
      for(let i=0;i<14;i++){
        const x=cx+rr(-17,17),z=cz+rr(-28,28),h=rr(5,9);
        box(x,h/2,z,.32,h,.32,[.18,.12,.08]);
        for(let j=0;j<3;j++)box(x+rr(-1,1),h+rr(-.7,.7),z+rr(-1,1),rr(3,5),rr(3,5),rr(3,5),[.11+rr(0,.04),.19+rr(0,.05),.12],8,0,rnd()*PI);
      }
      continue;
    }
    for(let a=0;a<2;a++)for(let b=0;b<3;b++){
      const x=cx+(a-.5)*21,z=cz+(b-1)*22,w=rr(16.4,19.5),d=rr(17,20.5);
      let h=rr(15,39),glass=rnd()<.20;
      if(Math.abs(gx)<2&&gz<1)h+=rr(12,40);
      if(glass)h+=rr(15,35);
      const hero=gx===0&&gz===-1&&a===0&&b===1;
      if(hero){h=92;glass=false;}
      tower(x,z,w,d,h,hero?[.47,.40,.31]:glass?[.10,.18,.23]:brick[(rnd()*brick.length)|0],glass,hero);
    }
  }
  for(let gx=-3;gx<=3;gx++)for(let gz=-3;gz<3;gz++)for(const side of [-1,1])for(const dz of [17,57]){
    const x=gx*64+side*10.1,z=gz*86+dz;
    box(x,3.3,z,.17,6.6,.17,[.09,.11,.11]);
    box(x-side*.65,6.6,z,1.5,.13,.15,[.12,.14,.14]);
    box(x-side*1.25,6.5,z,.9,.12,.5,[1,.62,.25],6,5);
    if(dz===17){box(x,5.2,z,2,.38,.08,[.10,.25,.18]);box(x,5.15,z+.05,1.5,.055,.02,[.69,.76,.60],6,.4);}
  }
  for(let x=-128;x<=128;x+=64)for(let z=-172;z<=172;z+=86){
    box(x+8.5,3,z+9,.18,6,.18,[.12,.13,.14]);box(x+6,5.7,z+9,5,.14,.16,[.15,.16,.17]);
    box(x+3.8,5.3,z+9,.55,1,.40,[.17,.13,.07]);
    box(x+3.8,5.5,z+9.22,.22,.22,.05,[1,.15,.03],9,3);
    box(x+3.8,5.05,z+9.22,.22,.22,.05,[.15,1,.43],10,3);
  }
  for(let side=0;side<4;side++)for(let i=0;i<36;i++){
    const u=rr(-520,520),edge=rr(320,490),h=rr(25,150);
    box(side<2?u:edge*(side===2?-1:1),h/2,side<2?edge*(side===0?-1:1):u,rr(14,30),h,rr(14,30),[.17,.19,.25],2);
  }
  for(let road=-2;road<=2;road++)for(let i=0;i<8;i++){
    const axis=i%2,direction=i%4<2?1:-1;
    taxis.push({axis,direction,lane:road*(axis===0?64:86)+direction*3.4,phase:(i%4)*3.5,offset:Math.floor(i/2)*90,speed:1});
  }
  return {instances:new Float32Array(instances),buildings,taxis};
}

function fillTaxis(out,taxis,time){
  let cursor=0;
  for(const taxi of taxis){
    const {x,z,yaw}=taxiPosition(taxi,time),sy=sin(yaw),cy=cos(yaw);
    const part=(dx,y,dz,w,h,d,c,mat=0,emission=0)=>{
      out.set([x+dx*cy+dz*sy,y,z-dx*sy+dz*cy,mat,w,h,d,1,...c,emission,yaw,0,0,0],cursor);cursor+=16;
    };
    part(0,.75,0,1.85,.65,4.25,[.95,.51,.035]);part(0,1.28,-.18,1.62,.65,2.05,[.96,.59,.07]);
    part(0,1.29,.88,1.48,.46,.035,[.08,.15,.20],2);part(0,1.29,-1.22,1.48,.44,.035,[.08,.13,.17],2);
    for(const s of [-1,1]){
      part(s*.83,1.3,-.18,.025,.42,1.68,[.07,.13,.17],2);part(s*.84,1.3,-.15,.04,.48,.10,[.80,.44,.035]);
      for(const zz of [-1.3,1.3])part(s*.92,.44,zz,.24,.56,.63,[.035,.04,.05]);
      part(s*.60,.83,2.14,.4,.23,.045,[1,.84,.52],6,7);part(s*.61,.83,-2.14,.40,.21,.045,[1,.055,.025],6,4);
    }
    part(0,1.77,-.14,.64,.24,.40,[1,.76,.25],6,2);part(0,.46,2.15,1.6,.14,.09,[.36,.39,.40]);
  }
  return cursor/16;
}

// Small swept steps prevent crossing thin walls; separate axes allow wall sliding.
function moveCamera(position, delta, buildings) {
  const p = [...position], radius = .55;
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / .35));
  for (let step = 0; step < steps; step++) for (const axis of [0, 2, 1]) {
    const amount = delta[axis] / steps;
    p[axis] += amount;
    for (const b of buildings) {
      if (p[0] > b.minX-radius && p[0] < b.maxX+radius && p[1] > b.minY-radius && p[1] < b.maxY+radius && p[2] > b.minZ-radius && p[2] < b.maxZ+radius) {
        p[axis] = amount >= 0 ? [b.minX,b.minY,b.minZ][axis]-radius : [b.maxX,b.maxY,b.maxZ][axis]+radius;
      }
    }
    p[0] = Math.max(-208, Math.min(208,p[0]));
    p[1] = Math.max(1.7, Math.min(230,p[1]));
    p[2] = Math.max(-288, Math.min(288,p[2]));
  }
  return p;
}

function taxiPosition(taxi, seconds) {
  const span = taxi.axis === 0 ? 86 : 64, t = seconds*taxi.speed+taxi.phase;
  const cycle = Math.floor(t/14), phase = ((t%14)+14)%14;
  const extent = span*6;
  const along = ((taxi.offset+(cycle+Math.min(phase/10,1))*span*taxi.direction+extent*50)%extent)-extent/2;
  return {x:taxi.axis===0?taxi.lane:along,z:taxi.axis===0?along:taxi.lane,
    yaw:taxi.axis===0?(taxi.direction>0?0:Math.PI):(taxi.direction>0?Math.PI/2:-Math.PI/2)};
}

const VIEWPOINTS = [
  {name:'La ville s’allume',position:[0,25,128],target:[-8,39,-75]},
  {name:'Au niveau de la rue',position:[0,2.1,45],target:[-5,14,-90]},
  {name:'Les toits de Manhattan',position:[0,122,135],target:[15,33,-55]},
  {name:'L’heure dorée',position:[128,48,0],target:[-110,32,-35]},
  {name:'Les taxis de la 5e',position:[3,5,-55],target:[-2,8,160]},
  {name:'Au-dessus des avenues',position:[-128,175,175],target:[18,45,-50]},
];

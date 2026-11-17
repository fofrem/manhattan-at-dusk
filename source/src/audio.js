// Synthesized only after a user gesture. No recordings or external requests.
function makeCityAudio(){
  let context,master,enabled=false,timer;
  const start=async()=>{
    if(!context){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return false;
      context=new Audio();master=context.createGain();master.gain.value=0;master.connect(context.destination);
      const data=context.createBuffer(1,context.sampleRate*4,context.sampleRate),samples=data.getChannelData(0);
      let last=0;for(let i=0;i<samples.length;i++){last=(last+Math.random()*.04-.02)*.993;samples[i]=last;}
      const noise=context.createBufferSource();noise.buffer=data;noise.loop=true;
      const low=context.createBiquadFilter();low.type='lowpass';low.frequency.value=550;
      noise.connect(low);low.connect(master);noise.start();
      const hum=context.createOscillator(),gain=context.createGain();hum.frequency.value=53;gain.gain.value=.035;hum.connect(gain);gain.connect(master);hum.start();
      const horn=()=>{
        if(!enabled)return;
        const t=context.currentTime,volume=context.createGain();volume.gain.setValueAtTime(0,t);volume.gain.linearRampToValueAtTime(.017,t+.12);volume.gain.exponentialRampToValueAtTime(.0001,t+.65);volume.connect(master);
        for(const frequency of [311,392]){const oscillator=context.createOscillator();oscillator.type='triangle';oscillator.frequency.value=frequency;oscillator.connect(volume);oscillator.start(t);oscillator.stop(t+.7);}
      };
      timer=setInterval(horn,9300);
    }
    await context.resume();return true;
  };
  return {async toggle(){if(!await start())return false;enabled=!enabled;master.gain.setTargetAtTime(enabled?.65:0,context.currentTime,.5);return enabled;},pause(){if(context)context.suspend();},resume(){if(context&&enabled)context.resume().catch(()=>{});}};
}

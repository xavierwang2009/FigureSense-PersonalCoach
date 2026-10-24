// Demo annotations were placed by visual review, in the 640 × 360 source frame.
// Hash matching prevents these points from being applied to a different upload.
export const DEMO_HASH = '3107b57580dad6cbfddc752a9613e5937c04997450a19b6668e8f82024ad242c';
export const DEMO_PICKS = [
  {id:'bl1',time:1,points:{waterA:[170,234],waterB:[510,234],shoulder:[255,229],hip:[338,236],knee:[400,238],ankle:[475,235],ankleB:[469,240]}},
  {id:'bk1',time:3.5,points:{waterA:[170,226],waterB:[480,226],shoulder:[250,229],hip:[315,235],knee:[331,203],ankle:[374,227],ankleB:[442,220]}},
  {id:'ballet',time:6.5,points:{waterA:[170,198],waterB:[480,198],shoulder:[247,194],hip:[312,202],knee:[325,150],ankle:[331,108],ankleB:[440,193]}},
  {id:'bk2',time:9.5,points:{waterA:[170,184],waterB:[480,184],shoulder:[245,181],hip:[309,189],knee:[321,158],ankle:[363,182],ankleB:[433,182]}},
  {id:'bl2',time:11.5,points:{waterA:[170,163],waterB:[480,163],shoulder:[245,157],hip:[315,164],knee:[375,165],ankle:[442,161],ankleB:[440,166]}}
];
const angle = (a,b,c) => {
  const u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y];
  return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v))))) *180/Math.PI;
};
export function poseCandidate(lm, width, height, waterline) {
  if (!lm) return null;
  const p=lm.map(a=>({...a,x:a.x*width,y:a.y*height}));
  const base=Math.atan2(waterline[1][1]-waterline[0][1],waterline[1][0]-waterline[0][0]);
  const tilt=(a,b)=> {let t=Math.abs((Math.atan2(b.y-a.y,b.x-a.x)-base)*180/Math.PI)%180;return Math.min(t,180-t);};
  const sides=[[11,23,25,27,28],[12,24,26,28,27]].map(ids=>{
    if(ids.some(i=>(p[i]?.visibility??0)<0.55))return null;
    const [s,h,k,a,o]=ids.map(i=>p[i]);
    return {ids,thigh:tilt(h,k),leg:tilt(h,a),knee:angle(h,k,a),body:tilt(s,h),other:tilt(h,o)};
  }).filter(Boolean);
  if(!sides.length)return null;
  const f=sides.sort((a,b)=>b.thigh-a.thigh)[0];
  if (![f.thigh,f.leg,f.knee,f.body,f.other].every(Number.isFinite)) return null;
  const penalty=(f.body+f.other)/180;
  const flat=1-(f.leg/90+(180-f.knee)/180)/2-penalty;
  const bent=1-(Math.abs(f.thigh-90)/90+Math.abs(f.knee-90)/90)/2-penalty;
  const ballet=1-(Math.abs(f.leg-90)/90+(180-f.knee)/90)/2-penalty;
  const points=Object.fromEntries(['shoulder','hip','knee','ankle','ankleB'].map((k,i)=>[k,[p[f.ids[i]].x,p[f.ids[i]].y]]));
  return {scores:[f.leg<30 && f.knee>145 ? flat : -1, f.thigh>40 && f.knee>=45 && f.knee<145 ? bent : -1, f.leg>50 && f.knee>145 ? ballet : -1, f.thigh>40 && f.knee>=45 && f.knee<145 ? bent : -1, f.leg<30 && f.knee>145 ? flat : -1],points};
}
// Ordered sequence search. Refuse weak/incomplete tracks rather than inventing timestamps.
export function pickBalletSequence(samples) {
  const rows=samples.filter(s=>s.candidate);
  if(rows.length<5)return null;
  let previous=rows.map(s=>({score:s.candidate.scores[0],path:[s]}));
  for(let step=1;step<5;step++) {
    const next=rows.map(()=>null);
    rows.forEach((s,i)=>{
      const quality=s.candidate.scores[step];
      if(quality<0.35)return;
      for(let j=0;j<i;j++) {
        const prev=previous[j];
        if(!prev || s.time-rows[j].time<0.4 || prev.path.some((p,k)=>p.candidate.scores[k]<0.35))continue;
        // Prefer nearby frames with similar geometry: a hold, not a single noisy detection.
        const neighbor=rows[i-1];
        const stable=neighbor && s.time-neighbor.time<0.6 ? Math.max(0,0.12-Math.abs(quality-neighbor.candidate.scores[step])) : 0;
        const score=prev.score+quality+stable;
        if(!next[i] || score>next[i].score)next[i]={score,path:[...prev.path,s]};
      }
    });
    previous=next;
  }
  return previous.filter(Boolean).sort((a,b)=>b.score-a.score)[0]?.path ?? null;
}

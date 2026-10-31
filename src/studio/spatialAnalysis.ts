import type { BoardPlayer, Frame } from '../types';
export const pitchDistance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot((a.x-b.x)*105,(a.y-b.y)*68);
export function teamDimensions(players:BoardPlayer[]) {
  const outfield=players.filter(p=>!/Goalkeeper|^GK?$|^G$/i.test(p.position||''));
  if(!outfield.length)return null;
  return {width:(Math.max(...outfield.map(p=>p.y))-Math.min(...outfield.map(p=>p.y)))*68,depth:(Math.max(...outfield.map(p=>p.x))-Math.min(...outfield.map(p=>p.x)))*105,count:outfield.length};
}
export function passingOptions(frame:Frame,ownerId=frame.ball.carrierId) {
  const owner=frame.players.find(p=>p.uid===ownerId);if(!owner)return [];
  return frame.players.filter(p=>p.side===owner.side&&p.uid!==owner.uid).map(receiver=>{
    const dx=(receiver.x-owner.x)*105,dy=(receiver.y-owner.y)*68,length2=dx*dx+dy*dy;
    const blockers=frame.players.filter(p=>p.side!==owner.side).filter(p=>{
      if(length2<.01)return false;
      const px=(p.x-owner.x)*105,py=(p.y-owner.y)*68,t=(px*dx+py*dy)/length2;
      return t>.05&&t<.95&&Math.hypot(px-t*dx,py-t*dy)<=1.5;
    });
    return {receiver,distance:Math.sqrt(length2),blocked:blockers.length>0};
  }).filter(p=>p.distance<=40&&p.distance>.1).sort((a,b)=>a.distance-b.distance);
}

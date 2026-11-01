import { describe, it, expect, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
const media = vi.hoisted(() => new Map<string, Blob>());
const records = vi.hoisted(() => new Map<string, unknown>());
vi.mock("../src/studio/assetStore", () => ({
  getMedia: async (id: string) => media.get(id) || null,
  saveMedia: async (id: string, value: Blob) => {
    media.set(id, value);
  },
  putRecord: async (_: string, id: string, value: unknown) => {
    records.set(id, value);
  },
}));
import { exportPack, importPack } from "../src/studio/exports";
import { newBoard } from "../src/core";
import catalogue from "../public/data/catalogue.json";
import type { Team } from "../src/types";
import type { MediaAsset } from "../src/studio/types";
import { giveBall } from '../src/studio/possession';
import { syncScene, copy } from '../src/core';
import { freezeComparison } from '../src/football/comparisonModel';
import { makeCue } from "../src/studio/cueModel";
import { addCounterattack, moveUnit, unitPlayers } from '../src/studio/teamMovement';
import { buildPlay } from '../src/studio/playbook';
describe("portable analysis handoff", () => {
  it('round-trips ball ownership, curved runs and a five-team graphic with its full statistics',async()=>{
    const board=newBoard(catalogue.teams[0] as unknown as Team,catalogue.teams[1] as unknown as Team);giveBall(board,board.players[1].uid);syncScene(board);
    const end=copy(board.scenes[0]);end.id='run-end';end.players[1].x+=.2;end.motion={easing:'linear',curves:{[board.players[1].uid]:.5}};board.scenes.push(end);
    board.studio!.comparison=freezeComparison({kind:'teams',title:'Five clubs',scope:'Premier League 2026/27',source:'ESPN',basis:'totals',fields:['points',...Array.from({length:12},(_,i)=>`metric${i}`)],entities:Array.from({length:5},(_,i)=>({id:String(i),name:`Club ${i}`,stats:{points:{label:'Points',value:i*3},extra:{label:'Another statistic',value:10+i},...Object.fromEntries(Array.from({length:12},(_,j)=>[`metric${j}`,{label:`Metric ${j}`,value:j+i}]))}}))});
    board.studio!.statsScroll=3.25;board.studio!.cues=[makeCue(board,'board','broadcast',0),makeCue(board,'stats','broadcast',0)];
    const packed=await exportPack(board,[]),restored=await importPack(new File([packed.blob],'upgrade.touchline.zip'));
    expect(restored.ball.carrierId).toBe(board.players[1].uid);expect(restored.scenes[1].motion).toEqual(end.motion);expect(restored.studio!.comparison).toEqual(board.studio!.comparison);expect(restored.studio!.cues![1].comparison!.entities).toHaveLength(5);expect(restored.studio!.cues![1].comparison!.fields).toHaveLength(13);expect(restored.studio!.cues![1].statsScroll).toBe(3.25);expect(restored.studio!.cues![1].comparison!.entities[0].stats.extra.value).toBe(10);
  });
  it('retains named set-piece roles, cuts and complete phases in the exported project',async()=>{
    const original=newBoard(catalogue.teams[0] as unknown as Team,catalogue.teams[1] as unknown as Team),players=original.players.filter(p=>p.side==='home');
    const board=buildPlay(original,{id:'corner',side:'home',direction:'left',flank:'bottom',pattern:'short',marking:'man',wallSize:3,seconds:4,mode:'sequence',takerId:players[1].uid,receiverId:players[5].uid,goalTarget:'centre',guides:true});
    board.studio!.cues=[makeCue(board,'board','broadcast',0)];
    const packed=await exportPack(board,[]),restored=await importPack(new File([packed.blob],'corner.touchline.zip'));
    expect(restored.scenes).toEqual(board.scenes);expect(restored.scenes[1].cut).toBe(true);
    expect(restored.scenes[1].play!.roles['home:taker']).toBe(players[1].uid);expect(restored.scenes.at(-1)!.play!.roles['home:receiver']).toBe(players[5].uid);
    expect(restored.studio!.cues![0].sequence).toEqual(board.scenes);
  });
  it('retains the complete counterattack, grouped defensive edit and saved show moment in the actual ZIP format',async()=>{
    let board=addCounterattack(newBoard(catalogue.teams[0] as unknown as Team,catalogue.teams[1] as unknown as Team),{side:'home',direction:'right',seconds:4});
    const end=board.scenes.at(-1)!;board.activeScene=end.id;board.players=structuredClone(end.players);board.ball=structuredClone(end.ball);
    board=moveUnit(board,{ids:unitPlayers(board,'away','back').map(p=>p.uid),operation:'back',direction:'left'});
    board.studio!.cues=[makeCue(board,'board','broadcast',0)];
    const result=await exportPack(board,[]),restored=await importPack(new File([result.blob],'counterattack.touchline.zip'));
    expect(restored.scenes).toEqual(board.scenes);expect(restored.players).toEqual(board.players);
    expect(restored.players).toHaveLength(22);expect(restored.studio!.cues![0].sequence).toEqual(board.scenes);
  });
  it("round-trips original source bytes and remaps every document reference", async () => {
    const board = newBoard(
        catalogue.teams[0] as unknown as Team,
        catalogue.teams[1] as unknown as Team,
      ),
      id = "old-source";
    const asset: MediaAsset = {
      id,
      name: "test.mp4",
      type: "video",
      mime: "video/mp4",
      size: 6,
      width: 1280,
      height: 720,
      duration: 10,
      fps: 25,
      createdAt: "2026-10-30",
      thumbnail: "data:image/jpeg;base64,YWJj",
    };
    media.set(id, new Blob(["source"]));
    const d = board.studio!;
    d.assetId = id;
    d.sourceRanges = { [id]: { start: 2, end: 8 } };
    d.view = "split";
    d.ink[id] = [
      {
        id: "arrow",
        type: "arrow",
        points: [0.2, 0.3, 0.7, 0.6],
        color: "#fff",
        width: 3,
        opacity: 1,
        space: "pitch",
        assetId: id,
        from: 0,
        to: 10,
      },
    ];
    d.landmarks[id] = [];
    d.targets[id] = [];
    d.tracking[id] = {
      assetId: id,
      start: 0,
      end: 1,
      frames: [],
      targets: [],
      reviewed: true,
      method: "test",
      createdAt: "",
    };
    d.bookmarks = [
      {
        id: "moment",
        assetId: id,
        time: 1,
        title: "Moment",
        note: "Panel note",
      },
    ];
    board.scenes[0].source = { assetId: id, time: 0, review: false };
    d.cues = [makeCue(board, "footage", "endline", 4)];
    d.dataReports = {
      "match-1": {
        id: "match-1",
        lineups: [
          {
            teamId: board.homeTeamId,
            side: "home",
            players: [
              {
                id: "p1",
                name: "Saved player",
                starter: true,
                stats: {
                  totalGoals: { label: "Goals", value: 1, display: "1" },
                },
              },
            ],
          },
        ],
        teamStats: [],
      },
    };
    d.statsReportId = "match-1";
    d.statsPlayerId = "p1";
    d.cues.push(makeCue(board, "stats", "broadcast", 0));
    const result = await exportPack(board, [asset]);
    const restored = await importPack(
      new File([result.blob], "project.touchline.zip"),
    );
    const next = restored.studio!.assetId!;
    expect(next).not.toBe(id);
    expect(restored.studio!.sourceRanges?.[next]).toEqual({ start: 2, end: 8 });
    expect(restored.studio!.sourceRanges?.[id]).toBeUndefined();
    expect(await media.get(next)!.text()).toBe("source");
    expect(media.get(id)).toBeDefined();
    expect(restored.studio!.ink[next][0].assetId).toBe(next);
    expect(restored.studio!.tracking[next].assetId).toBe(next);
    expect(restored.studio!.bookmarks[0].assetId).toBe(next);
    expect(restored.scenes[0].source!.assetId).toBe(next);
    expect(restored.studio!.targets[next]).toEqual([]);
    expect(restored.studio!.landmarks[next]).toEqual([]);
    expect(restored.studio!.view).toBe("split");
    expect(restored.studio!.cues![0].assetId).toBe(next);
    expect(restored.studio!.cues![0].ink[0].assetId).toBe(next);
    expect(restored.studio!.cues![0].camera).toBe("endline");
    expect(restored.studio!.dataReports!["match-1"]).toEqual(
      d.dataReports["match-1"],
    );
    expect(restored.studio!.cues![1].statsPlayerId).toBe("p1");
    expect(restored.studio!.cues![1].assetId).toBeUndefined();
    expect(records.has(next)).toBe(true);
  });
  it("refuses an archive whose referenced source is missing", async () => {
    const board = newBoard(
      catalogue.teams[0] as unknown as Team,
      catalogue.teams[1] as unknown as Team,
    );
    const bytes = zipSync({
      "project.json": strToU8(
        JSON.stringify({
          format: "touchline-project",
          version: 2,
          board,
          assets: [
            {
              id: "missing",
              name: "source",
              type: "video",
              thumbnail: "data:image/jpeg;base64,YQ==",
              duration: 10,
            },
          ],
        }),
      ),
    });
    await expect(
      importPack(new File([bytes as BlobPart], "missing.zip")),
    ).rejects.toThrow("source file is missing");
  });
});

it('round-trips source adjustments, segment metadata, camera poses, rejected observations and ordered views',async()=>{
 const b=newBoard(catalogue.teams[0] as unknown as Team,catalogue.teams[1] as unknown as Team),d=b.studio!,id='media-phase1';
 const a:MediaAsset={id,name:'Passage.mp4',type:'video',mime:'video/mp4',size:3,width:1280,height:720,duration:50,fps:25,createdAt:'2026-11-01',thumbnail:'data:image/jpeg;base64,YWJj',matchId:'match',segment:'The overload',notes:'Follow the runner',tags:['press'],referenceTime:240,measuredFps:25,timing:'packet-average'};
 media.set(id,new Blob(['abc']));d.assetId=id;d.trim={start:30,end:40};d.playbackRate=.5;d.sourcePresentations={[id]:{original:false,annotations:true,rotation:90,crop:{x:.1,y:.1,width:.8,height:.8},brightness:1.2,contrast:1.1}};d.cameraPose={position:[20,70,90],target:[5,0,0],fov:40};d.comparisonView='3d';d.stillOrder=[id];d.ink[id]=[{id:'curve',assetId:id,type:'arrow',points:[.2,.3,.6,.7],curve:.6,color:'#dfff81',width:4,opacity:.8,hidden:false,from:30,to:40}];
 d.tracking[id]={assetId:id,start:30,end:40,reviewed:true,createdAt:'2026-11-01',method:'test',targets:[{id:'p',name:'Player',number:'8',side:'home',image:{x:.3,y:.4}}],frames:[{time:30,cameraConfidence:1,points:[{id:'p',image:{x:.3,y:.4},pitch:{x:.4,y:.5},confidence:.4,review:true,rejected:true}]}]};
 d.cues=[makeCue(b,'split','endline',35)];d.cues[0].segmentId='story';d.cues[0].segmentTitle='The overload';
 const pack=await exportPack(b,[a]),restored=await importPack(new File([pack.blob],'media.touchline.zip')),newId=restored.studio!.assetId!;
 expect(newId).not.toBe(id);expect(restored.studio!.sourcePresentations![newId]).toEqual(d.sourcePresentations[id]);expect(restored.studio!.stillOrder).toEqual([newId]);expect(restored.studio!.cues![0]).toMatchObject({assetId:newId,playbackRate:.5,segmentId:'story',cameraPose:d.cameraPose,comparisonView:'3d'});expect(restored.studio!.tracking[newId].frames[0].points[0].rejected).toBe(true);expect((records.get(newId) as MediaAsset).notes).toBe('Follow the runner');expect(restored.studio!.ink[newId][0].curve).toBe(.6);
});

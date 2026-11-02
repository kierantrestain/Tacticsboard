import { it, expect, vi } from "vitest";
import { newBoard, copy } from "../src/core";
import catalogue from "../public/data/catalogue.json";
const state = vi.hoisted(() => ({
  studio: {} as any,
  runtime: {} as any,
  persisted: null as any,
}));
vi.mock("../src/store", () => ({
  useStudio: { getState: () => state.studio },
}));
vi.mock("../src/studio/runtime", () => ({
  useRuntime: { getState: () => state.runtime },
}));
vi.mock("../src/studio/production", () => ({ takeToAir: vi.fn(), setLiveFollow:(follow:boolean)=>{state.runtime.follow=follow;} }));
vi.mock("../src/studio/capture", () => ({ captureThumbnail: () => undefined }));
import { saveCue, updateCue, recallCue } from "../src/studio/showControl";
it("persists explicit save and update immediately, without waiting for draft autosave", () => {
  const board = newBoard(catalogue.teams[0] as any, catalogue.teams[1] as any);
  board.studio!.playbackRate = 0.5;
  state.studio = {
    board,
    previewTime: null,
    notify: vi.fn(),
    commit: (fn: any) => fn(board),
    save: () => {
      state.persisted = copy(board);
    },
  };
  state.runtime = {
    view: "board",
    camera: "broadcast",
    time: 0,
    movementDraft: null,
    activeCueId: null,
    set: (patch: any) => Object.assign(state.runtime, patch),
  };
  saveCue();
  const cue = state.persisted.studio.cues[0];
  expect(cue.playbackRate).toBe(0.5);
  expect(state.runtime.activeCueId).toBe(cue.id);
  board.studio!.playbackRate = 0.25;
  updateCue();
  expect(state.persisted.studio.cues[0]).toMatchObject({
    id: cue.id,
    playbackRate: 0.25,
  });
  expect(state.persisted.studio.cues).toHaveLength(1);
});
it('privately recalls a saved moment without letting live follow replace the held take',()=>{
 const b=newBoard(catalogue.teams[0] as any,catalogue.teams[1] as any);
 state.studio={board:b,previewTime:null,notify:vi.fn(),save:vi.fn(),set:vi.fn(),commit:(fn:any)=>{expect(state.runtime.follow).toBe(false);fn(b);}};
 const held={id:'held-before-recall'};
 state.runtime={view:'board',camera:'broadcast',time:0,movementDraft:null,follow:false,program:held,assets:[],set:(p:any)=>Object.assign(state.runtime,p)};
 saveCue(); const id=b.studio!.cues![0].id; state.runtime.follow=true;
 recallCue(id);
 expect(state.runtime.follow).toBe(false);expect(state.runtime.program).toBe(held);
 expect(state.runtime.activeCueId).toBe(id);
});

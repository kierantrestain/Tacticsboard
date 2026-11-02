import { beforeEach, afterEach, it, expect } from "vitest";
import { createServer } from "node:http";
import { createStudioRooms } from "../server/studio-room.mjs";
import { STUDIO_PROTOCOL, commandContext } from "../server/studio-protocol.mjs";
let server, relay, base, clock, streams;
beforeEach(async () => {
  clock = Date.now();
  streams = [];
  relay = createStudioRooms({ now: () => clock });
  server = createServer((req, res) => {
    void relay.handle(req, res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/api/studio/`;
});
afterEach(async () => {
  streams.forEach((s) => s.close());
  relay.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});
async function post(path, session, data) {
  const res = await fetch(
    base + path + (session ? "?room=" + session.room : ""),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: "Bearer " + session.token } : {}),
      },
      body: JSON.stringify(data),
    },
  );
  return { status: res.status, ...(await res.json()) };
}
async function events(session) {
  const abort = new AbortController(),
    res = await fetch(base + "events?room=" + session.room, {
      headers: { Authorization: "Bearer " + session.token },
      signal: abort.signal,
    });
  const reader = res.body.getReader(),
    items = [];
  let buffer = "";
  void (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += new TextDecoder().decode(value);
        let i;
        while ((i = buffer.indexOf("\n\n")) >= 0) {
          const part = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          const type = part.match(/^event: (.+)$/m)?.[1],
            data = part.match(/^data: (.+)$/m)?.[1];
          if (type && data) items.push({ type, data: JSON.parse(data) });
        }
      }
    } catch {}
  })();
  const result = {
    items,
    close: () => abort.abort(),
    wait: async (type, match = () => true) => {
      const until = Date.now() + 1500;
      while (Date.now() < until) {
        const item = items.find((i) => i.type === type && match(i.data));
        if (item) return item.data;
        await new Promise((r) => setTimeout(r, 5));
      }
      throw Error("Missing " + type);
    },
  };
  streams.push(result);
  return result;
}
async function room() {
  const producer = await post("rooms", null, {}),
    p = await events(producer),
    host1 = await post("join", null, { code: producer.codes.host1 }),
    host2 = await post("join", null, { code: producer.codes.host2 }),
    h1 = await events(host1),
    h2 = await events(host2);
  await p.wait("presence", (v) => v.connected.host1 && v.connected.host2);
  const state = {
    protocol: STUDIO_PROTOCOL,
    view: "board",
    activeCueId: "moment",
    board: {
      id: "episode",
      activeScene: "scene",
      studio: {
        assetId: "clip",
        cues: [
          {
            id: "moment",
            note: "Shared script",
            presenterNotes: {
              host1: "First private",
              host2: "Second private",
              producer: "Producer only",
            },
          },
        ],
      },
    },
  };
  await post("state", producer, { state });
  await post("control", producer, { action: "arm", enabled: true });
  await post("control", producer, { action: "grant", to: "host1" });
  const presence = await h1.wait("presence", (v) => v.owner === "host1");
  const command = {
    protocol: STUDIO_PROTOCOL,
    context: commandContext(state),
    sentAt: clock,
    epoch: presence.epoch,
    seq: 1,
    boardId: "episode",
    sceneId: "scene",
    command: { type: "freeze" },
  };
  return { producer, p, host1, host2, h1, h2, state, command };
}
it("filters private notes at the relay for live updates and reconnect snapshots", async () => {
  const r = await room();
  const one = await r.h1.wait("state"),
    two = await r.h2.wait("state");
  expect(one.state.board.studio.cues[0].presenterNotes).toEqual({
    host1: "First private",
  });
  expect(two.state.board.studio.cues[0].presenterNotes).toEqual({
    host2: "Second private",
  });
  expect(JSON.stringify(one)).not.toContain("Second private");
  expect(JSON.stringify(two)).not.toContain("Producer only");
  const again = await events(r.host2);
  expect(
    (await again.wait("state")).state.board.studio.cues[0].presenterNotes,
  ).toEqual({ host2: "Second private" });
});
it("fences owner, epoch, episode, scene, source/view, protocol, expiry and duplicate actions", async () => {
  const r = await room();
  expect((await post("command", r.host2, r.command)).status).toBe(409);
  for (const changes of [
    { epoch: r.command.epoch - 1 },
    { boardId: "other" },
    { sceneId: "other" },
    { context: "old view" },
    { protocol: 1 },
    { sentAt: clock - 10001 },
  ])
    expect(
      (await post("command", r.host1, { ...r.command, ...changes })).status,
    ).toBe(409);
  expect((await post("command", r.host1, r.command)).ok).toBe(true);
  expect((await post("command", r.host1, r.command)).duplicate).toBe(true);
  await r.p.wait("command");
  expect(r.p.items.filter((e) => e.type === "command")).toHaveLength(1);
  await post("state", r.producer, { state: { ...r.state, view: "footage" } });
  expect(
    (await post("command", r.host1, { ...r.command, seq: 2 })).status,
  ).toBe(409);
});
it("acknowledges application separately from receipt and never inherits control after producer refresh/loss or episode changes", async () => {
  const r = await room();
  await post("command", r.host1, r.command);
  await r.p.wait("command");
  await post("feedback", r.producer, {
    to: "host1",
    seq: 1,
    status: "applied",
    message: "Applied",
  });
  expect(await r.h1.wait("feedback")).toMatchObject({
    seq: 1,
    status: "applied",
  });
  const refreshed = await events(r.producer);
  expect(await refreshed.wait("presence")).toMatchObject({
    owner: null,
    armed: false,
  });
  expect(
    (await post("command", r.host1, { ...r.command, seq: 2 })).status,
  ).toBe(409);
  await post("control", r.producer, { action: "arm", enabled: true });
  await post("control", r.producer, { action: "grant", to: "host1" });
  await post("state", r.producer, {
    state: { ...r.state, board: { ...r.state.board, id: "new-episode" } },
  });
  expect(
    await r.h1.wait(
      "presence",
      (v) => !v.armed && v.epoch > r.command.epoch + 1,
    ),
  ).toMatchObject({ owner: null });
  refreshed.close();
});
it("invalidates old credentials after Hub restart without replaying commands", async () => {
  const r = await room();
  relay.close();
  relay = createStudioRooms({ now: () => clock });
  expect((await post("command", r.host1, r.command)).status).toBe(401);
  expect(
    (await post("control", r.producer, { action: "arm", enabled: true }))
      .status,
  ).toBe(401);
});

it('rejects an event/radar action prepared for a different immutable source snapshot',async()=>{
 const r=await room();const oldState={...r.state,view:'stats',board:{...r.state.board,studio:{...r.state.board.studio,dataGraphic:{resourceId:'old-resource'}}}};await post('state',r.producer,{state:oldState});
 const old={...r.command,context:commandContext(oldState),command:{type:'analysis-filter',patch:{selectedEventIds:['event-1']}}};
 await post('state',r.producer,{state:{...oldState,board:{...oldState.board,studio:{...oldState.board.studio,dataGraphic:{resourceId:'replacement-resource'}}}}});
 expect((await post('command',r.host1,old)).status).toBe(409);expect(r.p.items.filter(e=>e.type==='command')).toHaveLength(0);
});

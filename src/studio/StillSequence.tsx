import { useState } from "react";
import { ArrowDown, ArrowUp, Images, Plus } from "lucide-react";
import { useStudio } from "../store";
import { useRuntime } from "./runtime";
import { emptyStudio } from "./types";
import { buildStillSequence } from "./stillSequence";
import { copy } from "../core";
export default function StillSequence() {
  const s = useStudio(),
    r = useRuntime(),
    desk = s.board?.studio || emptyStudio(),
    stills = r.assets
      .filter((a) => a.type === "image")
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      );
  const [order, setOrder] = useState<string[]>([]),
    [seconds, setSeconds] = useState(1);
  const move = (i: number, delta: number) =>
    setOrder((old) => {
      const n = [...old],
        target = i + delta;
      if (target >= 0 && target < n.length)
        [n[i], n[target]] = [n[target], n[i]];
      return n;
    });
  if (stills.length < 2) return null;
  return (
    <section className="ts-still-sequence">
      <div className="ts-section-title">
        <span>REBUILD FROM PICTURES</span>
        <Images size={16} />
      </div>
      <p className="ts-note">
        Map and review each still first. Confirm player identities to link the
        same player across pictures, then choose their order here.
      </p>
      {stills.map((a) => {
        const q = desk.tracking[a.id],
          ready =
            !!q?.reviewed &&
            !!q.targets.length &&
            q.targets.every((t) => t.playerId);
        return (
          <label key={a.id} className="ts-still-pick">
            <input
              type="checkbox"
              disabled={!ready || (!order.includes(a.id) && order.length >= 20)}
              checked={order.includes(a.id)}
              onChange={(e) =>
                setOrder((old) =>
                  e.target.checked
                    ? [...old, a.id]
                    : old.filter((id) => id !== a.id),
                )
              }
            />
            <img src={a.thumbnail} alt="" />
            <span>
              <strong>{a.name}</strong>
              <small>
                {ready
                  ? "Mapped · identities confirmed · reviewed"
                  : q?.reviewed
                    ? "Assign every player identity"
                    : "Map and review this still"}
              </small>
            </span>
          </label>
        );
      })}
      {!!order.length && (
        <div className="ts-still-order">
          {order.map((id, i) => (
            <div key={id}>
              <b>{i + 1}</b>
              <span>{r.assets.find((a) => a.id === id)?.name}</span>
              <button
                aria-label={`Move still ${i + 1} earlier`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={13} />
              </button>
              <button
                aria-label={`Move still ${i + 1} later`}
                disabled={i === order.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="ts-marker-size">
        Time between pictures
        <input
          aria-label="Seconds between reconstructed stills"
          type="number"
          min=".25"
          max="20"
          step=".25"
          value={seconds}
          onChange={(e) =>
            setSeconds(Math.max(0.25, Math.min(20, +e.target.value || 1)))
          }
        />
        <span>sec</span>
      </label>
      <button
        className="ts-wide-action"
        disabled={order.length < 2}
        onClick={() => {
          try {
            const scenes = buildStillSequence(order, r.assets, desk, seconds);
            for (const scene of scenes)
              for (const p of scene.players) {
                const teamId =
                  p.side === "home" ? s.board?.homeTeamId : s.board?.awayTeamId;
                p.position = s.catalogue?.teams
                  .find((t) => t.id === teamId)
                  ?.players.find((bio) => bio.id === p.playerId)?.position;
              }
            if ((s.board?.scenes.length || 0) + scenes.length > 100)
              throw Error(
                "This sequence would exceed the 100-phase storyboard limit.",
              );
            s.commit((b) => {
              b.scenes.push(...scenes);
              b.activeScene = scenes[0].id;
              b.players = copy(scenes[0].players);
              b.drawings = [];
              b.ball = { x: 0.5, y: 0.5 };
              b.settings.ballVisible = false;
              b.lineupSource = {
                home: "Reviewed still sequence",
                away: "Reviewed still sequence",
              };
            });
            r.set({ view: "board", time: 0, mediaPlaying: false });
            s.notify(
              `${scenes.length} source stills added as editable phases · undo available`,
            );
          } catch (e) {
            r.set({
              error:
                e instanceof Error ? e.message : "Sequence could not be built",
            });
          }
        }}
      >
        <Plus size={15} />
        Build {order.length || "selected"} stills as phases
      </button>
      <p className="ts-note">
        The interval is presentation time. Motion between stills is
        illustrative; off-screen players and ball movement are not inferred.
      </p>
    </section>
  );
}

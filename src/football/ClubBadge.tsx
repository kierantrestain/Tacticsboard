import { useEffect, useState } from "react";
import type { Team } from "../types";
export function TeamBadge({
  team,
  size = "normal",
}: {
  team?: Team;
  size?: "small" | "normal" | "large";
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [team?.badgeUrl]);
  return (
    <span
      className={`team-badge ${size} ${team?.badgeUrl && !failed ? "has-crest" : ""}`}
      style={
        { "--team-color": team?.color || "#7290a4" } as React.CSSProperties
      }
    >
      {team?.badgeUrl && !failed ? (
        <img
          src={team.badgeUrl}
          alt={`${team.name} crest`}
          loading="lazy"
          decoding="async"
          width="40"
          height="40"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{team?.abbreviation?.slice(0, 3) || "FC"}</span>
      )}
    </span>
  );
}

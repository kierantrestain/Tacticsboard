/** Shared by the LAN relay and compiled tablet/producer. No stateful editor lives here. */
export const STUDIO_PROTOCOL = 4;
export function commandContext(state) {
  return JSON.stringify([
    state?.board?.id,
    state?.board?.activeScene,
    state?.view,
    state?.activeCueId,
    state?.board?.studio?.assetId,
    state?.board?.studio?.dataGraphic?.resourceId,
  ]);
}
export function privateHostState(state, role) {
  if (!state?.board?.studio) return state;
  return {
    ...state,
    board: {
      ...state.board,
      studio: {
        ...state.board.studio,
        cues: state.board.studio.cues?.map((cue) => ({
          ...cue,
          presenterNotes: cue.presenterNotes?.[role]
            ? { [role]: cue.presenterNotes[role] }
            : undefined,
        })),
      },
    },
  };
}

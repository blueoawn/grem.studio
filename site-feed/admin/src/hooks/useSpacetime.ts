import { useContext } from "react";
import { SpacetimeContext, type SpacetimeState } from "../context/SpacetimeContext";

export function useSpacetime(): SpacetimeState {
  return useContext(SpacetimeContext);
}

import { useFlow } from "@/store/flow";
import { newId } from "@/data/db";

/** Start a GROUND ME reset from anywhere. */
export function useGroundMe() {
  const send = useFlow((s) => s.send);
  return () => send({ type: "GROUND_ME", resetId: newId(), now: Date.now() });
}

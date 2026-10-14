/** Singletons shared by every action. */
import streamDeck from "@elgato/streamdeck";
import { Voicemeeter } from "./vm/state";

export const vm = new Voicemeeter(streamDeck.logger.createScope("vm"));

/** Voicemeeter reads device names back truncated (31 chars); compare on the shorter of the two. */
export function sameDevice(current: string, wanted: string): boolean {
  if (!current || !wanted) return false;
  const n = Math.min(current.length, wanted.length, 31);
  return current.slice(0, n).toLowerCase() === wanted.slice(0, n).toLowerCase();
}

import { config } from "../config.js";

const MAX_SLOTS = config.maxContainers; // 0..19
const slots = new Set<number>(); // occupied slots

export const portAllocator = {
  allocateSlot(): number | null {
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (!slots.has(i)) {
        slots.add(i);
        return i;
      }
    }
    return null;
  },

  releaseSlot(slot: number): void {
    slots.delete(slot);
  },

  getPreviewPort(slot: number): number {
    return config.previewPortBase + slot;
  },

  getTtydPort(slot: number): number {
    return config.ttydPortBase + slot;
  },

  recoverSlots(usedSlots: number[]): void {
    for (const s of usedSlots) {
      slots.add(s);
    }
  },

  availableCount(): number {
    return MAX_SLOTS - slots.size;
  },

  occupiedCount(): number {
    return slots.size;
  },
};

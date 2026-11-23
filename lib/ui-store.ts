"use client";

import { create } from "zustand";
import { DEFAULT_BUILDING_ID } from "./buildings";

// UI-only state (navigation chrome). Simulation data lives in lib/sim/store.ts.
interface UiState {
  /** Last building the user looked at; used for building-scoped nav links. */
  buildingId: string;
  sidebarCollapsed: boolean;
  setBuildingId: (id: string) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  buildingId: DEFAULT_BUILDING_ID,
  sidebarCollapsed: false,
  setBuildingId: (buildingId) => set({ buildingId }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));

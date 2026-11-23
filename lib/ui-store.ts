"use client";

import { create } from "zustand";
import { DEFAULT_BUILDING_ID } from "./buildings";

// UI-only state (navigation chrome). Simulation data lives in lib/sim/store.ts.
interface UiState {
  /** Last building the user looked at; used for building-scoped nav links. */
  buildingId: string;
  sidebarCollapsed: boolean;
  /** Presenter panel (keys help + incident / reset buttons for touch screens). */
  presenterOpen: boolean;
  /** Kiosk auto-tour is cycling screens right now. */
  touring: boolean;
  setBuildingId: (id: string) => void;
  toggleSidebar: () => void;
  setPresenterOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  buildingId: DEFAULT_BUILDING_ID,
  sidebarCollapsed: false,
  presenterOpen: false,
  touring: false,
  setBuildingId: (buildingId) => set({ buildingId }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setPresenterOpen: (presenterOpen) => set({ presenterOpen }),
}));

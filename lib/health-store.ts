import { create } from 'zustand';

import {
  EMPTY_HEALTH_DATA,
  type HealthData,
  type LabResult,
  type PeriodLog,
  type Profile,
  type SymptomLog,
} from '@/lib/health-types';
import {
  deleteStoredHealthData,
  loadHealthData,
  saveHealthData,
} from '@/lib/secure-health-storage';

interface HealthState extends HealthData {
  isHydrated: boolean;
  storageError: string | null;
  hydrate: () => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  addPeriod: (period: PeriodLog) => Promise<void>;
  addSymptomLog: (log: SymptomLog) => Promise<void>;
  addLabResult: (result: LabResult) => Promise<void>;
  deletePeriod: (id: string) => Promise<void>;
  deleteSymptomLog: (id: string) => Promise<void>;
  deleteLabResult: (id: string) => Promise<void>;
  clearMedications: () => Promise<void>;
  deleteAllData: () => Promise<void>;
}

function selectData(state: HealthState): HealthData {
  return {
    profile: state.profile,
    periods: state.periods,
    symptomLogs: state.symptomLogs,
    labs: state.labs,
  };
}

export const useHealthStore = create<HealthState>((set, get) => ({
  ...EMPTY_HEALTH_DATA,
  isHydrated: false,
  storageError: null,
  hydrate: async () => {
    try {
      const data = await loadHealthData();
      set({ ...data, isHydrated: true, storageError: null });
    } catch {
      set({
        isHydrated: true,
        storageError: 'Your private data could not be opened on this device.',
      });
    }
  },
  saveProfile: async (profile) => {
    set({ profile });
    await saveHealthData(selectData(get()));
  },
  addPeriod: async (period) => {
    set((state) => ({
      periods: [...state.periods.filter((item) => item.id !== period.id), period],
    }));
    await saveHealthData(selectData(get()));
  },
  addSymptomLog: async (log) => {
    set((state) => ({
      symptomLogs: [...state.symptomLogs.filter((item) => item.id !== log.id), log],
    }));
    await saveHealthData(selectData(get()));
  },
  addLabResult: async (result) => {
    set((state) => ({ labs: [...state.labs, result] }));
    await saveHealthData(selectData(get()));
  },
  deletePeriod: async (id) => {
    const previous = get().periods;
    set((state) => ({ periods: state.periods.filter((item) => item.id !== id) }));
    try {
      await saveHealthData(selectData(get()));
    } catch (error) {
      set({ periods: previous });
      throw error;
    }
  },
  deleteSymptomLog: async (id) => {
    const previous = get().symptomLogs;
    set((state) => ({ symptomLogs: state.symptomLogs.filter((item) => item.id !== id) }));
    try {
      await saveHealthData(selectData(get()));
    } catch (error) {
      set({ symptomLogs: previous });
      throw error;
    }
  },
  deleteLabResult: async (id) => {
    const previous = get().labs;
    set((state) => ({ labs: state.labs.filter((item) => item.id !== id) }));
    try {
      await saveHealthData(selectData(get()));
    } catch (error) {
      set({ labs: previous });
      throw error;
    }
  },
  clearMedications: async () => {
    const previous = get().profile;
    if (!previous) return;

    set({ profile: { ...previous, medications: undefined } });
    try {
      await saveHealthData(selectData(get()));
    } catch (error) {
      set({ profile: previous });
      throw error;
    }
  },
  deleteAllData: async () => {
    await deleteStoredHealthData();
    set({ ...EMPTY_HEALTH_DATA, storageError: null });
  },
}));

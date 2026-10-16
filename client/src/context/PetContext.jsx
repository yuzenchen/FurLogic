import React, { createContext, useContext } from 'react';
import usePersistentState from '../hooks/usePersistentState';
import usePetMetrics from '../hooks/usePetMetrics';
import { getPetProfile, savePetProfile } from '../utils/storage';

const PetContext = createContext(null);

export function PetProvider({ children }) {
  const [profile, setProfile] = usePersistentState(
    getPetProfile,
    savePetProfile,
  );
  const metrics = usePetMetrics(profile);

  const value = { profile, setProfile, metrics };
  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePet() {
  const ctx = useContext(PetContext);
  if (!ctx) {
    throw new Error('usePet must be used inside <PetProvider>');
  }
  return ctx;
}

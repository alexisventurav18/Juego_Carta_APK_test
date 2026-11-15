import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import OptionsModal from './OptionsModal';

interface OptionsContextValue {
  open: () => void;
}

const OptionsContext = createContext<OptionsContextValue>({ open: () => undefined });

/** Un único panel de opciones para toda la app: cualquier botón de engranaje lo abre con `useOptions().open()`. */
export function OptionsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <OptionsContext.Provider value={value}>
      {children}
      {isOpen && <OptionsModal onClose={() => setIsOpen(false)} />}
    </OptionsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOptions(): OptionsContextValue {
  return useContext(OptionsContext);
}

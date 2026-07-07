import { createContext, useContext, useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';

const ShellHeaderControlsValueContext = createContext<ReactNode>(null);
const ShellHeaderControlsSetterContext = createContext<((controls: ReactNode) => void) | null>(null);

export function ShellHeaderControlsProvider({ children }: PropsWithChildren) {
  const [controls, setControls] = useState<ReactNode>(null);

  return (
    <ShellHeaderControlsSetterContext.Provider value={setControls}>
      <ShellHeaderControlsValueContext.Provider value={controls}>{children}</ShellHeaderControlsValueContext.Provider>
    </ShellHeaderControlsSetterContext.Provider>
  );
}

export function useShellHeaderControls(controls: ReactNode) {
  const setControls = useContext(ShellHeaderControlsSetterContext);

  useEffect(() => {
    if (!setControls) {
      return;
    }

    setControls(controls);
    return () => {
      setControls(null);
    };
  }, [setControls, controls]);
}

export function useShellHeaderControlsValue(): ReactNode {
  return useContext(ShellHeaderControlsValueContext);
}

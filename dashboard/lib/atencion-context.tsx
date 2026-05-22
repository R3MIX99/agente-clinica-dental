"use client"

import { createContext, useContext, useState, useCallback } from "react"

interface AtencionContextValue {
  atencionIds: Set<string>
  addAtencion: (id: string) => void
  removeAtencion: (id: string) => void
  hayAtencion: boolean
}

const AtencionContext = createContext<AtencionContextValue>({
  atencionIds: new Set(),
  addAtencion: () => {},
  removeAtencion: () => {},
  hayAtencion: false,
})

export function AtencionProvider({ children }: { children: React.ReactNode }) {
  const [atencionIds, setAtencionIds] = useState<Set<string>>(new Set())

  const addAtencion = useCallback((id: string) => {
    setAtencionIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const removeAtencion = useCallback((id: string) => {
    setAtencionIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  return (
    <AtencionContext.Provider
      value={{
        atencionIds,
        addAtencion,
        removeAtencion,
        hayAtencion: atencionIds.size > 0,
      }}
    >
      {children}
    </AtencionContext.Provider>
  )
}

export function useAtencion() {
  return useContext(AtencionContext)
}

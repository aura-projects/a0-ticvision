import { create } from "zustand"
import { produce } from 'immer'
import { saveString, loadString } from "@/app/utils/storage/storage"
import { useRootStore } from "@/app/models/RootStore"
import { useSuggestionStore } from "@/lib/SuggestionStore"
import { TicLog, TicType, Suggestion, TicEducation, UserSuggestionFeedback } from "@/app/types/global"
import uuid from 'react-native-uuid'

const STORAGE_KEY = '@tic_store'
const CACHE_DURATION = 1000 * 60 * 30 // 30 minutes

export interface TicStoreState {
  error: string | null
  ticLogs: Record<string, TicLog>
  lastSync: Date | null
  ticTypes: Record<string, TicType>
  isLoading: boolean
  recentLogs: TicLog[]
  pendingLogs: TicLog[]
  selectedTicType: string | null
  filterSettings: {
    startDate: Date
    endDate: Date
    timeOfDay: string[]
    intensityRange: [number, number]
  }
  cachedHistoryRanges: {
    [key: string]: {
      logs: TicLog[]
      timestamp: number
    }
  }
}

export interface TicStoreActions {
  logTic: (log: Omit<TicLog, 'id' | 'timestamp'>) => Promise<void>
  syncTicLogs: () => Promise<void>
  fetchTicTypes: () => Promise<void>
  getTicHistory: (startDate: Date, endDate: Date) => Promise<TicLog[]>
  setSelectedTicType: (ticTypeId: string | null) => void
  updateFilterSettings: (settings: Partial<TicStoreState['filterSettings']>) => void
  deleteTicLog: (logId: string) => Promise<void>
  updateTicLog: (logId: string, updates: Partial<Omit<TicLog, 'id'>>) => Promise<void>
  clearError: () => void
  resetStore: () => void
}

export type TicStore = TicStoreState & TicStoreActions

const initialState: TicStoreState = {
  error: null,
  ticLogs: {},
  lastSync: null,
  ticTypes: {},
  isLoading: false,
  recentLogs: [],
  pendingLogs: [],
  selectedTicType: null,
  filterSettings: {
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    timeOfDay: ['morning', 'afternoon', 'evening', 'night'],
    intensityRange: [1, 10]
  },
  cachedHistoryRanges: {}
}

const loadPersistedState = async (): Promise<Partial<TicStoreState>> => {
  try {
    const stored = await loadString(STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    return {
      ...parsed,
      lastSync: parsed.lastSync ? new Date(parsed.lastSync) : null,
      filterSettings: {
        ...initialState.filterSettings,
        ...parsed.filterSettings,
        startDate: new Date(parsed.filterSettings?.startDate || initialState.filterSettings.startDate),
        endDate: new Date(parsed.filterSettings?.endDate || initialState.filterSettings.endDate)
      }
    }
  } catch (error) {
    console.error('Error loading persisted state:', error)
    return {}
  }
}

export const useTicStore = create<TicStore>((set, get) => ({
  ...initialState,

  logTic: async (logData) => {
    const userId = useRootStore.getState().userId
    if (!userId) {
      set(produce((state) => { state.error = 'User not authenticated' }))
      return
    }

    const tempId = uuid.v4() as string
    const newLog: TicLog = {
      id: tempId,
      userId,
      timestamp: new Date(),
      ...logData
    }

    // Optimistic update
    set(produce((state) => {
      state.ticLogs[tempId] = newLog
      state.pendingLogs.push(newLog)
      state.recentLogs = [newLog, ...state.recentLogs].slice(0, 10)
    }))

    try {
      const response = await fetch('/api/tics/log', {
        method: 'POST',
        body: JSON.stringify(newLog)
      })
      
      if (!response.ok) throw new Error('Failed to log tic')
      
      const savedLog = await response.json()
      
      set(produce((state) => {
        delete state.ticLogs[tempId]
        state.ticLogs[savedLog.id] = savedLog
        state.pendingLogs = state.pendingLogs.filter(log => log.id !== tempId)
        state.recentLogs = state.recentLogs.map(log => 
          log.id === tempId ? savedLog : log
        )
      }))
    } catch (error) {
      set(produce((state) => {
        state.error = 'Failed to sync tic log'
        delete state.ticLogs[tempId]
        state.recentLogs = state.recentLogs.filter(log => log.id !== tempId)
      }))
    }
  },

  syncTicLogs: async () => {
    set(produce(state => { state.isLoading = true }))
    
    try {
      const { pendingLogs } = get()
      if (pendingLogs.length === 0) return

      const response = await fetch('/api/tics/sync', {
        method: 'POST',
        body: JSON.stringify({ logs: pendingLogs })
      })

      if (!response.ok) throw new Error('Sync failed')

      const syncedLogs = await response.json()
      
      set(produce(state => {
        state.pendingLogs = []
        state.lastSync = new Date()
        syncedLogs.forEach((log: TicLog) => {
          state.ticLogs[log.id] = log
        })
      }))

      await saveString(STORAGE_KEY, JSON.stringify(get()))
    } catch (error) {
      set(produce(state => {
        state.error = 'Failed to sync tic logs'
      }))
    } finally {
      set(produce(state => { state.isLoading = false }))
    }
  },

  fetchTicTypes: async () => {
    set(produce(state => { state.isLoading = true }))

    try {
      const response = await fetch('/api/tics/types')
      if (!response.ok) throw new Error('Failed to fetch tic types')

      const types = await response.json()
      set(produce(state => {
        state.ticTypes = types.reduce((acc: Record<string, TicType>, type: TicType) => {
          acc[type.id] = type
          return acc
        }, {})
      }))
    } catch (error) {
      set(produce(state => {
        state.error = 'Failed to fetch tic types'
      }))
    } finally {
      set(produce(state => { state.isLoading = false }))
    }
  },

  getTicHistory: async (startDate: Date, endDate: Date) => {
    const cacheKey = `${startDate.toISOString()}-${endDate.toISOString()}`
    const cached = get().cachedHistoryRanges[cacheKey]

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.logs
    }

    set(produce(state => { state.isLoading = true }))

    try {
      const response = await fetch(`/api/tics/history?start=${startDate.toISOString()}&end=${endDate.toISOString()}`)
      if (!response.ok) throw new Error('Failed to fetch tic history')

      const logs = await response.json()
      
      set(produce(state => {
        state.cachedHistoryRanges[cacheKey] = {
          logs,
          timestamp: Date.now()
        }
      }))

      return logs
    } catch (error) {
      set(produce(state => {
        state.error = 'Failed to fetch tic history'
      }))
      return []
    } finally {
      set(produce(state => { state.isLoading = false }))
    }
  },

  setSelectedTicType: (ticTypeId) => {
    set(produce(state => {
      state.selectedTicType = ticTypeId
    }))
  },

  updateFilterSettings: (settings) => {
    set(produce(state => {
      state.filterSettings = { ...state.filterSettings, ...settings }
    }))
  },

  deleteTicLog: async (logId) => {
    set(produce(state => { state.isLoading = true }))

    try {
      const response = await fetch(`/api/tics/log/${logId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete tic log')

      set(produce(state => {
        delete state.ticLogs[logId]
        state.recentLogs = state.recentLogs.filter(log => log.id !== logId)
      }))
    } catch (error) {
      set(produce(state => {
        state.error = 'Failed to delete tic log'
      }))
    } finally {
      set(produce(state => { state.isLoading = false }))
    }
  },

  updateTicLog: async (logId, updates) => {
    set(produce(state => { state.isLoading = true }))

    try {
      const response = await fetch(`/api/tics/log/${logId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      })

      if (!response.ok) throw new Error('Failed to update tic log')

      const updatedLog = await response.json()
      
      set(produce(state => {
        state.ticLogs[logId] = updatedLog
        state.recentLogs = state.recentLogs.map(log =>
          log.id === logId ? updatedLog : log
        )
      }))
    } catch (error) {
      set(produce(state => {
        state.error = 'Failed to update tic log'
      }))
    } finally {
      set(produce(state => { state.isLoading = false }))
    }
  },

  clearError: () => {
    set(produce(state => { state.error = null }))
  },

  resetStore: () => {
    set(initialState)
  }
}))

// Initialize store with persisted state
loadPersistedState().then((persistedState) => {
  useTicStore.setState({
    ...initialState,
    ...persistedState
  })
})
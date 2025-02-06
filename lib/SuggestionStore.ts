import { create } from "zustand"
import { produce } from 'immer'
import uuid from 'react-native-uuid'
import { saveString, loadString } from "@/app/utils/storage/storage"
import { useRootStore } from "@/app/models/RootStore"
import { useTicStore } from "@/lib/TicStore"
import { TicLog, TicType, Suggestion, UserSuggestionFeedback } from "@/app/types/global"

const STORAGE_KEY = 'suggestion_store_v1'

// Additional types for queue management
interface QueuedOperation {
  id: string
  type: 'feedback' | 'sync'
  data: any
  timestamp: Date
}

export interface SuggestionStoreState {
  error: string | null
  lastSync: Date | null
  isLoading: boolean
  suggestions: Record<string, Suggestion>
  userFeedback: Record<string, UserSuggestionFeedback>
  suggestionsByTicType: Record<string, string[]>
  operationQueue: QueuedOperation[]
  pendingFeedback: Record<string, UserSuggestionFeedback>
  isSyncing: boolean
  lastAIGeneration: Record<string, Date>
}

export interface SuggestionStoreActions {
  provideFeedback: (feedback: Omit<UserSuggestionFeedback, 'id'>) => Promise<void>
  syncUserFeedback: () => Promise<void>
  fetchSuggestionsForTicType: (ticTypeId: string) => Promise<void>
  generatePersonalizedSuggestions: (ticTypeId: string) => Promise<void>
  clearError: () => void
  retry: () => Promise<void>
}

export type SuggestionStore = SuggestionStoreState & SuggestionStoreActions

const initialState: SuggestionStoreState = {
  error: null,
  lastSync: null,
  isLoading: false,
  suggestions: {},
  userFeedback: {},
  suggestionsByTicType: {},
  operationQueue: [],
  pendingFeedback: {},
  isSyncing: false,
  lastAIGeneration: {}
}

const loadPersistedState = async (): Promise<Partial<SuggestionStoreState>> => {
  try {
    const stored = await loadString(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.error('Failed to load persisted state:', error)
    return {}
  }
}

const persistState = async (state: SuggestionStoreState) => {
  try {
    const persistedData = {
      suggestions: state.suggestions,
      userFeedback: state.userFeedback,
      suggestionsByTicType: state.suggestionsByTicType,
      lastSync: state.lastSync,
      operationQueue: state.operationQueue,
      lastAIGeneration: state.lastAIGeneration
    }
    await saveString(STORAGE_KEY, JSON.stringify(persistedData))
  } catch (error) {
    console.error('Failed to persist state:', error)
  }
}

export const useSuggestionStore = create<SuggestionStore>((set, get) => ({
  ...initialState,

  provideFeedback: async (feedback) => {
    const userId = useRootStore.getState().userId
    if (!userId) throw new Error('User not authenticated')

    const feedbackId = uuid.v4().toString()
    const newFeedback: UserSuggestionFeedback = {
      ...feedback,
      id: feedbackId,
      userId
    }

    // Optimistic update
    set(produce((state: SuggestionStoreState) => {
      state.pendingFeedback[feedbackId] = newFeedback
      state.userFeedback[feedbackId] = newFeedback
    }))

    try {
      // Sync with backend
      const response = await fetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify(newFeedback)
      })

      if (!response.ok) throw new Error('Failed to save feedback')

      set(produce((state: SuggestionStoreState) => {
        delete state.pendingFeedback[feedbackId]
      }))

      await persistState(get())
    } catch (error) {
      set(produce((state: SuggestionStoreState) => {
        state.error = 'Failed to save feedback'
        delete state.userFeedback[feedbackId]
        state.operationQueue.push({
          id: uuid.v4().toString(),
          type: 'feedback',
          data: newFeedback,
          timestamp: new Date()
        })
      }))
    }
  },

  syncUserFeedback: async () => {
    const state = get()
    if (state.isSyncing) return

    set(produce((state: SuggestionStoreState) => {
      state.isSyncing = true
      state.error = null
    }))

    try {
      const operations = [...state.operationQueue]
      for (const op of operations) {
        if (op.type === 'feedback') {
          await get().provideFeedback(op.data)
        }
      }

      set(produce((state: SuggestionStoreState) => {
        state.operationQueue = state.operationQueue.filter(
          op => !operations.includes(op)
        )
        state.lastSync = new Date()
        state.isSyncing = false
      }))

      await persistState(get())
    } catch (error) {
      set(produce((state: SuggestionStoreState) => {
        state.error = 'Sync failed'
        state.isSyncing = false
      }))
    }
  },

  fetchSuggestionsForTicType: async (ticTypeId: string) => {
    set(produce((state: SuggestionStoreState) => {
      state.isLoading = true
      state.error = null
    }))

    try {
      const response = await fetch(`/api/suggestions/${ticTypeId}`)
      if (!response.ok) throw new Error('Failed to fetch suggestions')

      const suggestions: Suggestion[] = await response.json()

      set(produce((state: SuggestionStoreState) => {
        suggestions.forEach(suggestion => {
          state.suggestions[suggestion.id] = suggestion
        })
        state.suggestionsByTicType[ticTypeId] = suggestions.map(s => s.id)
        state.isLoading = false
      }))

      await persistState(get())
    } catch (error) {
      set(produce((state: SuggestionStoreState) => {
        state.error = 'Failed to fetch suggestions'
        state.isLoading = false
      }))
    }
  },

  generatePersonalizedSuggestions: async (ticTypeId: string) => {
    const state = get()
    const lastGeneration = state.lastAIGeneration[ticTypeId]
    if (lastGeneration && Date.now() - lastGeneration.getTime() < 3600000) {
      return // Prevent generating too frequently
    }

    set(produce((state: SuggestionStoreState) => {
      state.isLoading = true
      state.error = null
    }))

    try {
      const ticLogs = await useTicStore.getState().getTicHistory(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        new Date()
      )

      const response = await fetch('/api/suggestions/generate', {
        method: 'POST',
        body: JSON.stringify({ ticTypeId, ticLogs })
      })

      if (!response.ok) throw new Error('Failed to generate suggestions')

      const newSuggestions: Suggestion[] = await response.json()

      set(produce((state: SuggestionStoreState) => {
        newSuggestions.forEach(suggestion => {
          state.suggestions[suggestion.id] = suggestion
        })
        state.suggestionsByTicType[ticTypeId] = [
          ...(state.suggestionsByTicType[ticTypeId] || []),
          ...newSuggestions.map(s => s.id)
        ]
        state.lastAIGeneration[ticTypeId] = new Date()
        state.isLoading = false
      }))

      await persistState(get())
    } catch (error) {
      set(produce((state: SuggestionStoreState) => {
        state.error = 'Failed to generate personalized suggestions'
        state.isLoading = false
      }))
    }
  },

  clearError: () => set(produce((state: SuggestionStoreState) => {
    state.error = null
  })),

  retry: async () => {
    const state = get()
    if (state.operationQueue.length > 0) {
      await get().syncUserFeedback()
    }
  }
}))

// Initialize store with persisted state
loadPersistedState().then((persistedState) => {
  useSuggestionStore.setState({
    ...initialState,
    ...persistedState
  })
})
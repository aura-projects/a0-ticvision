export interface TicLog {
  id: string
  notes: string
  userId: string
  intensity: number
  ticTypeId: string
  timeOfDay: string
  timestamp: Date
}

export interface TicType {
  id: string
  name: string
  category: string
  isCustom: boolean
  description: string
}

export interface Suggestion {
  id: string
  title: string
  source: string
  category: string
  createdAt: Date
  ticTypeId: string
  description: string
  isAIGenerated: boolean
}

export interface TicEducation {
  id: string
  title: string
  content: string
  category: string
  lastUpdated: Date
}

export interface UserSuggestionFeedback {
  id: string
  notes: string
  userId: string
  lastUsedDate: Date
  suggestionId: string
  effectiveness: number
  isCurrentlyUsing: boolean
}
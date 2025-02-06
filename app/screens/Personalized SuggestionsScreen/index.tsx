import React, { useState, useEffect, useMemo } from "react"
import { View, Pressable } from "react-native"
import { AppStackScreenProps } from "@/app/navigators"
import {
  Text,
  Screen,
  AdaptiveHeader,
  Card,
  CardContent,
  CardHeader,
  ProgressIndicator,
  Button,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Badge,
} from "@/app/ui/components"
import { useTheme } from "@/app/ui/theme/useTheme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { cn } from "@/app/ui/lib/cn"
import { useTicStore } from "@/lib/TicStore"
import { useSuggestionStore } from "@/lib/SuggestionStore"
import { ThumbsUp, ThumbsDown, TrendingUp, Brain, Activity } from "lucide-react-native"

interface PersonalizedSuggestionsScreenProps extends AppStackScreenProps<"PersonalizedSuggestions"> {}

type SuggestionCategory = "CBIT" | "HRT" | "CBT"

export const PersonalizedSuggestionsScreen = function PersonalizedSuggestionsScreen({
  navigation,
}: PersonalizedSuggestionsScreenProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  // Store states
  const { suggestions, userFeedback, provideFeedback } = useSuggestionStore()
  const { recentLogs, ticTypes } = useTicStore()

  // Local states
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["CBIT"])

  // Derived states
  const categorizedSuggestions = useMemo(() => {
    const categories: Record<SuggestionCategory, typeof suggestions> = {
      CBIT: {},
      HRT: {},
      CBT: {},
    }

    Object.values(suggestions).forEach((suggestion) => {
      const category = suggestion.category as SuggestionCategory
      if (categories[category]) {
        categories[category][suggestion.id] = suggestion
      }
    })

    return categories
  }, [suggestions])

  const getEffectivenessScore = (suggestionId: string) => {
    const feedback = Object.values(userFeedback).filter((f) => f.suggestionId === suggestionId)
    if (feedback.length === 0) return 0

    const avgEffectiveness =
      feedback.reduce((sum, f) => sum + f.effectiveness, 0) / feedback.length
    return Math.round(avgEffectiveness * 10)
  }

  const handleFeedback = async (suggestionId: string, effectiveness: number) => {
    try {
      await provideFeedback({
        suggestionId,
        userId: "user123", // Replace with actual user ID
        effectiveness,
        isCurrentlyUsing: true,
        notes: "",
        lastUsedDate: new Date(),
      })
    } catch (err) {
      setError("Failed to submit feedback")
    }
  }

  const renderSuggestionCard = (suggestion: Suggestion) => {
    const effectiveness = getEffectivenessScore(suggestion.id)

    return (
      <Card key={suggestion.id} className="mb-4 rounded-lg border border-base-200">
        <CardHeader>
          <View className="flex-row justify-between items-center">
            <Text variant="heading" className="flex-1 text-base-content">
              {suggestion.title}
            </Text>
            <Badge
              variant={suggestion.isAIGenerated ? "secondary" : "default"}
              className="ml-2"
            >
              {suggestion.isAIGenerated ? "AI Generated" : "Expert Verified"}
            </Badge>
          </View>
        </CardHeader>
        <CardContent>
          <Text variant="body" className="mb-3 text-base-content">
            {suggestion.description}
          </Text>
          <View className="mt-2">
            <Text variant="caption1" className="mb-1 text-base-content">
              Effectiveness
            </Text>
            <ProgressIndicator
              value={effectiveness}
              max={100}
              className="h-2 bg-base-200"
            />
          </View>
          <View className="flex-row justify-end mt-4 space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-row items-center"
              onPress={() => handleFeedback(suggestion.id, 0)}
            >
              <ThumbsDown size={16} color={colors.error} />
              <Text className="ml-2 text-error">Not Helpful</Text>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-row items-center"
              onPress={() => handleFeedback(suggestion.id, 10)}
            >
              <ThumbsUp size={16} color={colors.success} />
              <Text className="ml-2 text-success">Helpful</Text>
            </Button>
          </View>
        </CardContent>
      </Card>
    )
  }

  const CategoryIcon = {
    CBIT: Brain,
    HRT: Activity,
    CBT: TrendingUp,
  }

  return (
    <Screen
      safeAreaEdges={["top"]}
      className="bg-background"
      contentContainerClassName="flex-1 px-4"
      preset="scroll"
      contentContainerStyle={{
        paddingBottom: insets.bottom + 16,
      }}
    >
      <AdaptiveHeader iosTitle="Personalized Suggestions" />

      {/* Recent Activity Summary */}
      <Card className="mb-4 mt-2 rounded-lg border border-base-200">
        <CardContent className="p-4">
          <Text variant="heading" className="mb-2 text-base-content">
            Recent Activity Summary
          </Text>
          <Text variant="body" className="text-base-content">
            Based on your recent tracking, we've customized these suggestions to help manage your tics
            more effectively.
          </Text>
        </CardContent>
      </Card>

      {/* Categorized Suggestions */}
      <Accordion
        type="multiple"
        value={expandedCategories}
        onValueChange={setExpandedCategories}
        className="space-y-2"
      >
        {(Object.keys(categorizedSuggestions) as SuggestionCategory[]).map((category) => {
          const Icon = CategoryIcon[category]
          const suggestions = Object.values(categorizedSuggestions[category])

          return (
            <AccordionItem key={category} value={category} className="border border-base-200 rounded-lg">
              <AccordionTrigger className="px-4 py-3">
                <View className="flex-row items-center">
                  <Icon size={20} color={colors.primary} />
                  <Text variant="heading" className="ml-2 text-base-content">
                    {category} Techniques
                  </Text>
                  <Badge variant="secondary" className="ml-2">
                    {suggestions.length}
                  </Badge>
                </View>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {suggestions.map(renderSuggestionCard)}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-primary">Loading suggestions...</Text>
        </View>
      )}

      {error && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-error">{error}</Text>
        </View>
      )}
    </Screen>
  )
}
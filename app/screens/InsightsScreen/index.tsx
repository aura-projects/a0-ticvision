import React, { useState, useEffect, useMemo } from "react"
import { View, Pressable } from "react-native"
import { AppStackScreenProps } from "@/app/navigators"
import {
  Text,
  Screen,
  Card,
  CardContent,
  CardHeader,
  Badge,
  Button,
  ProgressIndicator,
  Modal,
  AdaptiveHeader,
} from "@/app/ui/components"
import { useTheme } from "@/app/ui/theme/useTheme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { cn } from "@/app/ui/lib/cn"
import { useSuggestionStore } from "@/lib/SuggestionStore"
import { useTicStore } from "@/lib/TicStore"
import { Suggestion, UserSuggestionFeedback } from "@/app/types/global"
import { AlertCircle, ThumbsUp, ThumbsDown, TrendingUp } from "lucide-react-native"

interface InsightsScreenProps extends AppStackScreenProps<"Insights"> {}

interface SuggestionCardProps {
  suggestion: Suggestion
  feedback?: UserSuggestionFeedback
  onFeedback: (effectiveness: number) => void
  onPress: () => void
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  feedback,
  onFeedback,
  onPress,
}) => {
  const { colors } = useTheme()
  const effectiveness = feedback?.effectiveness || 0

  return (
    <Pressable onPress={onPress}>
      <Card className="mb-4">
        <CardHeader className="flex-row justify-between items-center">
          <Text variant="heading" className="flex-1">
            {suggestion.title}
          </Text>
          <Badge
            variant={effectiveness > 7 ? "success" : effectiveness > 4 ? "warning" : "destructive"}
            className="ml-2"
          >
            {effectiveness}/10
          </Badge>
        </CardHeader>
        <CardContent>
          <Text variant="body" className="mb-2 text-base-content">
            {suggestion.description}
          </Text>
          <View className="flex-row justify-between items-center mt-2">
            <View className="flex-row gap-2">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => onFeedback(8)}
                className="flex-row items-center"
              >
                <ThumbsUp size={16} color={colors.primary} />
                <Text className="ml-1 text-primary">Helpful</Text>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => onFeedback(2)}
                className="flex-row items-center"
              >
                <ThumbsDown size={16} color={colors.error} />
                <Text className="ml-1 text-error">Not Helpful</Text>
              </Button>
            </View>
            <Text variant="caption2" className="text-dim">
              {suggestion.source}
            </Text>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  )
}

export const InsightsScreen = function InsightsScreen({ navigation }: InsightsScreenProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)

  const {
    suggestions,
    userFeedback,
    isLoading,
    error,
    fetchSuggestionsForTicType,
    provideFeedback,
  } = useSuggestionStore()
  const { ticTypes } = useTicStore()

  useEffect(() => {
    // Fetch suggestions for all tic types
    Object.keys(ticTypes).forEach((ticTypeId) => {
      fetchSuggestionsForTicType(ticTypeId)
    })
  }, [])

  const categorizedSuggestions = useMemo(() => {
    const categorized: Record<string, (Suggestion & { feedback?: UserSuggestionFeedback })[]> = {}
    Object.values(suggestions).forEach((suggestion) => {
      const category = suggestion.category
      if (!categorized[category]) {
        categorized[category] = []
      }
      categorized[category].push({
        ...suggestion,
        feedback: Object.values(userFeedback).find((f) => f.suggestionId === suggestion.id),
      })
    })
    return categorized
  }, [suggestions, userFeedback])

  const handleFeedback = async (suggestionId: string, effectiveness: number) => {
    try {
      await provideFeedback({
        suggestionId,
        effectiveness,
        isCurrentlyUsing: true,
        userId: "user123", // Replace with actual user ID
        notes: "",
        lastUsedDate: new Date(),
      })
    } catch (error) {
      console.error("Error providing feedback:", error)
    }
  }

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top"]}
      className="bg-background"
      contentContainerClassName="flex-1 px-4"
      contentContainerStyle={{
        paddingBottom: insets.bottom,
      }}
    >
      <AdaptiveHeader
        iosTitle="Insights & Suggestions"
        rightView={() => (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => navigation.navigate("TicEducation")}
            className="flex-row items-center"
          >
            <AlertCircle size={16} color={colors.primary} />
            <Text className="ml-1 text-primary">Learn More</Text>
          </Button>
        )}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text variant="body" className="text-primary mb-4">
            Loading your personalized insights...
          </Text>
          <ProgressIndicator value={50} className="w-32" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-error">{error}</Text>
        </View>
      ) : (
        <View className="flex-1">
          <View className="mb-6">
            <View className="flex-row items-center mb-4">
              <TrendingUp size={20} color={colors.primary} />
              <Text variant="title2" className="ml-2">
                Your Progress
              </Text>
            </View>
            <Card className="bg-card p-4">
              <Text variant="body" className="mb-2">
                Overall Effectiveness
              </Text>
              <ProgressIndicator
                value={
                  Object.values(userFeedback).reduce((acc, curr) => acc + curr.effectiveness, 0) /
                  Object.values(userFeedback).length || 0
                }
                max={10}
                className="mb-2"
              />
              <Text variant="caption2" className="text-dim">
                Based on your feedback from {Object.values(userFeedback).length} suggestions
              </Text>
            </Card>
          </View>

          {Object.entries(categorizedSuggestions).map(([category, suggestions]) => (
            <View key={category} className="mb-6">
              <Text variant="title3" className="mb-4">
                {category}
              </Text>
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  feedback={suggestion.feedback}
                  onFeedback={(effectiveness) => handleFeedback(suggestion.id, effectiveness)}
                  onPress={() => {
                    setSelectedSuggestion(suggestion)
                    setIsModalVisible(true)
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      )}

      <Modal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        containerClassName="p-4"
      >
        {selectedSuggestion && (
          <View className="bg-card rounded-lg p-4">
            <Text variant="title2" className="mb-4">
              {selectedSuggestion.title}
            </Text>
            <Text variant="body" className="mb-4">
              {selectedSuggestion.description}
            </Text>
            <Text variant="caption1" className="text-dim mb-2">
              Source: {selectedSuggestion.source}
            </Text>
            <Button onPress={() => setIsModalVisible(false)} className="mt-4">
              Close
            </Button>
          </View>
        )}
      </Modal>
    </Screen>
  )
}
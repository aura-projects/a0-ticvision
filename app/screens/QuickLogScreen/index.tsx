import React, { useState, useEffect, useCallback } from "react"
import { View, FlatList, Pressable, Animated } from "react-native"
import { AppStackScreenProps } from "@/app/navigators"
import {
  Text,
  Screen,
  Button,
  Card,
  Slider,
  Badge,
  AdaptiveHeader,
} from "@/app/ui/components"
import { useTheme } from "@/app/ui/theme/useTheme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { cn } from "@/app/ui/lib/cn"
import { useTicStore } from "@/lib/TicStore"
import * as Haptics from "expo-haptics"
import { TicLog, TicType } from "@/app/types/global"
import { useRootStore } from "@/app/models/RootStore"
import { format } from "date-fns"
import { Clock, Activity, CheckCircle2 } from "lucide-react-native"

interface QuickLogScreenProps extends AppStackScreenProps<"QuickLog"> {}

const TIME_PERIODS = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "night", label: "Night" },
  { id: "allDay", label: "All Day" },
]

export const QuickLogScreen = function QuickLogScreen({
  navigation,
}: QuickLogScreenProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { userId } = useRootStore.getState()
  const { ticTypes, recentLogs, logTic } = useTicStore()

  const [selectedTicType, setSelectedTicType] = useState<TicType | null>(null)
  const [intensity, setIntensity] = useState(5)
  const [timePeriod, setTimePeriod] = useState("allDay")
  const [isLogging, setIsLogging] = useState(false)
  const [successAnimation] = useState(new Animated.Value(0))

  const handleTicSelection = (ticType: TicType) => {
    setSelectedTicType(ticType)
    Haptics.selectionAsync()
  }

  const showSuccessAnimation = () => {
    successAnimation.setValue(0)
    Animated.sequence([
      Animated.timing(successAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(successAnimation, {
        toValue: 0,
        duration: 200,
        delay: 1000,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const handleLogTic = async () => {
    if (!selectedTicType) return

    setIsLogging(true)
    try {
      await logTic({
        userId,
        ticTypeId: selectedTicType.id,
        intensity,
        timeOfDay: timePeriod,
        notes: "",
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showSuccessAnimation()
      setSelectedTicType(null)
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsLogging(false)
    }
  }

  const renderTicTypeItem = ({ item }: { item: TicType }) => (
    <Pressable
      onPress={() => handleTicSelection(item)}
      className={cn(
        "p-3 m-1 rounded-lg",
        selectedTicType?.id === item.id
          ? "bg-primary"
          : "bg-base-200",
      )}
    >
      <Text
        variant="callout"
        className={cn(
          "text-center",
          selectedTicType?.id === item.id
            ? "text-primary-content"
            : "text-base-content",
        )}
      >
        {item.name}
      </Text>
    </Pressable>
  )

  const renderRecentLog = ({ item }: { item: TicLog }) => (
    <Card className="mb-2 p-3 bg-base-200 rounded-lg">
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <Text variant="callout" className="text-base-content">
            {ticTypes[item.ticTypeId]?.name}
          </Text>
          <Text variant="caption2" className="text-dim mt-1">
            {format(new Date(item.timestamp), "h:mm a")}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Activity size={16} color={colors.dim} />
          <Text variant="caption1" className="ml-1 text-dim">
            {item.intensity}
          </Text>
        </View>
      </View>
    </Card>
  )

  return (
    <Screen
      safeAreaEdges={["top"]}
      className="bg-background"
      contentContainerClassName="flex-1 px-4"
      contentContainerStyle={{
        paddingBottom: insets.bottom + 16,
      }}
    >
      <AdaptiveHeader iosTitle="Quick Log" />

      <View className="flex-1">
        <View className="mb-4">
          <FlatList
            data={Object.values(ticTypes)}
            renderItem={renderTicTypeItem}
            keyExtractor={(item) => item.id}
            numColumns={3}
            columnWrapperStyle={{ justifyContent: "space-between" }}
          />
        </View>

        <View className="mb-6">
          <Text variant="callout" className="mb-2 text-base-content">
            Intensity
          </Text>
          <Slider
            value={intensity}
            onValueChange={setIntensity}
            minimumValue={1}
            maximumValue={10}
            step={1}
            thumbTintColor={colors.primary}
          />
          <View className="flex-row justify-between mt-1">
            <Text variant="caption2" className="text-dim">
              Mild
            </Text>
            <Text variant="caption2" className="text-dim">
              Severe
            </Text>
          </View>
        </View>

        <View className="mb-6">
          <Text variant="callout" className="mb-2 text-base-content">
            Time Period
          </Text>
          <View className="flex-row flex-wrap">
            {TIME_PERIODS.map((period) => (
              <Pressable
                key={period.id}
                onPress={() => setTimePeriod(period.id)}
                className="mr-2 mb-2"
              >
                <Badge
                  variant={timePeriod === period.id ? "default" : "outline"}
                >
                  <Clock size={14} className="mr-1" />
                  {period.label}
                </Badge>
              </Pressable>
            ))}
          </View>
        </View>

        <Button
          variant="default"
          size="lg"
          onPress={handleLogTic}
          disabled={!selectedTicType || isLogging}
          className="mb-6"
        >
          {isLogging ? "Logging..." : "Log Tic"}
        </Button>

        <Animated.View
          style={{
            opacity: successAnimation,
            transform: [
              {
                translateY: successAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}
          className="absolute top-1/2 left-0 right-0 items-center"
        >
          <View className="bg-success rounded-full p-3">
            <CheckCircle2 color={colors.successContent} size={24} />
          </View>
        </Animated.View>

        <View className="flex-1">
          <Text variant="callout" className="mb-2 text-base-content">
            Recent Logs
          </Text>
          <FlatList
            data={recentLogs.slice(0, 5)}
            renderItem={renderRecentLog}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Screen>
  )
}
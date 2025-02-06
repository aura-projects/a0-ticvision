import React, { useState, useEffect, useMemo, useCallback } from "react"
import { View, ScrollView, ActivityIndicator, Pressable } from "react-native"
import { AppStackScreenProps } from "@/app/navigators"
import {
  Text,
  Screen,
  AdaptiveHeader,
  Card,
  Button,
  Input,
  ProgressIndicator,
  Badge,
  Separator,
} from "@/app/ui/components"
import { useTheme } from "@/app/ui/theme/useTheme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { cn } from "@/app/ui/lib/cn"
import { useTicStore } from "@/lib/TicStore"
import { format, subDays, isToday, parseISO } from "date-fns"
import { LineChart } from "react-native-chart-kit"
import { useWindowDimensions } from "react-native"
import { Feather } from "@expo/vector-icons"

interface TicHistoryScreenProps extends AppStackScreenProps<"TicHistory"> {}

const TIME_RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
]

export const TicHistoryScreen = function TicHistoryScreen({
  navigation,
}: TicHistoryScreenProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  
  // Store state
  const { ticLogs, ticTypes, getTicHistory, isLoading: storeLoading } = useTicStore()
  
  // Local state
  const [selectedRange, setSelectedRange] = useState(TIME_RANGES[0])
  const [selectedTicType, setSelectedTicType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<any>(null)

  // Fetch data based on selected range
  useEffect(() => {
    const fetchData = async () => {
      try {
        const endDate = new Date()
        const startDate = subDays(endDate, selectedRange.days)
        const logs = await getTicHistory(startDate, endDate)
        
        // Process data for chart
        const dates = Array.from({ length: selectedRange.days }, (_, i) =>
          format(subDays(endDate, i), "MM/dd")
        ).reverse()
        
        const intensities = dates.map(date => {
          const dayLogs = logs.filter(log => 
            format(parseISO(log.timestamp.toString()), "MM/dd") === date &&
            (!selectedTicType || log.ticTypeId === selectedTicType)
          )
          return dayLogs.reduce((sum, log) => sum + log.intensity, 0) / Math.max(dayLogs.length, 1)
        })

        setChartData({
          labels: dates,
          datasets: [{
            data: intensities,
          }],
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch tic history")
      }
    }

    fetchData()
  }, [selectedRange, selectedTicType])

  // Format tic logs for display
  const formattedLogs = useMemo(() => {
    return Object.values(ticLogs)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter(log => !selectedTicType || log.ticTypeId === selectedTicType)
      .map(log => ({
        ...log,
        formattedDate: isToday(new Date(log.timestamp))
          ? "Today"
          : format(new Date(log.timestamp), "MMM d, yyyy"),
        ticType: ticTypes[log.ticTypeId]?.name || "Unknown",
      }))
  }, [ticLogs, ticTypes, selectedTicType])

  const renderTicTypeFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="py-2"
    >
      <Button
        variant={selectedTicType === null ? "default" : "outline"}
        size="sm"
        className="mx-1"
        onPress={() => setSelectedTicType(null)}
      >
        <Text>All Types</Text>
      </Button>
      {Object.values(ticTypes).map(type => (
        <Button
          key={type.id}
          variant={selectedTicType === type.id ? "default" : "outline"}
          size="sm"
          className="mx-1"
          onPress={() => setSelectedTicType(type.id)}
        >
          <Text>{type.name}</Text>
        </Button>
      ))}
    </ScrollView>
  )

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top"]}
      className="bg-background"
      contentContainerClassName="flex-1"
    >
      <AdaptiveHeader iosTitle="Tic History" />
      
      <View className="px-4">
        {/* Time Range Selector */}
        <View className="flex-row justify-around my-2">
          {TIME_RANGES.map(range => (
            <Button
              key={range.label}
              variant={selectedRange.label === range.label ? "default" : "outline"}
              size="sm"
              onPress={() => setSelectedRange(range)}
            >
              <Text>{range.label}</Text>
            </Button>
          ))}
        </View>

        {/* Tic Type Filters */}
        {renderTicTypeFilters()}

        {/* Chart Card */}
        <Card className="mt-4 p-4 bg-card rounded-lg">
          {chartData ? (
            <LineChart
              data={chartData}
              width={width - 48}
              height={180}
              chartConfig={{
                backgroundColor: colors.card,
                backgroundGradientFrom: colors.card,
                backgroundGradientTo: colors.card,
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(${colors.primary}, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16,
              }}
            />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </Card>

        {/* Stats Summary */}
        <View className="flex-row justify-between mt-4">
          <Card className="flex-1 mr-2 p-4 bg-card rounded-lg">
            <Text variant="caption1" className="text-dim">Average Intensity</Text>
            <Text variant="heading" className="text-primary">
              {formattedLogs.length > 0
                ? (formattedLogs.reduce((sum, log) => sum + log.intensity, 0) / formattedLogs.length).toFixed(1)
                : "N/A"}
            </Text>
          </Card>
          <Card className="flex-1 ml-2 p-4 bg-card rounded-lg">
            <Text variant="caption1" className="text-dim">Total Logs</Text>
            <Text variant="heading" className="text-primary">{formattedLogs.length}</Text>
          </Card>
        </View>

        {/* Detailed Logs */}
        <Text variant="title3" className="mt-6 mb-2">Recent Logs</Text>
        {formattedLogs.map((log, index) => (
          <View key={log.id} className="mb-4">
            <Card className="p-4 bg-card rounded-lg">
              <View className="flex-row justify-between items-center">
                <View>
                  <Text variant="callout" className="text-primary">{log.ticType}</Text>
                  <Text variant="caption1" className="text-dim">{log.formattedDate}</Text>
                </View>
                <Badge
                  variant={log.intensity > 7 ? "destructive" : log.intensity > 4 ? "secondary" : "default"}
                >
                  <Text>Intensity: {log.intensity}</Text>
                </Badge>
              </View>
              {log.notes && (
                <Text variant="footnote" className="mt-2 text-dim">{log.notes}</Text>
              )}
            </Card>
            {index < formattedLogs.length - 1 && <Separator className="my-2" />}
          </View>
        ))}
      </View>
    </Screen>
  )
}
import React, { useState, useEffect, useMemo, useCallback } from "react"
import { View, Pressable } from "react-native"
import { AppStackScreenProps } from "@/app/navigators"
import {
  Text,
  Screen,
  AdaptiveHeader,
  Button,
  Card,
  BottomSheetModal,
  CheckboxGroup,
  DatePicker,
  Separator,
} from "@/app/ui/components"
import { useTheme } from "@/app/ui/theme/useTheme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { cn } from "@/app/ui/lib/cn"
import { useTicStore } from "@/lib/TicStore"
import {
  VictoryLine,
  VictoryChart,
  VictoryTheme,
  VictoryAxis,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from "victory-native"
import { format } from "date-fns"
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import { MaterialCommunityIcons } from "@expo/vector-icons"

interface TicDataScreenProps extends AppStackScreenProps<"TicData"> {}

type GraphType = "frequency" | "avgIntensity" | "totalIntensity"

export const TicDataScreen = function TicDataScreen(_props: TicDataScreenProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [graphType, setGraphType] = useState<GraphType>("frequency")
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d")
  const [selectedTicTypes, setSelectedTicTypes] = useState<string[]>([])
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false)
  const [startDate, setStartDate] = useState(new Date())
  const [endDate, setEndDate] = useState(new Date())

  const { ticTypes, getTicHistory, isLoading, error } = useTicStore()

  const [ticData, setTicData] = useState<Array<any>>([])

  useEffect(() => {
    const fetchData = async () => {
      const end = new Date()
      const start = new Date()
      if (timeRange === "7d") start.setDate(end.getDate() - 7)
      if (timeRange === "30d") start.setDate(end.getDate() - 30)
      if (timeRange === "all") start.setFullYear(end.getFullYear() - 1)

      const logs = await getTicHistory(start, end)
      setTicData(
        logs.filter((log) =>
          selectedTicTypes.length ? selectedTicTypes.includes(log.ticTypeId) : true,
        ),
      )
    }
    fetchData()
  }, [timeRange, selectedTicTypes, getTicHistory])

  const graphData = useMemo(() => {
    if (!ticData.length) return []

    const groupedByDate = ticData.reduce((acc, log) => {
      const date = format(new Date(log.timestamp), "yyyy-MM-dd")
      if (!acc[date]) {
        acc[date] = {
          date,
          count: 0,
          totalIntensity: 0,
          logs: [],
        }
      }
      acc[date].count += 1
      acc[date].totalIntensity += log.intensity
      acc[date].logs.push(log)
      return acc
    }, {})

    return Object.values(groupedByDate).map((day: any) => ({
      x: new Date(day.date),
      y:
        graphType === "frequency"
          ? day.count
          : graphType === "avgIntensity"
          ? day.totalIntensity / day.count
          : day.totalIntensity,
    }))
  }, [ticData, graphType])

  const exportData = useCallback(async () => {
    const csvContent = ticData
      .map(
        (log) =>
          `${format(new Date(log.timestamp), "yyyy-MM-dd HH:mm")},${
            ticTypes[log.ticTypeId]?.name
          },${log.intensity},${log.timeOfDay}`,
      )
      .join("\n")

    const header = "DateTime,TicType,Intensity,TimeOfDay\n"
    const fullContent = header + csvContent

    const fileUri = `${FileSystem.documentDirectory}tic_data.csv`
    await FileSystem.writeAsStringAsync(fileUri, fullContent)
    await Sharing.shareAsync(fileUri)
  }, [ticData, ticTypes])

  const renderGraph = () => (
    <Card className="mt-4 p-4 rounded-lg bg-card">
      <VictoryChart
        theme={VictoryTheme.material}
        height={240}
        padding={{ top: 10, bottom: 40, left: 50, right: 20 }}
        containerComponent={<VictoryVoronoiContainer />}
      >
        <VictoryAxis
          tickFormat={(x) => format(new Date(x), "MM/dd")}
          style={{
            axis: { stroke: colors.baseContent },
            tickLabels: { fill: colors.baseContent },
          }}
        />
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: colors.baseContent },
            tickLabels: { fill: colors.baseContent },
          }}
        />
        <VictoryLine
          data={graphData}
          style={{
            data: { stroke: colors.primary },
          }}
          labelComponent={<VictoryTooltip />}
        />
      </VictoryChart>
    </Card>
  )

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
        iosTitle="Tic Data"
        rightView={() => (
          <Button
            variant="ghost"
            size="icon"
            onPress={() => setIsFilterModalVisible(true)}
          >
            <MaterialCommunityIcons name="filter-variant" size={24} color={colors.primary} />
          </Button>
        )}
      />

      <View className="flex-row justify-between mb-4">
        <Button
          variant={timeRange === "7d" ? "default" : "outline"}
          size="sm"
          onPress={() => setTimeRange("7d")}
        >
          7 Days
        </Button>
        <Button
          variant={timeRange === "30d" ? "default" : "outline"}
          size="sm"
          onPress={() => setTimeRange("30d")}
        >
          30 Days
        </Button>
        <Button
          variant={timeRange === "all" ? "default" : "outline"}
          size="sm"
          onPress={() => setTimeRange("all")}
        >
          All Time
        </Button>
      </View>

      <View className="flex-row justify-between mb-4">
        <Button
          variant={graphType === "frequency" ? "default" : "outline"}
          size="sm"
          onPress={() => setGraphType("frequency")}
        >
          Frequency
        </Button>
        <Button
          variant={graphType === "avgIntensity" ? "default" : "outline"}
          size="sm"
          onPress={() => setGraphType("avgIntensity")}
        >
          Avg Intensity
        </Button>
        <Button
          variant={graphType === "totalIntensity" ? "default" : "outline"}
          size="sm"
          onPress={() => setGraphType("totalIntensity")}
        >
          Total Intensity
        </Button>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-primary">Loading data...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-error">{error}</Text>
        </View>
      ) : (
        <>
          {renderGraph()}
          
          <Card className="mt-4 p-4 rounded-lg bg-card">
            <Text variant="heading" className="mb-2">
              Summary
            </Text>
            <Text variant="body" className="text-dim">
              Total Tics: {ticData.length}
            </Text>
            <Text variant="body" className="text-dim">
              Avg Intensity:{" "}
              {(
                ticData.reduce((sum, log) => sum + log.intensity, 0) / ticData.length
              ).toFixed(1)}
            </Text>
          </Card>

          <Button className="mt-4" onPress={exportData}>
            Export Data
          </Button>
        </>
      )}

      <BottomSheetModal
        visible={isFilterModalVisible}
        onClose={() => setIsFilterModalVisible(false)}
        height={400}
      >
        <View className="p-4">
          <Text variant="heading" className="mb-4">
            Filter Tics
          </Text>
          <CheckboxGroup
            options={Object.values(ticTypes).map((type) => ({
              label: type.name,
              value: type.id,
            }))}
            selectedValues={selectedTicTypes}
            onValueChange={setSelectedTicTypes}
          />
        </View>
      </BottomSheetModal>
    </Screen>
  )
}
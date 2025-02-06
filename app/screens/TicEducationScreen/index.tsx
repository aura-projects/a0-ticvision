/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo } from "react"
import { View, ScrollView, Pressable } from "react-native"
import { AppStackScreenProps } from "@/app/navigators"
import {
  Text,
  Screen,
  AdaptiveHeader,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  ProgressIndicator,
  Separator,
} from "@/app/ui/components"
import { useTheme } from "@/app/ui/theme/useTheme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { cn } from "@/app/ui/lib/cn"
import { useTicStore } from "@/lib/TicStore"
import { ChevronRight, Search } from "lucide-react-native"

interface TicEducationScreenProps extends AppStackScreenProps<"TicEducation"> {}

// Categories for organizing tic types
const categories = {
  motor: [
    "Motor Breathing",
    "Motor Face (Eyes)",
    "Motor Face (Jaw)",
    "Motor Face (Mouth)",
    "Motor Neck",
    "Motor Shoulder",
    "Motor Chest",
    "Motor Stomach",
    "Motor Arm",
    "Motor Hand/Finger",
    "Motor Foot/Toe",
    "Motor Pelvis",
    "Motor Leg",
    "Motor Back",
    "Motor Combined Movements",
  ],
  vocal: [
    "Vocal Simple",
    "Vocal Word",
    "Vocal Phrase",
    "Vocal Breathing Sounds",
    "Vocal Complex",
    "Vocal Repetition (Echolalia)",
    "Vocal Palilalia",
    "Vocal Coprolalia",
    "Vocal Animal Sounds",
  ],
}

export const TicEducationScreen = function TicEducationScreen({
  navigation,
}: TicEducationScreenProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { ticTypes } = useTicStore()

  const [searchQuery, setSearchQuery] = useState("")
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [readProgress, setReadProgress] = useState(0)

  // Filter tic types based on search query
  const filteredTicTypes = useMemo(() => {
    return Object.values(ticTypes).filter(
      (tic) =>
        tic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tic.description.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [ticTypes, searchQuery])

  // Calculate reading progress
  useEffect(() => {
    const progress = (expandedItems.length / (categories.motor.length + categories.vocal.length)) * 100
    setReadProgress(progress)
  }, [expandedItems])

  const handleItemExpand = (value: string) => {
    if (!expandedItems.includes(value)) {
      setExpandedItems([...expandedItems, value])
    }
  }

  const renderTicCategory = (title: string, items: string[]) => (
    <View className="mb-4">
      <Card className="border border-base-200 rounded-lg overflow-hidden">
        <CardHeader className="bg-base-200 p-4">
          <CardTitle className="text-base-content">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Accordion type="multiple" className="w-full">
            {items.map((item) => (
              <AccordionItem key={item} value={item}>
                <AccordionTrigger
                  className="px-4 py-3 flex-row justify-between items-center"
                  onPress={() => handleItemExpand(item)}
                >
                  <Text variant="body" className="flex-1 text-base-content">
                    {item}
                  </Text>
                  <ChevronRight size={20} color={colors.baseContent} />
                </AccordionTrigger>
                <AccordionContent className="px-4 py-2 bg-base-200">
                  <Text variant="callout" className="text-base-content">
                    {
                      Object.values(ticTypes).find((tic) => tic.name === item)?.description ||
                      "Description coming soon..."
                    }
                  </Text>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </View>
  )

  return (
    <Screen
      safeAreaEdges={["top"]}
      className="bg-background"
      contentContainerClassName="flex-1"
      contentContainerStyle={{
        paddingBottom: insets.bottom,
      }}
    >
      <AdaptiveHeader
        iosTitle="Tic Education"
        searchBar={{
          placeholder: "Search tic types...",
          onChangeText: setSearchQuery,
        }}
      />

      <View className="px-4 py-2">
        <View className="mb-4">
          <Text variant="callout" className="text-base-content mb-2">
            Reading Progress
          </Text>
          <ProgressIndicator
            value={readProgress}
            className="w-full h-2 bg-base-200 rounded-full overflow-hidden"
          />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 20,
        }}
      >
        {searchQuery ? (
          // Search results
          <View className="space-y-4">
            {filteredTicTypes.map((tic) => (
              <Card key={tic.id} className="border border-base-200 rounded-lg">
                <CardHeader className="p-4">
                  <CardTitle className="text-base-content">{tic.name}</CardTitle>
                  <CardDescription className="text-dim">{tic.category}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <Text variant="callout" className="text-base-content">
                    {tic.description}
                  </Text>
                </CardContent>
              </Card>
            ))}
          </View>
        ) : (
          // Categories view
          <>
            {renderTicCategory("Motor Tics", categories.motor)}
            <Separator className="my-4" />
            {renderTicCategory("Vocal Tics", categories.vocal)}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}
import React, { useCallback, useEffect, useRef, useState } from "react"
import { View, Animated, PanResponder, Dimensions } from "react-native"
import { AppStackScreenProps } from "@/app/navigators"
import {
  Text,
  Screen,
  Button,
  CheckboxGroup,
  ProgressIndicator,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/ui/components"
import { useTheme } from "@/app/ui/theme/useTheme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { cn } from "@/app/ui/lib/cn"
import { useTicStore } from "@/lib/TicStore"
import { useRootStore } from "@/app/models/RootStore"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

interface OnboardingWizardScreenProps extends AppStackScreenProps<"OnboardingWizard"> {}

interface OnboardingStep {
  title: string
  description: string
  content: React.ReactNode
}

export const OnboardingWizardScreen = function OnboardingWizardScreen({
  navigation,
}: OnboardingWizardScreenProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { userId } = useRootStore.getState()
  const { fetchTicTypes, ticTypes } = useTicStore()

  // State
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTicTypes, setSelectedTicTypes] = useState<string[]>([])
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false)

  // Animation
  const position = useRef(new Animated.Value(0)).current
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20
      },
      onPanResponderMove: (_, gestureState) => {
        if (
          (currentStep === 0 && gestureState.dx > 0) ||
          (currentStep === steps.length - 1 && gestureState.dx < 0)
        )
          return
        position.setValue(gestureState.dx)
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > SCREEN_WIDTH * 0.4) {
          const newStep = gestureState.dx > 0 ? currentStep - 1 : currentStep + 1
          if (newStep >= 0 && newStep < steps.length) {
            Animated.timing(position, {
              toValue: gestureState.dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH,
              duration: 250,
              useNativeDriver: true,
            }).start(() => {
              position.setValue(0)
              setCurrentStep(newStep)
            })
          }
        } else {
          Animated.spring(position, {
            toValue: 0,
            useNativeDriver: true,
          }).start()
        }
      },
    }),
  ).current

  useEffect(() => {
    fetchTicTypes()
  }, [fetchTicTypes])

  const handleComplete = useCallback(() => {
    // Save selected tic types and navigate to main app
    navigation.replace("QuickLog")
  }, [navigation])

  const steps: OnboardingStep[] = [
    {
      title: "Welcome to TicVision",
      description: "Your personal tic tracking companion",
      content: (
        <View className="space-y-4">
          <Text className="text-base-content text-center">
            TicVision helps you understand and manage your tics better through easy tracking and
            personalized insights.
          </Text>
          <View className="h-40 bg-primary/10 rounded-lg items-center justify-center">
            {/* App showcase image placeholder */}
            <Text className="text-primary">App Preview</Text>
          </View>
        </View>
      ),
    },
    {
      title: "Privacy First",
      description: "Your data is secure and private",
      content: (
        <View className="space-y-4">
          <Text className="text-base-content">
            We take your privacy seriously. Your data is encrypted and only used to provide you with
            personalized insights.
          </Text>
          <CheckboxGroup
            options={[
              {
                label: "I accept the privacy policy and terms of service",
                value: "privacy",
              },
            ]}
            selectedValues={hasAcceptedPrivacy ? ["privacy"] : []}
            onValueChange={(values) => setHasAcceptedPrivacy(values.includes("privacy"))}
            containerClassName="mt-4"
          />
        </View>
      ),
    },
    {
      title: "Select Your Tic Types",
      description: "Choose the types of tics you experience",
      content: (
        <View className="space-y-4">
          <CheckboxGroup
            options={Object.values(ticTypes).map((type) => ({
              label: type.name,
              value: type.id,
            }))}
            selectedValues={selectedTicTypes}
            onValueChange={setSelectedTicTypes}
            containerClassName="space-y-2"
          />
        </View>
      ),
    },
    {
      title: "Quick Logging Demo",
      description: "Learn how to log your tics quickly",
      content: (
        <View className="space-y-4">
          <Card className="bg-primary/5 border border-primary/20">
            <CardHeader>
              <CardTitle>Simple 3-Step Process</CardTitle>
              <CardDescription>Logging takes just seconds</CardDescription>
            </CardHeader>
            <CardContent>
              <View className="space-y-2">
                <Text>1. Select the tic type</Text>
                <Text>2. Rate the intensity (1-10)</Text>
                <Text>3. Choose the time of day</Text>
              </View>
            </CardContent>
          </Card>
        </View>
      ),
    },
  ]

  const canProceed = currentStep === 1 ? hasAcceptedPrivacy : currentStep === 2 ? selectedTicTypes.length > 0 : true

  return (
    <Screen
      safeAreaEdges={["top"]}
      className="bg-background"
      contentContainerClassName="flex-1 px-sides"
      contentContainerStyle={{
        paddingBottom: insets.bottom,
      }}
    >
      <View className="flex-1">
        <View className="py-4">
          <ProgressIndicator value={(currentStep + 1) * (100 / steps.length)} className="w-full" />
        </View>

        <Animated.View
          className="flex-1"
          style={{
            transform: [{ translateX: position }],
          }}
          {...panResponder.panHandlers}
        >
          <View className="flex-1">
            <Text variant="title2" className="text-center text-primary mb-2">
              {steps[currentStep].title}
            </Text>
            <Text variant="callout" className="text-center text-base-content/70 mb-8">
              {steps[currentStep].description}
            </Text>
            {steps[currentStep].content}
          </View>
        </Animated.View>

        <View className="flex-row justify-between items-center py-4">
          <Button
            variant="ghost"
            onPress={() => setCurrentStep((prev) => prev - 1)}
            className={cn("w-24", currentStep === 0 && "invisible")}
          >
            Back
          </Button>
          <Button
            variant={currentStep === steps.length - 1 ? "default" : "secondary"}
            onPress={() => {
              if (currentStep === steps.length - 1) {
                handleComplete()
              } else {
                setCurrentStep((prev) => prev + 1)
              }
            }}
            className="w-24"
            disabled={!canProceed}
          >
            {currentStep === steps.length - 1 ? "Start" : "Next"}
          </Button>
        </View>
      </View>
    </Screen>
  )
}
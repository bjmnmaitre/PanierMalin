import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/design';
import { Card, Button, Input } from '@/components/primitives';
import { completeOnboarding } from '@/services/api';
import type { Allergy, DietType, TransportMode } from '@/types';

export interface OnboardingScreenProps {
  onComplete: () => void;
}

interface OptionConfig<T extends string> {
  value: T;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const DIET_OPTIONS: OptionConfig<DietType>[] = [
  { value: 'none', label: 'Aucun régime particulier', icon: 'restaurant' },
  { value: 'vegan', label: 'Végan', icon: 'eco' },
  { value: 'vegetarian', label: 'Végétarien', icon: 'grass' },
  { value: 'diabetic', label: 'Diabétique', icon: 'medical-services' },
];

const ALLERGY_OPTIONS: OptionConfig<Allergy>[] = [
  { value: 'gluten', label: 'Gluten', icon: 'no-food' },
  { value: 'lactose', label: 'Lactose', icon: 'icecream' },
  { value: 'peanuts', label: 'Arachides', icon: 'warning' },
];

const TRANSPORT_OPTIONS: OptionConfig<TransportMode>[] = [
  { value: 'car_thermal', label: 'Voiture thermique', icon: 'local-gas-station' },
  { value: 'car_electric', label: 'Voiture électrique', icon: 'electric-car' },
  { value: 'bike', label: 'Vélo', icon: 'pedal-bike' },
  { value: 'walk', label: 'À pied', icon: 'directions-walk' },
];

const STEP_TITLES = ['Santé & régime', 'Logistique', 'Budget'];

function OptionTile<T extends string>({
  option,
  selected,
  onPress,
}: {
  option: OptionConfig<T>;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Card
      padding="md"
      shadow="none"
      backgroundColor={selected ? colors.primary_light : colors.white}
      borderColor={selected ? colors.primary : colors.border.default}
      borderWidth={1.5}
      onPress={onPress}
      style={styles.optionTile}
    >
      <View style={styles.optionTileRow}>
        <MaterialIcons name={option.icon} size={22} color={selected ? colors.primary : colors.text.secondary} />
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
        {selected && <MaterialIcons name="check-circle" size={20} color={colors.primary} />}
      </View>
    </Card>
  );
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [dietType, setDietType] = useState<DietType>('none');
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [calorieGoalText, setCalorieGoalText] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('car_thermal');
  const [shoppingTimeText, setShoppingTimeText] = useState('');
  const [budgetText, setBudgetText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAllergy = (value: Allergy) => {
    setAllergies((prev) => (prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]));
  };

  const isLastStep = step === STEP_TITLES.length - 1;

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleNext = async () => {
    if (!isLastStep) {
      setStep((s) => s + 1);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await completeOnboarding({
        dietType,
        allergies,
        dailyCalorieGoal: calorieGoalText ? Number(calorieGoalText) : undefined,
        transportMode,
        maxShoppingTimeMinutes: shoppingTimeText ? Number(shoppingTimeText) : undefined,
        monthlyBudget: budgetText ? Number(budgetText) : undefined,
      });
      onComplete();
    } catch (err) {
      console.error('[OnboardingScreen] completeOnboarding a échoué', err);
      setError("Impossible d'enregistrer ton profil pour le moment. Réessaie dans un instant.");
      Alert.alert('Erreur', "Impossible d'enregistrer ton profil pour le moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing[6] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressRow}>
          {STEP_TITLES.map((_, index) => (
            <View
              key={index}
              style={[styles.progressDot, index <= step ? styles.progressDotActive : styles.progressDotInactive]}
            />
          ))}
        </View>

        <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>

        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={styles.groupLabel}>Régime alimentaire</Text>
            <View style={styles.optionsGroup}>
              {DIET_OPTIONS.map((option) => (
                <OptionTile
                  key={option.value}
                  option={option}
                  selected={dietType === option.value}
                  onPress={() => setDietType(option.value)}
                />
              ))}
            </View>

            <Text style={styles.groupLabel}>Allergies</Text>
            <View style={styles.optionsGroup}>
              {ALLERGY_OPTIONS.map((option) => (
                <OptionTile
                  key={option.value}
                  option={option}
                  selected={allergies.includes(option.value)}
                  onPress={() => toggleAllergy(option.value)}
                />
              ))}
            </View>

            <Text style={styles.groupLabel}>Objectif calorique quotidien (optionnel)</Text>
            <Input placeholder="Ex : 2000" value={calorieGoalText} onChangeText={setCalorieGoalText} type="number" />
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.groupLabel}>Mode de transport</Text>
            <View style={styles.optionsGroup}>
              {TRANSPORT_OPTIONS.map((option) => (
                <OptionTile
                  key={option.value}
                  option={option}
                  selected={transportMode === option.value}
                  onPress={() => setTransportMode(option.value)}
                />
              ))}
            </View>

            <Text style={styles.groupLabel}>Temps max alloué aux courses (minutes)</Text>
            <Input placeholder="Ex : 45" value={shoppingTimeText} onChangeText={setShoppingTimeText} type="number" />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.groupLabel}>Budget mensuel cible (€)</Text>
            <Input
              placeholder="Ex : 300"
              value={budgetText}
              onChangeText={setBudgetText}
              type="number"
              disabled={submitting}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
        <View style={styles.footerRow}>
          {step > 0 && (
            <View style={styles.footerButtonFlex}>
              <Button label="Retour" variant="outline" onPress={handleBack} disabled={submitting} fullWidth />
            </View>
          )}
          <View style={styles.footerButtonFlex}>
            <Button
              label={isLastStep ? 'Terminer' : 'Suivant'}
              variant="primary"
              onPress={handleNext}
              loading={submitting}
              fullWidth
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[5],
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  progressDotInactive: {
    backgroundColor: colors.gray[200],
  },
  stepTitle: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing[5],
  },
  stepContent: {
    gap: spacing[2],
  },
  groupLabel: {
    ...typography.labelLarge,
    color: colors.text.primary,
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  optionsGroup: {
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  optionTile: {
    width: '100%',
  },
  optionTileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  optionLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  optionLabelSelected: {
    fontWeight: '700',
    color: colors.primary,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing[2],
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  footerButtonFlex: {
    flex: 1,
  },
});

import type { UniversalStoreResult } from '@/types';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/design';
import { Card, Input, Button, Badge } from '@/components/primitives';
import { Header } from '@/components/features';
import { searchUniversalStores } from '@/services/api';
import type { UniversalStoreResult } from '@/types';

export interface UniversalSearchScreenProps {
  onBack: () => void;
}

const FALLBACK_REGION = {
  latitude: 46.1601,
  longitude: -1.1511,
};

const SUGGESTED_KEYWORDS = ['Boulangerie', 'Pharmacie', 'Quincaillerie', 'CBD', 'Artisan', 'Fleuriste'];

export default function UniversalSearchScreen({ onBack }: UniversalSearchScreenProps) {
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<UniversalStoreResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [itineraryIds, setItineraryIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationDenied(true);
          setUserCoords(FALLBACK_REGION);
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch (error) {
        console.warn('[UniversalSearchScreen] Géolocalisation indisponible, repli sur la position par défaut', error);
        setUserCoords(FALLBACK_REGION);
      } finally {
        setIsLocating(false);
      }
    })();
  }, []);

  const runSearch = async (keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed || !userCoords || isSearching) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const data = await searchUniversalStores(trimmed, userCoords.latitude, userCoords.longitude);
      setResults(data);
    } catch (error) {
      console.error('[UniversalSearchScreen] Recherche échouée', error);
      setSearchError("La recherche a échoué. Réessaie dans un instant.");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestedKeyword = (keyword: string) => {
    setSearchQuery(keyword);
    runSearch(keyword);
  };

  const toggleItinerary = (id: string) => {
    setItineraryIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  };

  return (
    <View style={styles.root}>
      <Header
        title="Recherche universelle"
        subtitle={itineraryIds.length > 0 ? `${itineraryIds.length} commerce(s) dans l'itinéraire` : undefined}
        onBackPress={onBack}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Input
          leftIcon="search"
          rightIcon={searchQuery ? 'close' : undefined}
          onRightIconPress={() => setSearchQuery('')}
          placeholder="Boulangerie, quincaillerie, CBD, artisan..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <Button
          label="Rechercher"
          variant="primary"
          icon="travel-explore"
          onPress={() => runSearch(searchQuery)}
          loading={isSearching}
          disabled={!searchQuery.trim() || !userCoords}
          fullWidth
          style={styles.searchButton}
        />

        <View style={styles.suggestedRow}>
          {SUGGESTED_KEYWORDS.map((keyword) => (
            <Pressable key={keyword} onPress={() => handleSuggestedKeyword(keyword)}>
              <Badge label={keyword} variant="info" />
            </Pressable>
          ))}
        </View>

        {isLocating && (
          <Card padding="lg" shadow="sm" style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Localisation en cours...</Text>
          </Card>
        )}

        {!isLocating && locationDenied && (
          <Card padding="lg" shadow="sm" style={styles.stateCard}>
            <MaterialIcons name="gps-not-fixed" size={28} color={colors.text.tertiary} />
            <Text style={styles.stateText}>
              Localisation refusée. Active-la dans les réglages pour trouver les commerces autour de toi.
            </Text>
          </Card>
        )}

        {!isLocating && !hasSearched && !locationDenied && (
          <Card padding="lg" shadow="sm" style={styles.stateCard}>
            <MaterialIcons name="storefront" size={28} color={colors.text.tertiary} />
            <Text style={styles.stateText}>
              Cherche n'importe quel type de commerce autour de toi, pas seulement les supermarchés.
            </Text>
          </Card>
        )}

        {isSearching && (
          <Card padding="lg" shadow="sm" style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Recherche en cours...</Text>
          </Card>
        )}

        {searchError && (
          <Card padding="lg" shadow="sm" style={styles.stateCard}>
            <MaterialIcons name="warning" size={28} color={colors.error} />
            <Text style={styles.stateText}>{searchError}</Text>
          </Card>
        )}

        {!isSearching && hasSearched && !searchError && results.length === 0 && (
          <Card padding="lg" shadow="sm" style={styles.stateCard}>
            <MaterialIcons name="search-off" size={28} color={colors.text.tertiary} />
            <Text style={styles.stateText}>Aucun commerce trouvé pour "{searchQuery}" à proximité.</Text>
          </Card>
        )}

        {!isSearching &&
          results.map((store) => {
            const inItinerary = itineraryIds.includes(store.id);

            return (
              <Card key={store.id} padding="md" shadow="sm" style={styles.resultCard}>
                <View style={styles.resultHeaderRow}>
                  <View style={styles.resultTitleBlock}>
                    <Text style={styles.resultName}>{store.name}</Text>
                    <Badge label={store.category} variant="info" style={styles.categoryBadge} />
                  </View>
                  <Text style={styles.resultDistance}>{store.distanceKm.toFixed(1)} km</Text>
                </View>

                {store.address.length > 0 && (
                  <View style={styles.infoRow}>
                    <MaterialIcons name="place" size={16} color={colors.text.tertiary} />
                    <Text style={styles.infoText}>{store.address}</Text>
                  </View>
                )}

                {store.hours && (
                  <View style={styles.infoRow}>
                    <MaterialIcons name="schedule" size={16} color={colors.text.tertiary} />
                    <Text style={styles.infoText}>{store.hours}</Text>
                  </View>
                )}

                {store.phone && (
                  <View style={styles.infoRow}>
                    <MaterialIcons name="phone" size={16} color={colors.text.tertiary} />
                    <Text style={styles.infoText}>{store.phone}</Text>
                  </View>
                )}

                {store.website && (
                  <View style={styles.infoRow}>
                    <MaterialIcons name="public" size={16} color={colors.text.tertiary} />
                    <Text style={styles.infoText} numberOfLines={1}>{store.website}</Text>
                  </View>
                )}

                <Button
                  label={inItinerary ? "Ajouté à l'itinéraire" : "Ajouter à l'itinéraire"}
                  variant={inItinerary ? 'outline' : 'primary'}
                  icon={inItinerary ? 'done' : 'add-road'}
                  onPress={() => toggleItinerary(store.id)}
                  fullWidth
                  style={styles.itineraryButton}
                />
              </Card>
            );
          })}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[8],
  },
  searchButton: {
    marginTop: spacing[3],
  },
  suggestedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  stateCard: {
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  stateText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  resultCard: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  resultHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  resultTitleBlock: {
    flex: 1,
    gap: spacing[1],
  },
  resultName: {
    ...typography.h4,
    color: colors.text.primary,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
  },
  resultDistance: {
    ...typography.labelMedium,
    color: colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  itineraryButton: {
    marginTop: spacing[2],
  },
});
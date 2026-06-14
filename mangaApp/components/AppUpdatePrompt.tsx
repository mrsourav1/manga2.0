import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAppUpdate, type AppUpdateInfo } from '../services/mangaServices';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const getCurrentBuildNumber = () => {
  const buildNumber = Number.parseInt(Application.nativeBuildVersion ?? '', 10);
  return Number.isFinite(buildNumber) ? buildNumber : 0;
};

export default function AppUpdatePrompt() {
  const insets = useSafeAreaInsets();
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
  const [isOpeningDownload, setIsOpeningDownload] = useState(false);
  const lastCheckedAtRef = useRef(0);
  const dismissedBuildRef = useRef<number | null>(null);
  const currentBuildNumber = getCurrentBuildNumber();
  const updateRequired =
    update !== null &&
    currentBuildNumber < update.minimumSupportedBuildNumber;

  useEffect(() => {
    if (__DEV__ || Platform.OS !== 'android' || currentBuildNumber <= 0) {
      return;
    }

    const checkForUpdate = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastCheckedAtRef.current < CHECK_INTERVAL_MS) {
        return;
      }

      lastCheckedAtRef.current = now;

      try {
        const nextUpdate = await getAppUpdate();
        const updateAvailable =
          nextUpdate.enabled &&
          nextUpdate.latestBuildNumber > currentBuildNumber;

        if (
          updateAvailable &&
          dismissedBuildRef.current !== nextUpdate.latestBuildNumber
        ) {
          setUpdate(nextUpdate);
        } else if (!updateAvailable) {
          setUpdate(null);
        }
      } catch (error) {
        console.warn('Could not check for an app update', error);
      }
    };

    void checkForUpdate(true);

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void checkForUpdate();
      }
    });

    return () => subscription.remove();
  }, [currentBuildNumber]);

  const dismissUpdate = () => {
    if (!update || updateRequired) return;

    dismissedBuildRef.current = update.latestBuildNumber;
    setUpdate(null);
  };

  const openDownload = async () => {
    if (!update || isOpeningDownload) return;

    setIsOpeningDownload(true);

    try {
      await Linking.openURL(update.downloadUrl);
    } catch {
      Alert.alert(
        'Download unavailable',
        'The update link could not be opened. Please try again in a moment.'
      );
    } finally {
      setIsOpeningDownload(false);
    }
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={dismissUpdate}
      statusBarTranslucent
      transparent
      visible={update !== null}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={styles.iconWrap}>
            <Ionicons color="#fff7ed" name="arrow-up-circle" size={36} />
          </View>

          <Text style={styles.eyebrow}>
            {updateRequired ? 'UPDATE REQUIRED' : 'A NEW CHAPTER FOR THE APP'}
          </Text>
          <Text style={styles.title}>
            MangaFy {update?.latestVersion} is ready
          </Text>
          <Text style={styles.description}>
            Download the latest APK to get the newest improvements and fixes.
          </Text>

          {update?.releaseNotes.length ? (
            <View style={styles.notes}>
              {update.releaseNotes.slice(0, 4).map(note => (
                <View key={note} style={styles.noteRow}>
                  <View style={styles.noteDot} />
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            disabled={isOpeningDownload}
            onPress={() => void openDownload()}
            style={({ pressed }) => [
              styles.updateButton,
              pressed && styles.buttonPressed,
              isOpeningDownload && styles.buttonDisabled,
            ]}
          >
            <Ionicons color="#1c1917" name="download-outline" size={20} />
            <Text style={styles.updateButtonText}>
              {isOpeningDownload ? 'Opening download…' : 'Download update'}
            </Text>
          </Pressable>

          {!updateRequired ? (
            <Pressable
              onPress={dismissUpdate}
              style={({ pressed }) => [
                styles.laterButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.laterButtonText}>Maybe later</Text>
            </Pressable>
          ) : (
            <Text style={styles.requiredText}>
              This version is no longer supported.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(12, 10, 9, 0.78)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 48,
  },
  card: {
    backgroundColor: '#1c1917',
    borderColor: 'rgba(251, 146, 60, 0.25)',
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: 520,
    paddingHorizontal: 24,
    paddingTop: 26,
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#c2410c',
    borderRadius: 22,
    height: 56,
    justifyContent: 'center',
    marginBottom: 20,
    width: 56,
  },
  eyebrow: {
    color: '#fb923c',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    color: '#fff7ed',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  description: {
    color: '#d6d3d1',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  notes: {
    backgroundColor: 'rgba(255, 247, 237, 0.06)',
    borderRadius: 18,
    gap: 10,
    marginTop: 20,
    padding: 16,
  },
  noteRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  noteDot: {
    backgroundColor: '#fb923c',
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    width: 6,
  },
  noteText: {
    color: '#e7e5e4',
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  updateButton: {
    alignItems: 'center',
    backgroundColor: '#fb923c',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 54,
    paddingHorizontal: 18,
  },
  updateButtonText: {
    color: '#1c1917',
    fontSize: 16,
    fontWeight: '800',
  },
  laterButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  laterButtonText: {
    color: '#a8a29e',
    fontSize: 14,
    fontWeight: '700',
  },
  requiredText: {
    color: '#a8a29e',
    fontSize: 13,
    marginTop: 14,
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonDisabled: {
    opacity: 0.58,
  },
});

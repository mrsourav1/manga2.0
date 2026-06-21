import { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

type CollapsibleBannerAdProps = {
  unitId: string;
  label: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function CollapsibleBannerAd({
  unitId,
  label,
  containerStyle,
}: CollapsibleBannerAdProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  if (!unitId) return null;

  return (
    <View
      collapsable={false}
      pointerEvents={isLoaded ? 'auto' : 'none'}
      style={isLoaded ? containerStyle : styles.hiddenLoader}
    >
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => {
          setIsLoaded(true);
          console.log(`${label} banner loaded`);
        }}
        onAdFailedToLoad={(error) => {
          setIsLoaded(false);
          console.log(`${label} banner failed to load`, error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenLoader: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    alignItems: 'center',
  },
});

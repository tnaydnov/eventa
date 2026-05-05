import PremiumSplashScreen from '@/components/join/PremiumSplashScreen';

/**
 * Server-rendered loading screen for /dating/[eventSlug] (covers /join too).
 * Shows the branded Eventa splash instead of a raw spinner.
 */
export default function EventLoading() {
  return <PremiumSplashScreen subtitle="טוענים את חוויית האירוע..." />;
}

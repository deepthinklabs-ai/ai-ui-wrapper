/**
 * useOnboardingStatus Hook
 *
 * Checks if the user has completed onboarding and provides
 * a function to mark onboarding as complete.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

type OnboardingStatus = {
  needsOnboarding: boolean;
  loading: boolean;
  markOnboardingComplete: () => Promise<void>;
};

export function useOnboardingStatus(userId: string | undefined): OnboardingStatus {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    checkOnboardingStatus();
  }, [userId]);

  const checkOnboardingStatus = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('id', userId) // Use 'id' not 'user_id'
        .maybeSingle(); // Use maybeSingle() instead of single() to handle no rows

      if (error) {
        console.error('Error checking onboarding status:', error);
        console.error('Error details:', JSON.stringify(error));

        // If user profile doesn't exist, create it and show onboarding
        await createUserProfile();
        setNeedsOnboarding(true);
      } else if (!data) {
        // No user profile exists yet - create one and show onboarding
        await createUserProfile();
        setNeedsOnboarding(true);
      } else {
        // If onboarding_completed is false or null, user needs onboarding
        setNeedsOnboarding(!data?.onboarding_completed);
      }
    } catch (err) {
      console.error('Error in checkOnboardingStatus:', err);
      // On any error, try to create profile and show onboarding
      await createUserProfile();
      setNeedsOnboarding(true);
    } finally {
      setLoading(false);
    }
  };

  const createUserProfile = async () => {
    if (!userId) return;

    try {
      // Create profile with 'pending' tier - user must complete Stripe checkout to get access
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          tier: 'pending',
          onboarding_completed: false,
        });

      if (error) {
        console.error('Error creating user profile:', error);
      }
    } catch (err) {
      console.error('Error in createUserProfile:', err);
    }
  };

  const markOnboardingComplete = async () => {
    if (!userId) return;

    console.log('Marking onboarding as complete for user:', userId);

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ onboarding_completed: true })
        .eq('id', userId)
        .select();

      if (error) {
        console.error('Error marking onboarding complete:', error);
        console.error('Error details:', JSON.stringify(error));
      } else {
        console.log('Successfully marked onboarding complete:', data);
        setNeedsOnboarding(false);
      }
    } catch (err) {
      console.error('Error in markOnboardingComplete:', err);
    }

    // Always set to false to prevent getting stuck
    setNeedsOnboarding(false);
  };

  return {
    needsOnboarding,
    loading,
    markOnboardingComplete,
  };
}

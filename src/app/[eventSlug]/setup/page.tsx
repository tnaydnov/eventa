'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSessionStore, useToastStore } from '@/lib/store';
import { updateProfile, getMyPhotos } from '@/lib/api';
import { profileSetupSchema, type ProfileSetupData } from '@/lib/validations';
import { LOOKING_FOR_OPTIONS, PROFILE_SETUP_KEY_PREFIX } from '@/lib/constants';
import MobileGuard from '@/components/MobileGuard';
import { PageTransition } from '@/components/Animations';
import { EditIcon, HeartIcon } from '@/components/Icons';
import ProfilePhotoGrid from '../profile/_components/ProfilePhotoGrid';
import type { Gender, AttractedTo, LookingFor, ParticipantPhoto } from '@/lib/database.types';

export default function ProfileSetupPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const router = useRouter();
  const session = useSessionStore((s) => s.session);

  const setParticipant = useSessionStore((s) => s.setParticipant);
  const setStorePhotos = useSessionStore((s) => s.setPhotos);
  const toast = useToastStore((s) => s.show);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileSetupData>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      display_name: '',
      gender: 'male',
      attracted_to: 'all',
      bio: '',
      age: undefined as unknown as number,
      city: '',
      looking_for: null,
    },
  });

  const gender = watch('gender');
  const attractedTo = watch('attracted_to');
  const lookingFor = watch('looking_for');

  const [uploadedPhotos, setUploadedPhotos] = useState<ParticipantPhoto[]>([]);
  const [photoError, setPhotoError] = useState(false);
  const photoSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    const key = `setup-started:${session.eventId}:${session.participantId}`;
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');

    void fetch('/api/telemetry/funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: session.eventId,
        session_id: session.participantId,
        step: 'setup_started',
        metadata: {},
      }),
    });
  }, [session]);

  const handlePhotosChange = (photos: ParticipantPhoto[]) => {
    setUploadedPhotos(photos);
    setStorePhotos(photos);
    if (photos.length > 0) setPhotoError(false);
  };

  const onSubmit = async (data: ProfileSetupData) => {
    if (!session) {
      console.error('[setup] session is null at submit time');
      toast('אין סשן פעיל - רפרשו את העמוד');
      return;
    }

    if (uploadedPhotos.length === 0) {
      setPhotoError(true);
      toast('חובה להעלות לפחות תמונה אחת 📸');
      photoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    try {
      const profileData = {
        display_name: data.display_name.trim(),
        gender: data.gender as Gender,
        attracted_to: data.attracted_to as AttractedTo,
        bio: data.bio?.trim() || null,
        age: data.age,
        city: data.city?.trim() || null,
        looking_for: data.looking_for ?? null,
      };
      const p = await updateProfile(session.participantId, profileData);

      if (!p) {
        toast('שגיאה בשמירת הפרופיל');
        return;
      }

      const photos = await getMyPhotos(session.participantId);

      setParticipant(p);
      setStorePhotos(photos);
      localStorage.setItem(`${PROFILE_SETUP_KEY_PREFIX}${session.participantId}`, 'true');

      router.replace(`/${eventSlug}`);
    } catch {
      toast('שגיאה - נסו שוב');
    }
  };

  if (!session) {
    return (
      <MobileGuard>
        <div className="app-container" style={{ padding: '32px', textAlign: 'center' }}>
          <p>אין סשן פעיל - סרקו QR כדי להיכנס</p>
        </div>
      </MobileGuard>
    );
  }

  return (
    <MobileGuard>
      <PageTransition>
        <div className="profile-edit-page">
          {/* ─── Header ─── */}
          <div className="profile-edit-header">
            <div style={{ width: '32px' }} />
            <h1>יצירת פרופיל</h1>
            <div style={{ width: '32px' }} />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="profile-edit-form">
            {/* ─── Photos Section ─── */}
            <div ref={photoSectionRef} className={photoError ? 'photo-section-error' : ''}>
              <ProfilePhotoGrid
                eventId={session.eventId}
                participantId={session.participantId}
                photos={uploadedPhotos}
                onPhotosChange={handlePhotosChange}
                toast={toast}
              />
              {photoError && (
                <p className="profile-edit-error photo-required-error" role="alert">חובה להעלות לפחות תמונה אחת</p>
              )}
            </div>

            {/* ─── Basic Info ─── */}
            <div className="profile-edit-section">
              <div className="profile-edit-section-title">
                <span className="profile-edit-section-icon"><EditIcon size={18} /></span>
                <span>פרטים בסיסיים</span>
              </div>

              <div className="profile-edit-field">
                <label htmlFor="setup-name">שם / כינוי</label>
                <input id="setup-name" className="input" placeholder="הזינו את שמכם" autoComplete="nickname" aria-invalid={!!errors.display_name} aria-describedby={errors.display_name ? 'setup-name-error' : undefined} {...register('display_name')} maxLength={30} />
                {errors.display_name && (
                  <p id="setup-name-error" className="profile-edit-error" role="alert">{errors.display_name.message}</p>
                )}
              </div>

              <div className="profile-edit-field">
                <label htmlFor="setup-age">גיל</label>
                <input
                  id="setup-age"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={120}
                  placeholder="הזינו גיל"
                  autoComplete="off"
                  aria-invalid={!!errors.age}
                  aria-describedby={errors.age ? 'setup-age-error' : undefined}
                  {...register('age', {
                    setValueAs: (v: string) => v === '' ? undefined : Number(v),
                  })}
                />
                {errors.age && <p id="setup-age-error" className="profile-edit-error" role="alert">{errors.age.message}</p>}
              </div>

              <div className="profile-edit-field">
                <label htmlFor="setup-city">עיר</label>
                <input id="setup-city" className="input" placeholder="מאיפה אתם?" autoComplete="address-level2" aria-invalid={!!errors.city} aria-describedby={errors.city ? 'setup-city-error' : undefined} {...register('city')} maxLength={50} />
                {errors.city && <p id="setup-city-error" className="profile-edit-error" role="alert">{errors.city.message}</p>}
              </div>

              <div className="profile-edit-field">
                <label htmlFor="setup-bio">קצת עליי</label>
                <textarea
                  id="setup-bio"
                  className="input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder="ספרו משהו על עצמכם..."
                  autoComplete="off"
                  aria-invalid={!!errors.bio}
                  aria-describedby={errors.bio ? 'setup-bio-error' : undefined}
                  {...register('bio')}
                  maxLength={200}
                />
                {errors.bio && <p id="setup-bio-error" className="profile-edit-error" role="alert">{errors.bio.message}</p>}
              </div>
            </div>

            {/* ─── Identity & Preferences ─── */}
            <div className="profile-edit-section">
              <div className="profile-edit-section-title">
                <span className="profile-edit-section-icon"><HeartIcon size={18} /></span>
                <span>מגדר והעדפות</span>
              </div>

              <div className="profile-edit-field">
                <label id="setup-gender-label">אני</label>
                <div className="profile-edit-pills" role="radiogroup" aria-labelledby="setup-gender-label">
                  {([
                    { value: 'male' as Gender, label: 'גבר' },
                    { value: 'female' as Gender, label: 'אישה' },
                    { value: 'other' as Gender, label: 'אחר' },
                  ]).map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      role="radio"
                      aria-checked={gender === g.value}
                      className={`profile-edit-pill${gender === g.value ? ' active' : ''}`}
                      onClick={() => setValue('gender', g.value, { shouldValidate: true })}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                {errors.gender && <p className="profile-edit-error" role="alert">{errors.gender.message}</p>}
              </div>

              <div className="profile-edit-field">
                <label id="setup-attracted-label">מעוניין/ת ב</label>
                <div className="profile-edit-pills" role="radiogroup" aria-labelledby="setup-attracted-label">
                  {([
                    { value: 'men' as AttractedTo, label: 'גברים' },
                    { value: 'women' as AttractedTo, label: 'נשים' },
                    { value: 'all' as AttractedTo, label: 'כולם' },
                  ]).map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      role="radio"
                      aria-checked={attractedTo === a.value}
                      className={`profile-edit-pill${attractedTo === a.value ? ' active' : ''}`}
                      onClick={() => setValue('attracted_to', a.value, { shouldValidate: true })}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <p className="profile-edit-hint">
                  זה ישפיע על מי שתראו ומי יראה אתכם
                </p>
                {errors.attracted_to && <p className="profile-edit-error" role="alert">{errors.attracted_to.message}</p>}
              </div>

              <div className="profile-edit-field">
                <label id="setup-looking-label">מחפש/ת</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }} role="radiogroup" aria-labelledby="setup-looking-label">
                  {LOOKING_FOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={lookingFor === opt.value}
                      className={`profile-edit-pill${lookingFor === opt.value ? ' active' : ''}`}
                      style={{ flex: 'none' }}
                      onClick={() => setValue('looking_for', lookingFor === opt.value ? null : opt.value as LookingFor, { shouldValidate: true })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── Save Button ─── */}
            <button type="submit" className="profile-edit-save" disabled={isSubmitting}>
              {isSubmitting ? 'שומר...' : 'שמירה והמשך'}
            </button>
          </form>
        </div>
      </PageTransition>
    </MobileGuard>
  );
}

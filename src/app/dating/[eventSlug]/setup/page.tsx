'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSessionStore, useToastStore } from '@/lib/store';
import { updateProfile, getMyPhotos } from '@/lib/api';
import { profileSetupSchema, type ProfileSetupData } from '@/lib/validations';
import { LOOKING_FOR_OPTIONS } from '@/lib/constants';
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

  const handlePhotosChange = (photos: ParticipantPhoto[]) => {
    setUploadedPhotos(photos);
    setStorePhotos(photos);
  };

  const onSubmit = async (data: ProfileSetupData) => {
    if (!session) return;

    if (uploadedPhotos.length === 0) {
      toast('נא להעלות לפחות תמונה אחת');
      return;
    }

    try {
      const p = await updateProfile(session.participantId, {
        display_name: data.display_name.trim(),
        gender: data.gender as Gender,
        attracted_to: data.attracted_to as AttractedTo,
        bio: data.bio?.trim() || null,
        age: data.age,
        city: data.city?.trim() || null,
        looking_for: data.looking_for ?? null,
      });

      if (!p) {
        toast('שגיאה בשמירת הפרופיל');
        return;
      }

      const photos = await getMyPhotos(session.participantId);

      setParticipant(p);
      setStorePhotos(photos);
      localStorage.setItem(`profile_setup_${session.participantId}`, 'true');

      router.replace(`/dating/${eventSlug}`);
    } catch {
      toast('שגיאה — נסו שוב');
    }
  };

  if (!session) {
    return (
      <MobileGuard>
        <div className="app-container" style={{ padding: '32px', textAlign: 'center' }}>
          <p>אין סשן פעיל — סרקו QR כדי להיכנס</p>
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
            <ProfilePhotoGrid
              eventId={session.eventId}
              participantId={session.participantId}
              photos={uploadedPhotos}
              onPhotosChange={handlePhotosChange}
              toast={toast}
            />

            {/* ─── Basic Info ─── */}
            <div className="profile-edit-section">
              <div className="profile-edit-section-title">
                <span className="profile-edit-section-icon"><EditIcon size={18} /></span>
                <span>פרטים בסיסיים</span>
              </div>

              <div className="profile-edit-field">
                <label>שם / כינוי</label>
                <input className="input" placeholder="הזינו את שמכם" {...register('display_name')} maxLength={30} />
                {errors.display_name && (
                  <p className="profile-edit-error">{errors.display_name.message}</p>
                )}
              </div>

              <div className="profile-edit-field">
                <label>גיל</label>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={120}
                  placeholder="הזינו גיל"
                  {...register('age', {
                    setValueAs: (v: string) => v === '' ? undefined : Number(v),
                  })}
                />
                {errors.age && <p className="profile-edit-error">{errors.age.message}</p>}
              </div>

              <div className="profile-edit-field">
                <label>עיר</label>
                <input className="input" placeholder="מאיפה אתם?" {...register('city')} maxLength={50} />
                {errors.city && <p className="profile-edit-error">{errors.city.message}</p>}
              </div>

              <div className="profile-edit-field">
                <label>קצת עליי</label>
                <textarea
                  className="input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder="ספרו משהו על עצמכם..."
                  {...register('bio')}
                  maxLength={200}
                />
                {errors.bio && <p className="profile-edit-error">{errors.bio.message}</p>}
              </div>
            </div>

            {/* ─── Identity & Preferences ─── */}
            <div className="profile-edit-section">
              <div className="profile-edit-section-title">
                <span className="profile-edit-section-icon"><HeartIcon size={18} /></span>
                <span>מגדר והעדפות</span>
              </div>

              <div className="profile-edit-field">
                <label>אני</label>
                <div className="profile-edit-pills">
                  {([
                    { value: 'male' as Gender, label: 'גבר' },
                    { value: 'female' as Gender, label: 'אישה' },
                    { value: 'other' as Gender, label: 'אחר' },
                  ]).map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      className={`profile-edit-pill${gender === g.value ? ' active' : ''}`}
                      onClick={() => setValue('gender', g.value, { shouldValidate: true })}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                {errors.gender && <p className="profile-edit-error">{errors.gender.message}</p>}
              </div>

              <div className="profile-edit-field">
                <label>מעוניין/ת ב</label>
                <div className="profile-edit-pills">
                  {([
                    { value: 'men' as AttractedTo, label: 'גברים' },
                    { value: 'women' as AttractedTo, label: 'נשים' },
                    { value: 'all' as AttractedTo, label: 'כולם' },
                  ]).map((a) => (
                    <button
                      key={a.value}
                      type="button"
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
                {errors.attracted_to && <p className="profile-edit-error">{errors.attracted_to.message}</p>}
              </div>

              <div className="profile-edit-field">
                <label>מחפש/ת</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {LOOKING_FOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
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

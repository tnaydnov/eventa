'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSessionStore, useToastStore } from '@/lib/store';
import { updateProfile, uploadPhoto, getMyPhotos } from '@/lib/api';
import { profileSetupSchema, type ProfileSetupData } from '@/lib/validations';
import { MAX_PHOTOS, LOOKING_FOR_OPTIONS } from '@/lib/constants';
import MobileGuard from '@/components/MobileGuard';
import { PageTransition } from '@/components/Animations';
import SetupPhotoGrid from './_components/SetupPhotoGrid';
import type { Gender, AttractedTo, LookingFor } from '@/lib/database.types';

export default function ProfileSetupPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const router = useRouter();
  const session = useSessionStore((s) => s.session);

  const setParticipant = useSessionStore((s) => s.setParticipant);
  const setPhotos = useSessionStore((s) => s.setPhotos);
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

  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>(Array(MAX_PHOTOS).fill(null));

  const onSubmit = async (data: ProfileSetupData) => {
    if (!session) return;

    const hasPhoto = photoFiles.some((f) => f !== null);
    if (!hasPhoto) {
      toast('נא להעלות לפחות תמונה אחת');
      return;
    }

    try {
      const p = await updateProfile(session.participantId, {
        display_name: data.display_name,
        gender: data.gender,
        attracted_to: data.attracted_to,
        bio: data.bio ?? null,
        age: data.age,
        city: data.city ?? null,
        looking_for: data.looking_for ?? null,
      });

      if (!p) {
        toast('שגיאה בשמירת הפרופיל');
        return;
      }

      // Upload photos (compression happens inside uploadPhoto)
      let uploadFailed = false;
      for (let i = 0; i < photoFiles.length; i++) {
        const file = photoFiles[i];
        if (file) {
          const result = await uploadPhoto(session.eventId, session.participantId, file, i);
          if (!result) uploadFailed = true;
        }
      }
      if (uploadFailed) {
        toast('חלק מהתמונות לא הועלו — ניתן לנסות שוב דרך עריכת הפרופיל');
      }

      const photos = await getMyPhotos(session.participantId);

      setParticipant(p);
      setPhotos(photos);
      localStorage.setItem(`profile_setup_${session.participantId}`, 'true');

      router.replace(`/e/${eventSlug}`);
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
        <form
          className="app-container"
          style={{ padding: '24px', paddingBottom: '100px' }}
          onSubmit={handleSubmit(onSubmit)}
        >
          <h1 style={{ fontSize: '24px', color: 'var(--primary)', marginBottom: '24px' }}>
            יצירת פרופיל
          </h1>

          {/* Name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              שם / כינוי
            </label>
            <input
              className="input"
              placeholder="הזינו את שמכם"
              {...register('display_name')}
              maxLength={30}
            />
            {errors.display_name && (
              <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '4px' }}>
                {errors.display_name.message}
              </p>
            )}
          </div>

          {/* Gender */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              אני
            </label>
            <div className="select-group">
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <div
                  key={g}
                  className={`select-option ${gender === g ? 'selected' : ''}`}
                  onClick={() => setValue('gender', g)}
                >
                  {g === 'male' ? 'גבר' : g === 'female' ? 'אישה' : 'אחר'}
                </div>
              ))}
            </div>
          </div>

          {/* Attracted To */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              נמשך/ת ל
            </label>
            <div className="select-group">
              {(['men', 'women', 'all'] as AttractedTo[]).map((a) => (
                <div
                  key={a}
                  className={`select-option ${attractedTo === a ? 'selected' : ''}`}
                  onClick={() => setValue('attracted_to', a)}
                >
                  {a === 'men' ? 'גברים' : a === 'women' ? 'נשים' : 'כולם'}
                </div>
              ))}
            </div>
          </div>

          {/* Looking For */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              מחפש/ת (אופציונלי)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {LOOKING_FOR_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  className={`select-option ${lookingFor === opt.value ? 'selected' : ''}`}
                  style={{ flex: 'none' }}
                  onClick={() => setValue('looking_for', lookingFor === opt.value ? null : opt.value as LookingFor)}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          </div>

          {/* City */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              עיר (אופציונלי)
            </label>
            <input
              className="input"
              placeholder="מאיפה אתם?"
              {...register('city')}
              maxLength={50}
            />
            {errors.city && (
              <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '4px' }}>
                {errors.city.message}
              </p>
            )}
          </div>

          {/* Bio */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              ביו (אופציונלי)
            </label>
            <textarea
              className="input"
              style={{ minHeight: '80px', resize: 'vertical' }}
              placeholder="ספרו קצת על עצמכם..."
              {...register('bio')}
              maxLength={200}
            />
            {errors.bio && (
              <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '4px' }}>
                {errors.bio.message}
              </p>
            )}
          </div>

          {/* Age */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              גיל
            </label>
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
            {errors.age && (
              <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '4px' }}>
                {errors.age.message}
              </p>
            )}
          </div>

          {/* Photos */}
          <SetupPhotoGrid
            photos={photoFiles}
            onPhotosChange={setPhotoFiles}
            toast={toast}
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'שומר...' : 'שמירה והמשך'}
          </button>
        </form>
      </PageTransition>
    </MobileGuard>
  );
}

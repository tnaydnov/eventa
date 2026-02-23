'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSessionStore, useGridStore, useToastStore } from '@/lib/store';
import { getParticipant, updateProfile, getPhotoUrl } from '@/lib/api';
import { profileSetupSchema, type ProfileSetupData } from '@/lib/validations';
import { PageTransition } from '@/components/Animations';
import MobileGuard from '@/components/MobileGuard';
import LoadingSpinner from '@/components/LoadingSpinner';
import LegalDrawer from '@/components/LegalDrawer';
import { EditIcon, HeartIcon } from '@/components/Icons';
import ProfilePhotoGrid from './_components/ProfilePhotoGrid';
import DeleteAccountDialog from './_components/DeleteAccountDialog';
import { LOOKING_FOR_OPTIONS } from '@/lib/constants';
import type { Gender, AttractedTo, LookingFor, ParticipantPhoto } from '@/lib/database.types';

export default function ProfileEditPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const clearSession = useSessionStore((s) => s.clearSession);
  const setParticipant = useSessionStore((s) => s.setParticipant);
  const setStorePhotos = useSessionStore((s) => s.setPhotos);
  const toast = useToastStore((s) => s.show);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | 'cookies' | null>(null);

  // Track original gender/attraction to detect changes
  const [originalGender, setOriginalGender] = useState<Gender | null>(null);
  const [originalAttractedTo, setOriginalAttractedTo] = useState<AttractedTo | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
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

  const [existingPhotos, setExistingPhotos] = useState<ParticipantPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!session) return;
      const p = await getParticipant(session.participantId);
      if (p) {
        reset({
          display_name: p.display_name,
          gender: p.gender,
          attracted_to: p.attracted_to,
          bio: p.bio || '',
          age: p.age ?? (undefined as unknown as number),
          city: p.city || '',
          looking_for: p.looking_for ?? null,
        });
        setOriginalGender(p.gender);
        setOriginalAttractedTo(p.attracted_to);
        setExistingPhotos(p.photos);
      }
      setLoading(false);
    }
    load();
  }, [session, reset]);

  const onSubmit = async (data: ProfileSetupData) => {
    if (!session) return;

    const payload = {
      display_name: data.display_name.trim(),
      gender: data.gender as Gender,
      attracted_to: data.attracted_to as AttractedTo,
      bio: data.bio?.trim() || null,
      age: data.age,
      city: data.city?.trim() || null,
      looking_for: data.looking_for ?? null,
    };

    const p = await updateProfile(session.participantId, payload);

    if (p) {
      setParticipant(p);

      // If gender or attraction changed, clear the grid so it reloads with new filtering
      if (data.gender !== originalGender || data.attracted_to !== originalAttractedTo) {
        useGridStore.getState().setParticipants([]);
      }

      toast('הפרופיל עודכן');
      router.back();
    } else {
      toast('שגיאה בעדכון הפרופיל - נסו שוב');
    }
  };

  const handlePhotosChange = (photos: ParticipantPhoto[]) => {
    setExistingPhotos(photos);
    setStorePhotos(photos);
  };

  const handleAccountDeleted = () => {
    if (!session) return;
    localStorage.removeItem('eventa_session');
    localStorage.removeItem(`profile_setup_${session.participantId}`);
    clearSession();
    toast('החשבון נמחק');
    router.replace('/dating');
  };

  if (loading) return <MobileGuard><LoadingSpinner /></MobileGuard>;

  return (
    <MobileGuard>
      <PageTransition>
        <div className="profile-edit-page">
          {/* ─── Header ─── */}
          <div className="profile-edit-header">
            <button type="button" onClick={() => router.back()} className="profile-edit-back">←</button>
            <h1>עריכת פרופיל</h1>
            <div style={{ width: '32px' }} />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="profile-edit-form">
            {/* ─── Photos Section ─── */}
            {session && (
              <ProfilePhotoGrid
                eventId={session.eventId}
                participantId={session.participantId}
                photos={existingPhotos}
                onPhotosChange={handlePhotosChange}
                toast={toast}
              />
            )}

            {/* ─── Basic Info ─── */}
            <div className="profile-edit-section">
              <div className="profile-edit-section-title">
                <span className="profile-edit-section-icon"><EditIcon size={18} /></span>
                <span>פרטים בסיסיים</span>
              </div>

              <div className="profile-edit-field">
                <label>שם / כינוי</label>
                <input className="input" {...register('display_name')} maxLength={30} />
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
              {isSubmitting ? 'שומר...' : 'שמירת שינויים'}
            </button>

            {/* ─── Legal Links ─── */}
            <div className="profile-edit-legal">
              <button type="button" onClick={() => setLegalPage('terms')}>תנאי שימוש</button>
              <span className="profile-edit-legal__sep">·</span>
              <button type="button" onClick={() => setLegalPage('privacy')}>מדיניות פרטיות</button>
              <span className="profile-edit-legal__sep">·</span>
              <button type="button" onClick={() => setLegalPage('cookies')}>עוגיות</button>
            </div>

            {/* ─── Danger Zone ─── */}
            <div className="profile-edit-danger-zone">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
              >
                מחיקת חשבון
              </button>
            </div>
          </form>
        </div>
      </PageTransition>

      {/* Delete confirmation dialog */}
      {session && (
        <DeleteAccountDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          session={session}
          onDeleted={handleAccountDeleted}
        />
      )}

      <LegalDrawer page={legalPage} onClose={() => setLegalPage(null)} />
    </MobileGuard>
  );
}

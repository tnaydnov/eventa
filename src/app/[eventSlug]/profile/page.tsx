'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSessionStore, useGridStore, useToastStore } from '@/lib/store';
import { getMyParticipant, updateProfile } from '@/lib/api';
import { profileSetupSchema, type ProfileSetupData } from '@/lib/validations';
import { PageTransition } from '@/components/Animations';
import MobileGuard from '@/components/MobileGuard';
import LoadingSpinner from '@/components/LoadingSpinner';
import LegalDrawer from '@/components/LegalDrawer';
import { EditIcon, HeartIcon } from '@/components/Icons';
import ProfilePhotoGrid from './_components/ProfilePhotoGrid';
import DeleteAccountDialog from './_components/DeleteAccountDialog';
import { LOOKING_FOR_OPTIONS, SESSION_STORAGE_KEY, PROFILE_SETUP_KEY_PREFIX } from '@/lib/constants';
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
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [smsTogglePending, setSmsTogglePending] = useState(false);

  useEffect(() => {
    async function load() {
      if (!session) return;
      const p = await getMyParticipant();
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
        setExistingPhotos(p.photos ?? []);
        setSmsEnabled(p.sms_notifications_enabled ?? true);
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
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(`${PROFILE_SETUP_KEY_PREFIX}${session.participantId}`);
    clearSession();
    toast('החשבון נמחק');
    router.replace('/');
  };

  if (loading) return <MobileGuard><LoadingSpinner /></MobileGuard>;

  return (
    <MobileGuard>
      <PageTransition>
        <div className="profile-edit-page">
          {/* ─── Header ─── */}
          <div className="profile-edit-header">
            <button type="button" onClick={() => router.back()} className="profile-edit-back" aria-label="חזרה">←</button>
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
                <label htmlFor="profile-name">שם / כינוי</label>
                <input id="profile-name" className="input" autoComplete="nickname" aria-invalid={!!errors.display_name} aria-describedby={errors.display_name ? 'profile-name-error' : undefined} {...register('display_name')} maxLength={30} />
                {errors.display_name && (
                  <p id="profile-name-error" className="profile-edit-error" role="alert">{errors.display_name.message}</p>
                )}
              </div>

              <div className="profile-edit-field">
                <label htmlFor="profile-age">גיל</label>
                <input
                  id="profile-age"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={120}
                  placeholder="הזינו גיל"
                  autoComplete="off"
                  aria-invalid={!!errors.age}
                  aria-describedby={errors.age ? 'profile-age-error' : undefined}
                  {...register('age', { 
                    setValueAs: (v: string) => v === '' ? undefined : Number(v),
                  })}
                />
                {errors.age && <p id="profile-age-error" className="profile-edit-error" role="alert">{errors.age.message}</p>}
              </div>

              <div className="profile-edit-field">
                <label htmlFor="profile-city">עיר</label>
                <input id="profile-city" className="input" placeholder="מאיפה אתם?" autoComplete="address-level2" aria-invalid={!!errors.city} aria-describedby={errors.city ? 'profile-city-error' : undefined} {...register('city')} maxLength={50} />
                {errors.city && <p id="profile-city-error" className="profile-edit-error" role="alert">{errors.city.message}</p>}
              </div>

              <div className="profile-edit-field">
                <label htmlFor="profile-bio">קצת עליי</label>
                <textarea
                  id="profile-bio"
                  className="input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder="ספרו משהו על עצמכם..."
                  autoComplete="off"
                  aria-invalid={!!errors.bio}
                  aria-describedby={errors.bio ? 'profile-bio-error' : undefined}
                  {...register('bio')}
                  maxLength={200}
                />
                {errors.bio && <p id="profile-bio-error" className="profile-edit-error" role="alert">{errors.bio.message}</p>}
              </div>
            </div>

            {/* ─── Identity & Preferences ─── */}
            <div className="profile-edit-section">
              <div className="profile-edit-section-title">
                <span className="profile-edit-section-icon"><HeartIcon size={18} /></span>
                <span>מגדר והעדפות</span>
              </div>

              <div className="profile-edit-field">
                <label id="profile-gender-label">אני</label>
                <div className="profile-edit-pills" role="radiogroup" aria-labelledby="profile-gender-label">
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
                <label id="profile-attracted-label">מעוניין/ת ב</label>
                <div className="profile-edit-pills" role="radiogroup" aria-labelledby="profile-attracted-label">
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
                <label id="profile-looking-label">מחפש/ת</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }} role="radiogroup" aria-labelledby="profile-looking-label">
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

            {/* ─── SMS Notifications Toggle ─── */}
            {session && (
              <div className="profile-edit-section">
                <div className="profile-edit-section-title">
                  <span className="profile-edit-section-icon">📱</span>
                  <span>התראות SMS</span>
                </div>
                <div className="profile-edit-field" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label htmlFor="sms-toggle" style={{ margin: 0, cursor: 'pointer' }}>קבל/י התראות SMS</label>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>על לייקים, הודעות והתאמות חדשות</span>
                  </div>
                  <button
                    id="sms-toggle"
                    type="button"
                    role="switch"
                    aria-checked={smsEnabled}
                    disabled={smsTogglePending}
                    onClick={async () => {
                      const newVal = !smsEnabled;
                      setSmsTogglePending(true);
                      const res = await updateProfile(session.participantId, { sms_notifications_enabled: newVal } as Parameters<typeof updateProfile>[1]);
                      setSmsTogglePending(false);
                      if (res) {
                        setSmsEnabled(newVal);
                      } else {
                        toast('שגיאה בעדכון הגדרת SMS');
                      }
                    }}
                    style={{
                      width: '48px',
                      height: '28px',
                      borderRadius: '14px',
                      border: 'none',
                      cursor: smsTogglePending ? 'not-allowed' : 'pointer',
                      background: smsEnabled ? 'var(--color-rose-gold, #D4A59A)' : '#444',
                      position: 'relative',
                      flexShrink: 0,
                      opacity: smsTogglePending ? 0.6 : 1,
                      transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '3px',
                      left: smsEnabled ? '23px' : '3px',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              </div>
            )}

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
          onDeleted={handleAccountDeleted}
        />
      )}

      <LegalDrawer page={legalPage} onClose={() => setLegalPage(null)} />
    </MobileGuard>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getPortalData,
  uploadGuestFile,
  addGuestPhone,
  removeGuestPhone,
} from '@/lib/api';
import type { PortalData, UploadResult } from '@/lib/api/guest-portal';

export interface GuestPortalState {
  data: PortalData | null;
  loading: boolean;
  error: string;
  page: number;
  searchQuery: string;
  uploadResult: UploadResult | null;
}

export interface GuestPortalActions {
  handleUpload: (file: File) => Promise<void>;
  handleAddPhone: (phone: string, name?: string) => Promise<void>;
  handleRemove: (phoneId: string) => Promise<void>;
  handlePageChange: (page: number) => void;
  handleSearch: (query: string) => void;
}

export function useGuestPortal(slug: string, token: string): GuestPortalState & GuestPortalActions {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Keep current values accessible in stable callbacks
  const pageRef = useRef(page);
  pageRef.current = page;

  const loadData = useCallback(
    async (p: number, search: string) => {
      if (!token) {
        setError('קישור לא תקין - חסר טוקן אימות');
        setLoading(false);
        return;
      }
      try {
        const result = await getPortalData(token, p, search);
        if (slug && result.event.slug !== slug) {
          setError('הקישור אינו תואם את האירוע');
          setLoading(false);
          return;
        }
        setData(result);
        setPage(p);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    },
    [token, slug]
  );

  // Initial load
  useEffect(() => {
    loadData(1, '');
  }, [loadData]);

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        const result = await uploadGuestFile(token, file);
        setUploadResult(result);
        await loadData(1, '');
      } catch (err) {
        setUploadResult({
          success: false,
          added: 0,
          duplicates: 0,
          invalid: 0,
          errors: [
            {
              row: 0,
              phone: '',
              reason: err instanceof Error ? err.message : 'שגיאה בהעלאת הקובץ',
            },
          ],
          totalInList: data?.total ?? 0,
        });
      }
    },
    [token, loadData, data?.total]
  );

  const handleAddPhone = useCallback(
    async (phone: string, name?: string) => {
      await addGuestPhone(token, phone, name);
      await loadData(1, '');
    },
    [token, loadData]
  );

  const handleRemove = useCallback(
    async (phoneId: string) => {
      await removeGuestPhone(token, phoneId);
      await loadData(pageRef.current, searchQuery);
    },
    [token, loadData, searchQuery]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      loadData(newPage, searchQuery);
    },
    [loadData, searchQuery]
  );

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      loadData(1, query);
    },
    [loadData]
  );

  return {
    data,
    loading,
    error,
    page,
    searchQuery,
    uploadResult,
    handleUpload,
    handleAddPhone,
    handleRemove,
    handlePageChange,
    handleSearch,
  };
}

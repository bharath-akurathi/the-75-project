-- Migration: 004_evidence.sql
-- Description: Add evidence columns to attendance_records, create storage bucket for attachments, and set up RLS policies.

-- 1. Add columns to attendance_records
ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS evidence_tag TEXT,
ADD COLUMN IF NOT EXISTS evidence_attachment TEXT;

-- 2. Create Storage Bucket for Evidence Attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence_attachments', 'evidence_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS Policies for Storage
-- Allow users to upload attachments only to their own folder (folder name = user id)
CREATE POLICY "Users can upload their own evidence attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'evidence_attachments' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view their own attachments
CREATE POLICY "Users can view their own evidence attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'evidence_attachments' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own attachments
CREATE POLICY "Users can delete their own evidence attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'evidence_attachments' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Food Images Storage Bucket
-- Run this in your Supabase SQL editor

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('food-images', 'food-images', true, 5242880)  -- 5MB limit
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own food images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'food-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access (for the Edge Function to fetch images)
CREATE POLICY "Public read access for food images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'food-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own food images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'food-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

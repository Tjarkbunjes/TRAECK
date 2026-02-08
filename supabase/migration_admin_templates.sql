-- Migration: Admin-editable TRÆCK templates
-- Adds is_default flag to workout_templates so admin can create templates visible to all users.
-- Admin's templates have is_default=true and are readable by everyone.

-- 1. Add is_default column
ALTER TABLE workout_templates ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- 2. Drop existing RLS policy (may vary by name)
DROP POLICY IF EXISTS "Users can manage own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can read own and default templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON workout_templates;

-- 3. New policies: everyone reads default templates, only owner can write
CREATE POLICY "Users can read own and default templates"
  ON workout_templates FOR SELECT
  USING (user_id = auth.uid() OR is_default = true);

CREATE POLICY "Users can insert own templates"
  ON workout_templates FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own templates"
  ON workout_templates FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own templates"
  ON workout_templates FOR DELETE
  USING (user_id = auth.uid());

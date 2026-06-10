-- Restrict Realtime broadcast/presence channel access.
-- This app currently only uses postgres_changes on public.lyric_lines (governed by that table's RLS).
-- We add a default-deny posture on realtime.messages and only allow authenticated users
-- to subscribe to topics namespaced with their own auth.uid().
CREATE POLICY "Authenticated users access only own-topic channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE (auth.uid()::text || ':%')
  OR realtime.topic() = auth.uid()::text
);

CREATE POLICY "Authenticated users broadcast only on own-topic channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE (auth.uid()::text || ':%')
  OR realtime.topic() = auth.uid()::text
);
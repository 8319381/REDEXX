DO $$
BEGIN
  -- если constraint уже есть, просто выходим
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('buyer','logistician','admin'));
END $$;

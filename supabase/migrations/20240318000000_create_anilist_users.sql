-- Create anilist_users table
CREATE TABLE IF NOT EXISTS public.anilist_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    anilist_id bigint UNIQUE NOT NULL,
    username text NOT NULL,
    avatar_url text,
    access_token text NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create RLS policies
ALTER TABLE public.anilist_users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own data
CREATE POLICY "Users can read their own data"
    ON public.anilist_users
    FOR SELECT
    USING (auth.uid() = id);

-- Create policy to allow users to insert their own data
CREATE POLICY "Users can insert their own data"
    ON public.anilist_users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Create policy to allow users to update their own data
CREATE POLICY "Users can update their own data"
    ON public.anilist_users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.anilist_users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at(); 
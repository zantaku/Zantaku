-- Create user_streaks table
CREATE TABLE IF NOT EXISTS public.user_streaks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    anilist_id bigint UNIQUE NOT NULL,
    last_active timestamp with time zone NOT NULL,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    type text DEFAULT 'none' NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create RLS policies
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.user_streaks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create policy to allow users to read their own data
CREATE POLICY "Users can read their own data"
    ON public.user_streaks
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own data
CREATE POLICY "Users can insert their own data"
    ON public.user_streaks
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own data
CREATE POLICY "Users can update their own data"
    ON public.user_streaks
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX user_streaks_anilist_id_idx ON public.user_streaks(anilist_id);
CREATE INDEX user_streaks_user_id_idx ON public.user_streaks(user_id); 
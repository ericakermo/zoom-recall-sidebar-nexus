-- Create zoom_connections table
CREATE TABLE IF NOT EXISTS zoom_connections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create RLS policies
ALTER TABLE zoom_connections ENABLE ROW LEVEL SECURITY;

-- Users can only read their own zoom connection
CREATE POLICY "Users can view own zoom connection"
    ON zoom_connections FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only insert their own zoom connection
CREATE POLICY "Users can insert own zoom connection"
    ON zoom_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only update their own zoom connection
CREATE POLICY "Users can update own zoom connection"
    ON zoom_connections FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own zoom connection
CREATE POLICY "Users can delete own zoom connection"
    ON zoom_connections FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at
CREATE TRIGGER update_zoom_connections_updated_at
    BEFORE UPDATE ON zoom_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 
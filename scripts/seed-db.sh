#!/bin/bash
# Seed database with sample data

echo "🌱 Seeding database..."

# Connect to PostgreSQL and insert sample data
docker exec -i fund-my-cause-postgres psql -U fundmycause -d fundmycause << 'SQL'
-- Insert sample users
INSERT INTO users (id, email, name, role) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice Johnson', 'user'),
    ('22222222-2222-2222-2222-222222222222', 'bob@example.com', 'Bob Smith', 'user'),
    ('33333333-3333-3333-3333-333333333333', 'charlie@example.com', 'Charlie Brown', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert sample campaigns
INSERT INTO campaigns (id, user_id, title, description, goal_amount, raised_amount, status) VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 
     'Clean Water Initiative', 'Providing clean water to communities in need', 10000.00, 2500.00, 'active'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222',
     'Education for All', 'Building schools in underserved areas', 15000.00, 8000.00, 'active'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
     'Food Bank Support', 'Providing meals to families in need', 5000.00, 1200.00, 'active')
ON CONFLICT DO NOTHING;

-- Insert sample donations
INSERT INTO donations (id, campaign_id, user_id, amount, status) VALUES 
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 500.00, 'completed'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 1000.00, 'completed'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 2000.00, 'completed')
ON CONFLICT DO NOTHING;

SELECT '✅ Database seeded successfully!' as message;
SQL

echo "✅ Seeding complete!"

-- Migration: Add payment columns to tenants table
-- Run this in Supabase SQL Editor

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_customer_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

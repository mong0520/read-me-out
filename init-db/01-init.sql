-- 創建資料庫（如果不存在）
CREATE DATABASE read_me_out;

-- 切換到新資料庫
\c read_me_out;

-- 創建擴展（如果需要）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
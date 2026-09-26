<?php
// Isolated local test database, never the development or production database.
return [
    'app_url'=>'http://127.0.0.1:8080',
    'db_dsn'=>'mysql:host=db-test;dbname=musicians_test;charset=utf8mb4',
    'db_user'=>'musicians','db_password'=>'local-test-only',
    'admin_password_hash'=>password_hash('test-password',PASSWORD_DEFAULT),
    'discord_application_id'=>'100000000000000001',
    'discord_guild_id'=>'100000000000000002',
    'discord_member_role_id'=>'100000000000000003',
    'discord_operator_role_id'=>'100000000000000004',
    'discord_bot_token'=>'','discord_audit_channel_id'=>'',
];

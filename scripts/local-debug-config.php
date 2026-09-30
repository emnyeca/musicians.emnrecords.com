<?php
// Local debug environment only (docker compose --profile debug). Never packaged or deployed.
// Every value is local: the disposable db-debug container, a loopback URL and dummy Discord IDs.
// The admin password is "local-debug". Discord is never contacted: member lookups are stubbed
// by local-debug-router.php and the empty audit channel disables notifications.
return [
    'app_url' => 'http://127.0.0.1:8081',
    'db_dsn' => 'mysql:host=db-debug;dbname=musicians_debug;charset=utf8mb4',
    'db_user' => 'musicians',
    'db_password' => 'local-debug-only',
    'admin_password_hash' => '$2y$10$NQdIylZTWuwdgsy5UsuVpOD8JZn1AGBuhQ5e6v.GVcT1sPL6hSdz2',
    'icon_storage_dir' => '/tmp/musicians-debug-icons',
    'discord_application_id' => '100000000000000001',
    'discord_public_key' => '',
    'discord_guild_id' => '100000000000000002',
    'discord_member_role_id' => '100000000000000003',
    'discord_operator_role_id' => '100000000000000004',
    'discord_bot_token' => 'local-debug-stub',
    'discord_audit_channel_id' => '',
];

<?php
// Copy outside public_html as musicians-private/config.php. Never upload secrets into out/.
return [
    'app_url' => 'https://musicians.emnrecords.com',
    'db_dsn' => 'mysql:host=YOUR_DB_HOST;dbname=YOUR_DB_NAME;charset=utf8mb4',
    'db_user' => 'YOUR_DB_USER',
    'db_password' => '',
    // Generate with: php -r "echo password_hash(readline('Password: '), PASSWORD_DEFAULT), PHP_EOL;"
    'admin_password_hash' => '',
    'discord_application_id' => '',
    'discord_public_key' => '',
    'discord_guild_id' => '',
    'discord_member_role_id' => '',
    'discord_operator_role_id' => '',
    'discord_bot_token' => '',
    'discord_audit_channel_id' => '',
];

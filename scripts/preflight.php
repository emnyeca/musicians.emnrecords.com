<?php
declare(strict_types=1);
$runtime=is_file(__DIR__.'/../server/bootstrap.php')?__DIR__.'/../server':__DIR__.'/../musicians-private';
require $runtime.'/bootstrap.php';
$ok=true;
foreach (['PHP 8.3+'=>version_compare(PHP_VERSION,'8.3','>='),'pdo_mysql'=>extension_loaded('pdo_mysql'),'mbstring'=>extension_loaded('mbstring'),'sodium'=>extension_loaded('sodium'),'curl'=>extension_loaded('curl')] as $label=>$pass) {
    echo ($pass?'OK ':'FAIL ').$label."\n"; $ok=$ok && $pass;
}
try {
    $c=config(); db();
    foreach (['musicians','musician_representatives','profile_update_sessions','musician_audit_logs','rate_limits','member_web_access'] as $table) query('SELECT 1 FROM '.$table.' LIMIT 1');
    $triggers=query("SHOW TRIGGERS WHERE `Table`='musician_audit_logs'")->fetchAll();
    $names=array_column($triggers,'Trigger');
    $audit=in_array('audit_no_update',$names,true) && in_array('audit_no_delete',$names,true);
    echo ($audit?'OK ':'FAIL ')."MySQL schema and audit triggers\n"; $ok=$ok && $audit;
    foreach (['app_url','admin_password_hash','discord_application_id','discord_public_key','discord_guild_id','discord_member_role_id','discord_operator_role_id','discord_bot_token','discord_audit_channel_id'] as $key) {
        $set=!empty($c[$key]); echo ($set?'OK ':'MISSING ').$key."\n"; $ok=$ok && $set;
    }
} catch (Throwable) { echo "FAIL database/configuration (credentials are not printed)\n"; $ok=false; }
echo "Read-only checks only. HTTPS signature/PING and response timing require the deployed web endpoint.\n";
exit($ok?0:1);

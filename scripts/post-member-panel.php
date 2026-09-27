<?php
declare(strict_types=1);
$runtime=is_file(__DIR__.'/../server/bootstrap.php')?__DIR__.'/../server':__DIR__.'/../musicians-private';
foreach (['bootstrap','profile','discord','member'] as $file) require $runtime.'/'.$file.'.php';
$channel=$argv[1] ?? '';
if (!preg_match('/^\d{17,20}$/D',$channel)) { fwrite(STDERR,"Usage: php post-member-panel.php CHANNEL_ID [--apply]\n"); exit(1); }
$message=member_entry_message();
echo 'Channel: '.$channel."\n".json($message)."\n";
if (!in_array('--apply',$argv,true)) { echo "Dry run only. Review the channel and message before --apply.\n"; exit; }
query('SELECT 1 FROM member_web_access LIMIT 1');
$target=discord_get('/channels/'.$channel);
if (($target['guild_id'] ?? '')!==(config()['discord_guild_id'] ?? '') || ($target['type'] ?? null)!==0) {
    fwrite(STDERR,"Choose a text channel in the configured guild.\n"); exit(1);
}
if (!discord_request('POST','/channels/'.$channel.'/messages',$message,true,15000)) exit(1);
echo "Member panel posted. Pin the message in Discord.\n";

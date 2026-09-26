<?php
declare(strict_types=1);
$runtime=is_file(__DIR__.'/../server/bootstrap.php')?__DIR__.'/../server':__DIR__.'/../musicians-private';
require $runtime.'/bootstrap.php';
require $runtime.'/discord.php';
$commands=json_decode(file_get_contents(__DIR__.'/discord-commands.json'),true,32,JSON_THROW_ON_ERROR);
if (!in_array('--apply',$argv,true)) {
    echo json($commands)."\nDry run only. Use --apply after reviewing the guild and commands.\n";
    exit;
}
$c=config();
foreach (['discord_application_id','discord_guild_id','discord_bot_token'] as $key) if (empty($c[$key])) { fwrite(STDERR,"Discord configuration is incomplete.\n"); exit(1); }
if (!discord_request('PUT','/applications/'.rawurlencode($c['discord_application_id']).'/guilds/'.rawurlencode($c['discord_guild_id']).'/commands',$commands,true,15000)) exit(1);
echo "Guild commands registered.\n";

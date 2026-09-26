<?php
declare(strict_types=1);
$runtime=is_file(__DIR__.'/../server/bootstrap.php')?__DIR__.'/../server':__DIR__.'/../musicians-private';
require $runtime.'/bootstrap.php';
require $runtime.'/profile.php';

$apply=in_array('--apply',$argv,true);
$rows=query("SELECT m.*,r.discord_user_id,
 (SELECT MAX(a.created_at) FROM musician_audit_logs a WHERE a.musician_id=m.id AND a.actor_kind='self' AND a.action IN ('profile_confirmed','profile_update') AND a.result='succeeded') confirmed_at
 FROM musicians m LEFT JOIN musician_representatives r ON r.musician_id=m.id WHERE m.visibility='draft' ORDER BY m.slug")->fetchAll();
$ready=[];
foreach ($rows as $row) {
    $profile=json_decode($row['profile'],true,32,JSON_THROW_ON_ERROR);
    $reasons=[];
    if (!$row['discord_user_id']) $reasons[]='代表者なし';
    if (!$row['confirmed_at'] || strtotime($row['confirmed_at'].' UTC') < strtotime($row['updated_at'].' UTC')) $reasons[]='本人確認なし/確認後に変更あり';
    if ($row['is_locked']) $reasons[]='ロック中';
    foreach (['display_name'=>'表示名','name_jp'=>'日本語名','name_en'=>'英語名'] as $key=>$label) if (trim((string)($profile[$key] ?? ''))==='') $reasons[]=$label.'なし';
    if (empty($profile['roles']) || !is_array($profile['roles'])) $reasons[]='役割なし';
    echo ($reasons?'HOLD ':'READY').$row['slug'].' '.($reasons?implode(' / ',$reasons):'')."\n";
    if (!$reasons) $ready[]=$row;
}
echo 'Drafts: '.count($rows).' / ready: '.count($ready)."\n";
if (!$apply) { echo "Dry run only. Re-run with --apply after the announced deadline and review.\n"; exit; }

transaction(function() use ($ready) {
    foreach ($ready as $row) {
        $m=musician($row['id'],true); $before=snapshot($m);
        query("UPDATE musicians SET visibility='public',version=version+1 WHERE id=? AND visibility='draft'",[$m['id']]);
        $after=musician($m['id']);
        audit($m['id'],null,'system','deadline_publish',$before,snapshot($after),null);
    }
});
echo count($ready)." confirmed drafts published.\n";

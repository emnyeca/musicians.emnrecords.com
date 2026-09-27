<?php
declare(strict_types=1);
$runtime=is_file(__DIR__.'/../server/bootstrap.php')?__DIR__.'/../server':__DIR__.'/../musicians-private';
foreach (['bootstrap','profile','discord'] as $file) require $runtime.'/'.$file.'.php';
$apply=in_array('--apply',$argv,true);
$rows=query('SELECT m.*,r.discord_user_id FROM musicians m JOIN musician_representatives r ON r.musician_id=m.id ORDER BY m.slug')->fetchAll();
$plans=[]; $held=0;
foreach ($rows as $row) {
    $profile=json_decode($row['profile'],true,32,JSON_THROW_ON_ERROR);
    if (isset($profile['vanity_roles_imported_at'])) { echo 'SKIP '.$row['slug']." already imported\n"; continue; }
    if ($row['is_locked']) { echo 'HOLD '.$row['slug']." locked\n"; $held++; continue; }
    try { $member=discord_get('/guilds/'.config()['discord_guild_id'].'/members/'.$row['discord_user_id']); }
    catch (RequestError $e) {
        if ($e->reason!=='discord_not_found') throw $e; // Abort before writing when Discord is unavailable.
        echo 'HOLD '.$row['slug']." not in guild\n"; $held++; continue;
    }
    $defaults=vanity_defaults($member['roles'] ?? []);
    $roles=normalize_roles(array_merge($profile['roles'] ?? [],$defaults['roles']));
    if (count($roles)>30) { echo 'HOLD '.$row['slug']." too many roles\n"; $held++; continue; }
    $plans[]=[$row,$roles,$defaults['directoryCategories']];
    echo 'UPDATE '.$row['slug'].' | '.implode(', ',$roles).' | '.implode(', ',$defaults['directoryCategories']).PHP_EOL;
    usleep(150000);
}
echo 'Ready: '.count($plans).' / held: '.$held.PHP_EOL;
if (!$apply) { echo "Dry run only. Use --apply after review. Existing primary roles and visibility are preserved.\n"; exit; }
transaction(function() use ($plans) {
    foreach ($plans as [$row,$roles,$categories]) {
        $m=musician($row['id'],true);
        $user=query('SELECT discord_user_id FROM musician_representatives WHERE musician_id=? FOR UPDATE',[$m['id']])->fetchColumn();
        if ((int)$m['version']!==(int)$row['version'] || $m['is_locked'] || $user!==$row['discord_user_id']) throw new RequestError('version_conflict',409);
        $before=snapshot($m);
        $m['profile']['roles']=$roles; $m['profile']['directory_categories']=$categories;
        $m['profile']['vanity_roles_imported_at']=gmdate('c'); $m['version']++;
        query('UPDATE musicians SET profile=?,version=? WHERE id=?',[json($m['profile']),$m['version'],$m['id']]);
        query('UPDATE profile_update_sessions SET consumed_at=COALESCE(consumed_at,UTC_TIMESTAMP()) WHERE musician_id=?',[$m['id']]);
        audit($m['id'],null,'system','vanity_roles_import',$before,snapshot($m),null);
    }
});
echo count($plans)." profiles updated. Re-running skips imported profiles.\n";

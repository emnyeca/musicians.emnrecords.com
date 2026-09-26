<?php
declare(strict_types=1);
$runtime=is_file(__DIR__.'/../server/bootstrap.php')?__DIR__.'/../server':__DIR__.'/../musicians-private';
require $runtime.'/bootstrap.php'; require $runtime.'/profile.php';
$apply=in_array('--apply',$argv,true);
$rows=query("SELECT * FROM musicians WHERE slug LIKE 'office-%' ORDER BY slug")->fetchAll();
$plan=[]; $targets=[];
foreach ($rows as $row) {
    $new=substr($row['slug'],7);
    if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$new)) throw new RuntimeException('Invalid target slug: '.$new);
    if (isset($targets[$new])) throw new RuntimeException('Duplicate target slug: '.$new);
    $owner=query('SELECT id FROM musicians WHERE slug=? AND id<>?',[$new,$row['id']])->fetchColumn();
    if ($owner) throw new RuntimeException('Target slug already exists: '.$new);
    $targets[$new]=true; $plan[]=[$row['id'],$row['slug'],$new];
}
echo 'Slug changes: '.count($plan)."\n";
foreach ($plan as [$id,$old,$new]) echo $old.' -> '.$new."\n";
if (!$apply) { echo "Dry run only. Re-run with --apply after reviewing the list.\n"; exit; }
transaction(function() use ($plan) {
    foreach ($plan as [$id,$old,$new]) {
        $m=musician($id,true); $before=snapshot($m);
        query('UPDATE musicians SET slug=?,version=version+1 WHERE id=?',[$new,$id]);
        $m=musician($id); audit($id,null,'system','slug_migration',$before,snapshot($m),null);
    }
});
echo "Slug migration completed.\n";

<?php
declare(strict_types=1);

$runtime=is_file(__DIR__.'/../server/bootstrap.php')?__DIR__.'/../server':__DIR__.'/../musicians-private';
require $runtime.'/bootstrap.php';
require $runtime.'/profile.php';

function slug_text(string $value): string {
    $value=strtolower(trim($value));
    $value=preg_replace('/[^a-z0-9]+/','-',$value) ?? '';
    return trim($value,'-');
}

function slug_from_url(string $url): string {
    $parts=parse_url(trim($url));
    if (!is_array($parts)) return '';
    $host=strtolower((string)($parts['host'] ?? ''));
    $host=preg_replace('/^www\./','',$host) ?? $host;
    $segments=array_values(array_filter(explode('/',trim((string)($parts['path'] ?? ''),'/'))));
    if (in_array($host,['x.com','twitter.com','instagram.com','tiktok.com','github.com','soundcloud.com','linktr.ee'],true)) {
        return slug_text(ltrim((string)($segments[0] ?? ''),'@'));
    }
    if (in_array($host,['youtube.com','m.youtube.com'],true) && isset($segments[0])) {
        return slug_text(ltrim($segments[0],'@'));
    }
    if ($host !== '') {
        $labels=explode('.',$host);
        return slug_text($labels[0] ?? '');
    }
    return '';
}

function meaningful_slug(array $profile): string {
    $urls=[];
    foreach (['primary_sns_url','website_url'] as $key) if (!empty($profile[$key])) $urls[]=(string)$profile[$key];
    foreach (($profile['links'] ?? []) as $link) if (!empty($link['url'])) $urls[]=(string)$link['url'];
    foreach (array_unique($urls) as $url) {
        $slug=slug_from_url($url);
        if ($slug !== '') return $slug;
    }
    return '';
}

$apply=in_array('--apply',$argv,true);
$rows=query("SELECT * FROM musicians WHERE slug LIKE 'office-%' ORDER BY slug")->fetchAll();
$plan=[]; $holds=[]; $targets=[];
foreach ($rows as $row) {
    $old=(string)$row['slug'];
    $remainder=substr($old,7);
    $profile=json_decode((string)$row['profile'],true,512,JSON_THROW_ON_ERROR);
    $new=str_starts_with($remainder,'person-') ? meaningful_slug($profile) : $remainder;
    $name=(string)($profile['display_name'] ?? $profile['name_jp'] ?? $old);
    if ($new === '') {
        $holds[]=[$old,$name,'SNS・Web URLからslugを作れません'];
        continue;
    }
    if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$new)) {
        $holds[]=[$old,$name,'生成されたslugが不正: '.$new];
        continue;
    }
    $owner=query('SELECT id FROM musicians WHERE slug=? AND id<>?',[$new,$row['id']])->fetchColumn();
    if (isset($targets[$new]) || $owner) {
        $holds[]=[$old,$name,'slugが重複: '.$new];
        continue;
    }
    $targets[$new]=true;
    $plan[]=[$row['id'],$old,$new,$name];
}

echo 'Slug changes: '.count($plan)."\n";
foreach ($plan as [$id,$old,$new,$name]) echo $old.' -> '.$new.' | '.$name."\n";
echo 'Held for review: '.count($holds)."\n";
foreach ($holds as [$old,$name,$reason]) echo 'HOLD '.$old.' | '.$name.' | '.$reason."\n";
if (!$apply) { echo "Dry run only. Re-run with --apply after reviewing the list.\n"; exit; }

transaction(function() use ($plan) {
    foreach ($plan as [$id,$old,$new,$name]) {
        $m=musician($id,true); $before=snapshot($m);
        query('UPDATE musicians SET slug=?,version=version+1 WHERE id=?',[$new,$id]);
        $m=musician($id); audit($id,null,'system','slug_migration',$before,snapshot($m),null);
    }
});
echo 'Slug migration completed. Held records were not changed: '.count($holds)."\n";

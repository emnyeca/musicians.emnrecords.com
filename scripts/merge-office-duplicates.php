<?php
declare(strict_types=1);
$runtime=is_file(__DIR__.'/../server/bootstrap.php')?__DIR__.'/../server':__DIR__.'/../musicians-private';
require $runtime.'/bootstrap.php';
require $runtime.'/profile.php';

$path=$argv[1] ?? ''; $apply=in_array('--apply',$argv,true);
if ($path==='' || !is_file($path)) { fwrite(STDERR,"Usage: php merge-office-duplicates.php people.json [--apply]\n"); exit(1); }
$people=json_decode(file_get_contents($path),true,64,JSON_THROW_ON_ERROR);

function values(array $person,string $key): array {
    $value=$person[$key] ?? [];
    if (!is_array($value)) $value=[$value];
    return array_values(array_unique(array_filter(array_map(fn($v)=>is_string($v)?trim($v):'', $value))));
}
function urls(array $person): array { return array_values(array_unique(array_merge(values($person,'primary_sns_url'),values($person,'sns_urls')))); }
function latest(array $person): string {
    $dates=[]; foreach (($person['source_posts'] ?? []) as $post) if (is_array($post) && is_string($post['post_date'] ?? null)) $dates[]=$post['post_date'];
    rsort($dates); return $dates[0] ?? '';
}
function safe_url(mixed $value): string { try { return is_string($value)&&trim($value)!==''?url_value($value,true):''; } catch (RequestError) { return ''; } }
function merged_slug(string $url,array $people): string {
    $path=trim((string)parse_url($url,PHP_URL_PATH),'/');
    $base=$path!==''?explode('/',$path)[0]:(string)($people[0]['person_id'] ?? 'person');
    $base=trim(preg_replace('/[^a-z0-9]+/','-',strtolower($base)),'-');
    return 'office-'.($base!==''?$base:substr(hash('sha256',$url),0,12));
}

$byUrl=[];
foreach ($people as $index=>$person) foreach (urls($person) as $url) $byUrl[strtolower(rtrim($url,'/'))][$index]=true;
$adj=[];
foreach ($byUrl as $url=>$indexes) {
    $indexes=array_keys($indexes); if (count($indexes)<2) continue;
    foreach ($indexes as $left) foreach ($indexes as $right) if ($left!==$right) $adj[$left][$right]=true;
}
$groups=[]; $visited=[];
foreach (array_keys($adj) as $start) {
    if (isset($visited[$start])) continue;
    $stack=[$start]; $component=[];
    while ($stack) {
        $index=array_pop($stack); if (isset($visited[$index])) continue;
        $visited[$index]=true; $component[]=$index;
        foreach (array_keys($adj[$index] ?? []) as $next) if (!isset($visited[$next])) $stack[]=$next;
    }
    if (count($component)<2) continue;
    $identityUrl='';
    foreach ($byUrl as $url=>$owners) if (count(array_intersect($component,array_keys($owners)))>1) { $identityUrl=$url; break; }
    $groups[]=['url'=>$identityUrl,'people'=>array_map(fn($i)=>$people[$i],$component)];
}

$plan=[];
foreach ($groups as $group) {
    $members=$group['people']; usort($members,fn($a,$b)=>strcmp(latest($b),latest($a)));
    $names=array_values(array_unique(array_map(fn($p)=>trim((string)$p['display_name']),$members)));
    $display=$names[0];
    $jp=''; $en='';
    foreach ($names as $name) {
        $parts=preg_split('/\s*[\/｜]\s*/u',$name);
        foreach ($parts as $part) {
            if ($jp==='' && preg_match('/[^\x00-\x7F]/u',$part)) $jp=$part;
            if ($en==='' && !preg_match('/[^\x00-\x7F]/u',$part)) $en=$part;
        }
    }
    if ($jp==='') $jp=$display;
    $aliases=$names;
    foreach ($members as $member) $aliases=array_merge($aliases,values($member,'aliases'));
    $aliases=array_values(array_unique(array_filter($aliases,fn($v)=>$v!==$display)));
    $roles=[]; $allUrls=[]; $icon=''; $sources=[];
    foreach ($members as $member) {
        $sources[]=(string)$member['person_id'];
        $roles=array_merge($roles,values($member,'default_role'),values($member,'roles_seen'));
        $allUrls=array_merge($allUrls,urls($member));
        if ($icon==='') $icon=safe_url($member['icon_url'] ?? '');
    }
    $roles=array_values(array_unique(array_filter($roles))); $allUrls=array_values(array_unique(array_filter(array_map('safe_url',$allUrls))));
    $links=[]; foreach ($allUrls as $order=>$url) $links[]=['id'=>uuid(),'url'=>$url,'platform'=>platform($url),'label'=>'','display_order'=>$order+1,'is_public'=>true];
    $slug=merged_slug($group['url'],$members);
    $englishNameOverrides=['office-nicole-kotone'=>'Kotone Nicole'];
    if (isset($englishNameOverrides[$slug])) $en=$englishNameOverrides[$slug];
    $profile=['display_name'=>$display,'name_jp'=>$jp,'name_en'=>$en,'roles'=>$roles,'primary_sns_url'=>safe_url($group['url']),'website_url'=>'','icon_image_url'=>$icon,'vrc_name'=>'','aliases'=>$aliases,'canonical_name'=>'','sort_name'=>'','discord_name'=>'','links'=>$links,'source_office_person_ids'=>$sources];
    $existing=query('SELECT id FROM musicians WHERE slug=?',[$slug])->fetchColumn();
    $plan[]=['slug'=>$slug,'profile'=>$profile,'sources'=>$sources,'existing'=>(bool)$existing];
}

echo 'Merge groups: '.count($plan)."\n";
foreach ($plan as $item) echo ($item['existing']?'SKIP ':'MERGE ').$item['slug'].' => '.$item['profile']['display_name'].' | nameJp='.$item['profile']['name_jp'].' | nameEn='.($item['profile']['name_en']?:'(要確認)').' | aliases='.implode(', ',$item['profile']['aliases'])."\n";
if (!$apply) { echo "Dry run only. Re-run with --apply after reviewing the merged names.\n"; exit; }
transaction(function() use ($plan) {
    foreach ($plan as $item) {
        if ($item['existing']) continue;
        $id=uuid(); query('INSERT INTO musicians (id,slug,profile,visibility,is_verified) VALUES (?,?,?,?,0)',[$id,$item['slug'],json($item['profile']),'draft']);
        $m=musician($id); audit($id,null,'system','office_import_merged',null,snapshot($m),null);
    }
});
echo "Merged Office drafts imported.\n";

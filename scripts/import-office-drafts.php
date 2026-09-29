<?php
declare(strict_types=1);
$runtime=is_file(__DIR__.'/../server/bootstrap.php')?__DIR__.'/../server':__DIR__.'/../musicians-private';
require $runtime.'/bootstrap.php';
require $runtime.'/profile.php';

$path=$argv[1] ?? '';
$apply=in_array('--apply',$argv,true);
if ($path==='' || !is_file($path)) { fwrite(STDERR,"Usage: php import-office-drafts.php people.json [--apply]\n"); exit(1); }
$people=json_decode(file_get_contents($path),true,64,JSON_THROW_ON_ERROR);
if (!is_array($people) || !array_is_list($people)) { fwrite(STDERR,"Office data must be a JSON array.\n"); exit(1); }

function office_slug(string $id): string {
    $slug=trim(preg_replace('/[^a-z0-9]+/','-',strtolower($id)),'-');
    if ($slug==='' || strlen($slug)>93) throw new RuntimeException('Invalid Office person_id');
    return 'office-'.$slug;
}
function strings(mixed $value): array {
    if (!is_array($value)) return [];
    return array_values(array_unique(array_filter(array_map(fn($v)=>is_string($v)?trim($v):'', $value))));
}
function office_url(mixed $value, string $label, array &$warnings): string {
    if (!is_string($value) || trim($value)==='') return '';
    try { return url_value($value,true); }
    catch (RequestError) { $warnings[]=$label.' は無効なURLのため除外'; return ''; }
}

$seen=[]; $plan=[]; $warningCount=0;
foreach ($people as $index=>$person) {
    if (!is_array($person)) throw new RuntimeException("Invalid person at index $index");
    $source=text_value($person['person_id'] ?? '',100,true);
    $slug=office_slug($source);
    if (isset($seen[$source]) || isset($seen[$slug])) throw new RuntimeException("Duplicate Office identity: $source");
    $seen[$source]=$seen[$slug]=true;
    $name=text_value($person['display_name'] ?? '',80,true);
    $roles=array_values(array_unique(array_filter(array_merge(
        [is_string($person['default_role'] ?? null)?trim($person['default_role']):''],
        strings($person['roles_seen'] ?? [])
    ))));
    $links=[]; $warnings=[];
    foreach (strings($person['sns_urls'] ?? []) as $order=>$url) {
        $url=office_url($url,$name.' のSNS URL',$warnings);
        if ($url==='') continue;
        $links[]=['id'=>uuid(),'url'=>$url,'platform'=>platform($url),'label'=>'','display_order'=>$order+1,'is_public'=>true];
    }
    $primary=office_url($person['primary_sns_url'] ?? '',$name.' の主SNS URL',$warnings);
    $icon=office_url($person['icon_url'] ?? '',$name.' のアイコンURL',$warnings);
    $profile=[
        'display_name'=>$name,'name_jp'=>$name,'name_en'=>'','roles'=>$roles,
        'primary_sns_url'=>$primary,'website_url'=>'','icon_image_url'=>$icon,'vrc_name'=>'',
        'aliases'=>array_values(array_filter(strings($person['aliases'] ?? []),fn($v)=>$v!==$name)),
        'canonical_name'=>'','sort_name'=>'','discord_name'=>'','links'=>$links,
        'source_office_person_id'=>$source,
    ];
    $existing=query("SELECT id,slug FROM musicians WHERE JSON_UNQUOTE(JSON_EXTRACT(profile,'$.source_office_person_id'))=? OR slug=?",[$source,$slug])->fetch();
    $warningCount+=count($warnings);
    $identityUrls=array_values(array_unique(array_filter(array_merge([$primary],array_column($links,'url')))));
    $plan[]=['source'=>$source,'slug'=>$slug,'name'=>$name,'profile'=>$profile,'existing'=>$existing?:null,'warnings'=>$warnings,'identity_urls'=>$identityUrls,'hold'=>false];
}

$urlOwners=[];
foreach ($plan as $index=>$p) foreach ($p['identity_urls'] as $url) $urlOwners[$url][]=$index;
foreach ($urlOwners as $url=>$owners) {
    $owners=array_values(array_unique($owners));
    if (count($owners)<2) continue;
    $names=implode(', ',array_map(fn($index)=>$plan[$index]['name'].' ['.$plan[$index]['source'].']',$owners));
    foreach ($owners as $index) {
        $plan[$index]['hold']=true;
        $plan[$index]['warnings'][]='同じSNS URLを使う別候補あり: '.$names;
        $warningCount++;
    }
}
$new=count(array_filter($plan,fn($p)=>$p['existing']===null && !$p['hold']));
$holds=count(array_filter($plan,fn($p)=>$p['hold']));
$existingCount=count(array_filter($plan,fn($p)=>$p['existing']!==null));
echo 'Office people: '.count($plan)."\nNew drafts: $new\nHeld for duplicate review: $holds\nAlready imported: $existingCount\nWarnings: $warningCount\n";
foreach ($plan as $p) {
    echo ($p['existing']?'SKIP ':($p['hold']?'HOLD ':'ADD  ')).$p['slug'].' '.$p['name']."\n";
    foreach ($p['warnings'] as $warning) echo '  WARN '.$warning."\n";
}
if (!$apply) { echo "Dry run only. Re-run with --apply after reviewing this list.\n"; exit; }

transaction(function() use ($plan) {
    foreach ($plan as $p) {
        if ($p['existing'] || $p['hold']) continue;
        $id=uuid();
        query('INSERT INTO musicians (id,slug,profile,visibility) VALUES (?,?,?,?)',[$id,$p['slug'],json($p['profile']),'draft']);
        $m=musician($id);
        audit($id,null,'system','office_import',null,snapshot($m),null);
    }
});
echo "Office drafts imported.\n";

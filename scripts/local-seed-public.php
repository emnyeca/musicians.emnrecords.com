<?php
// Local debug only: copies the public directory (the same data any visitor sees at
// /api/musicians) into the disposable debug DB. Nothing is sent to production.
declare(strict_types=1);
putenv('MUSICIANS_CONFIG='.__DIR__.'/local-debug-config.php');
foreach (['bootstrap','profile'] as $file) require __DIR__.'/../server/'.$file.'.php';
if (!preg_match('~^http://127\.0\.0\.1:\d+$~D',rtrim(config()['app_url'],'/'))) { fwrite(STDERR,"Refusing: not the local debug configuration.\n"); exit(1); }

$source=$argv[1] ?? 'https://musicians.emnrecords.com/api/musicians';
$raw=file_get_contents($source,false,stream_context_create(['http'=>['timeout'=>15,'header'=>"Accept: application/json\r\n"]]));
if ($raw===false) { fwrite(STDERR,"Could not read $source\n"); exit(1); }
$list=json_decode($raw,true,64,JSON_THROW_ON_ERROR)['musicians'] ?? [];
$fields=['displayName'=>'display_name','nameJp'=>'name_jp','nameEn'=>'name_en','canonicalName'=>'canonical_name','sortName'=>'sort_name','primarySnsUrl'=>'primary_sns_url','websiteUrl'=>'website_url','iconImageUrl'=>'icon_image_url','vrcName'=>'vrc_name','discordName'=>'discord_name','roles'=>'roles','roleChoices'=>'role_choices','otherRole'=>'other_role','directoryCategories'=>'directory_categories','aliases'=>'aliases'];
$count=0;
foreach ($list as $m) {
    $profile=[];
    foreach ($fields as $api=>$db) $profile[$db]=$m[$api] ?? null;
    $profile['links']=array_map(fn($l)=>['id'=>$l['id'],'url'=>$l['url'],'platform'=>$l['platform'],'label'=>$l['label'] ?? '','display_order'=>$l['displayOrder'],'is_public'=>true],$m['links'] ?? []);
    query("INSERT INTO musicians (id,slug,profile,visibility) VALUES (?,?,?,'public') ON DUPLICATE KEY UPDATE slug=VALUES(slug),profile=VALUES(profile),visibility='public',version=version+1",[$m['id'],$m['slug'],json($profile)]);
    $count++;
}
echo "Copied $count public profiles from $source into the local debug DB.\n";

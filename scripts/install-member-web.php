<?php
declare(strict_types=1);
$runtime=is_file(__DIR__.'/../server/bootstrap.php')?__DIR__.'/../server':__DIR__.'/../musicians-private';
require $runtime.'/bootstrap.php';
$source=is_file(__DIR__.'/../sql/002_member_web_access.sql')?__DIR__.'/../sql/002_member_web_access.sql':__DIR__.'/002_member_web_access.sql';
$sql=file_get_contents($source);
if ($sql===false) throw new RuntimeException('Migration file missing');
if (!in_array('--apply',$argv,true)) { echo $sql."\nDry run only. Use --apply to add the member access table. Existing profiles are not changed.\n"; exit; }
db()->exec($sql);
echo "Member web access table is ready.\n";

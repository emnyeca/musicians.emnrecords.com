<?php
declare(strict_types=1);
// Existing installations only: replaces is_verified with is_suspicious and lets a
// member's own erasure request remove that member's audit rows. Profiles are kept.
$runtime=is_file(__DIR__.'/../server/bootstrap.php')?__DIR__.'/../server':__DIR__.'/../musicians-private';
require $runtime.'/bootstrap.php';

$trigger="CREATE TRIGGER audit_delete_erasure_only BEFORE DELETE ON musician_audit_logs
 FOR EACH ROW BEGIN
  IF @emn_erase_musician_id IS NULL OR NOT (OLD.musician_id <=> @emn_erase_musician_id) THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit logs are append-only';
  END IF;
 END";
$column=fn(string $name)=>(bool)query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',['musicians',$name])->fetchColumn();
$steps=[];
// Create the replacement trigger first: if trigger creation is not permitted, nothing
// else runs, the old unconditional trigger stays and audit rows remain protected.
$triggers=array_column(query("SHOW TRIGGERS WHERE `Table`='musician_audit_logs'")->fetchAll(),'Trigger');
if (!in_array('audit_delete_erasure_only',$triggers,true)) $steps[]=$trigger;
if (in_array('audit_no_delete',$triggers,true)) $steps[]='DROP TRIGGER audit_no_delete';
if (!$column('is_suspicious')) $steps[]='ALTER TABLE musicians ADD COLUMN is_suspicious BOOLEAN NOT NULL DEFAULT FALSE AFTER visibility';
if ($column('is_verified')) $steps[]='ALTER TABLE musicians DROP COLUMN is_verified';

if (!$steps) { echo "Already up to date.\n"; exit; }
echo implode(";\n\n",$steps).";\n\n";
if (!in_array('--apply',$argv,true)) { echo "Dry run only. Use --apply to run the statements above. Profile contents are not changed.\n"; exit; }
foreach ($steps as $sql) db()->exec($sql);
echo "Suspicious flag and erasure trigger are ready.\n";

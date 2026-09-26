<?php
// Replaces the former TypeScript interaction/route/store security tests.
declare(strict_types=1);
putenv('MUSICIANS_CONFIG='.__DIR__.'/config.php');
foreach (['bootstrap','profile','store','discord','http'] as $file) require __DIR__.'/../server/'.$file.'.php';
$count=0;
function check(bool $ok, string $label): void {
    global $count;
    if (!$ok) throw new RuntimeException('FAIL: '.$label);
    $count++;
}
function rejects(callable $work, string $code): void {
    try { $work(); } catch (RequestError $e) { check($e->reason===$code,$code.' (actual '.$e->reason.')'); return; }
    throw new RuntimeException('Expected rejection: '.$code);
}
function interaction(string $command='emn-profile', string $action='edit', array $roles=['100000000000000003']): array {
    return ['type'=>2,'id'=>(string)random_int(100000000000000000,999999999999999999),'application_id'=>'100000000000000001','guild_id'=>'100000000000000002','member'=>['user'=>['id'=>'100000000000000005'],'roles'=>$roles],'data'=>['name'=>$command,'options'=>[['name'=>$action]]]];
}

$keys=sodium_crypto_sign_keypair(); $public=bin2hex(sodium_crypto_sign_publickey($keys));
$raw='{"type":1}'; $stamp=(string)time(); $sig=bin2hex(sodium_crypto_sign_detached($stamp.$raw,sodium_crypto_sign_secretkey($keys)));
check(verify_signature($raw,$sig,$stamp,$public),'valid signature');
check(!verify_signature($raw.' ',$sig,$stamp,$public),'tampered signature');
check(!verify_signature($raw,$sig,(string)(time()-301),$public),'expired signature');
check(!verify_signature($raw,'bad',$stamp,$public),'malformed signature');
$i=interaction(); $actor=authorize($i); check($actor['user']==='100000000000000005','member authorized');
$wrong=$i; $wrong['guild_id']='other'; rejects(fn()=>authorize($wrong),'wrong_guild');
rejects(fn()=>authorize(interaction('emn-profile','edit',[])),'missing_role');
rejects(fn()=>authorize(interaction('emn-admin')),'missing_operator_role');
rejects(fn()=>validate_fields(['visibility'=>'public']),'unknown_field');
rejects(fn()=>validate_fields(['display_name'=>str_repeat('x',81)]),'invalid_input');
rejects(fn()=>validate_fields(['primary_sns_url'=>'javascript:alert(1)']),'invalid_url');
rejects(fn()=>validate_fields(['primary_sns_url'=>'https://user:pass@example.com']),'invalid_url');
rejects(fn()=>validate_fields(['roles'=>[]]),'invalid_input');
rejects(fn()=>validate_payload(['fields'=>[],'link_ops'=>[['op'=>'delete','url'=>'https://example.com','visibility'=>'public']]]),'invalid_input');
rejects(fn()=>collect_inputs([['type'=>4,'custom_id'=>'x','value'=>'a'],['type'=>4,'custom_id'=>'x','value'=>'b']]),'invalid_input');
$input=['display_name'=>'テスト','name_jp'=>'テスト','name_en'=>'Test','roles'=>'Vocal, Guitar','primary_sns_url'=>'https://example.com'];
$validated=validate_fields($input); check($validated['roles']===['Vocal','Guitar'],'roles conversion');
check(modal('basic',null,$validated)['data']['components'][0]['type']===18,'label modal');
$_SERVER['HTTP_ORIGIN']='https://attacker.invalid'; rejects(fn()=>same_origin(),'forbidden_origin');
$_SERVER['HTTP_ORIGIN']='http://127.0.0.1:8080'; same_origin();

// This suite is pinned above to the disposable db-test service.
db();
$slug='test-'.bin2hex(random_bytes(6));
$m=create_musician(['slug'=>$slug,'displayName'=>'テスト','nameJp'=>'テスト','nameEn'=>'Test','roles'=>'Vocal','visibility'=>'public','links'=>'Example | https://example.com']);
$user=$actor['user'];
// Free this fixture user's previous assignment from an earlier run.
query('DELETE FROM musician_representatives WHERE discord_user_id=?',[$user]);
admin_mutation($m['id'],'representative-set',['user'=>$user],'100000000000000006',interaction()['id']);
$before=musician($m['id']);
$s=create_session($i,$user,'basic',$input,null);
check(musician($m['id'])['profile']===$before['profile'],'modal submit does not update profile');
check((int)musician($m['id'])['version']===(int)$before['version'],'modal submit does not increment version');
rejects(fn()=>create_session($i,$user,'basic',$input,null),'duplicate_interaction');
rejects(fn()=>confirm_session($s['id'],'100000000000000099',interaction()['id']),'session_invalid');
$confirmed=confirm_session($s['id'],$user,interaction()['id']);
check($confirmed['profile']['roles']===['Vocal','Guitar'],'confirm applies fields');
check((int)$confirmed['version']===(int)$before['version']+1,'confirm increments version once');
rejects(fn()=>confirm_session($s['id'],$user,interaction()['id']),'session_consumed');
$audit=query("SELECT * FROM musician_audit_logs WHERE musician_id=? AND action='profile_update'",[$m['id']])->fetch();
check($audit!==false,'profile mutation audited');
try { query('UPDATE musician_audit_logs SET action=? WHERE id=?',['tamper',$audit['id']]); throw new RuntimeException('audit update allowed'); } catch (PDOException) { check(true,'audit append-only'); }
$s=create_session(interaction(),$user,'basic',$input,null);
$new=create_session(interaction(),$user,'opt',['website_url'=>'https://example.net'],$s['id']);
rejects(fn()=>confirm_session($s['id'],$user,interaction()['id']),'session_consumed');
check(live_session($new['id'],$user)['validated_payload']['fields']['website_url']==='https://example.net','revision merges fields');
query('UPDATE musicians SET version=version+1 WHERE id=?',[$m['id']]);
rejects(fn()=>confirm_session($new['id'],$user,interaction()['id']),'version_conflict');
$s=create_session(interaction(),$user,'basic',$input,null);
query('UPDATE profile_update_sessions SET expires_at=? WHERE session_id=?',[gmdate('Y-m-d H:i:s',time()-1),$s['id']]);
rejects(fn()=>confirm_session($s['id'],$user,interaction()['id']),'session_expired');
$s=create_session(interaction(),$user,'basic',$input,null);
cancel_session($s['id'],$user);
rejects(fn()=>confirm_session($s['id'],$user,interaction()['id']),'session_consumed');
admin_mutation($m['id'],'profile-lock',[],$user,interaction()['id'],true);
rejects(fn()=>create_session(interaction(),$user,'basic',$input,null),'musician_locked');
$restored=admin_mutation($m['id'],'profile-restore',['audit_log'=>$audit['id'],'state'=>'before'],'100000000000000006',interaction()['id']);
check((bool)$restored['is_locked'],'restore preserves lock');
check($restored['profile']===$before['profile'],'restore content snapshot');
admin_mutation($m['id'],'profile-unlock',[],'100000000000000006',interaction()['id']);
$confirmedProfile=confirm_current_profile($user,interaction()['id']);
check($confirmedProfile['id']===$m['id'],'self confirmation returns own profile');
check((bool)query("SELECT id FROM musician_audit_logs WHERE musician_id=? AND action='profile_confirmed' AND actor_kind='self'",[$m['id']])->fetch(),'self confirmation audited');

// Force audit storage failure and prove profile + session both roll back.
$s=create_session(interaction(),$user,'basic',$input,null); $before=musician($m['id']);
try { confirm_session($s['id'],$user,str_repeat('9',81)); throw new RuntimeException('audit failure did not reject'); }
catch (PDOException) { check(musician($m['id'])['profile']===$before['profile'],'audit failure rolls back profile'); check(live_session($s['id'],$user)['consumed_at']===null,'audit failure rolls back session'); }
$withdrawn=admin_mutation($m['id'],'profile-withdraw',['confirm'=>true],$user,interaction()['id'],true);
check($withdrawn['visibility']==='hidden' && (bool)$withdrawn['is_locked'],'withdrawal hides and locks');
rejects(fn()=>admin_mutation($m['id'],'profile-withdraw',['confirm'=>false],$user,interaction()['id'],true),'invalid_input');
admin_mutation($m['id'],'representative-revoke',[],'100000000000000006',interaction()['id']);
rejects(fn()=>own_musician($user),'representative_missing');
rejects(fn()=>confirm_session($s['id'],$user,interaction()['id']),'session_consumed');
$public=public_musician(musician($m['id']));
check(!isset($public['version']) && !isset($public['is_locked']) && !isset($public['locked_reason']),'public projection excludes internal fields');
$private=musician($m['id']); $private['profile']['links'][0]['is_public']=false;
check(public_musician($private)['links']===[],'private links excluded');
$mutationId=interaction()['id'];
admin_mutation($m['id'],'profile-hide',[],'100000000000000006',$mutationId);
rejects(fn()=>admin_mutation($m['id'],'profile-show',[],'100000000000000006',$mutationId),'duplicate_interaction');
check(!query("SELECT id FROM musicians WHERE slug=? AND visibility='public'",[$slug])->fetch(),'hidden musician excluded');
$bucket=uuid(); rate_limit($bucket,1,60); rejects(fn()=>rate_limit($bucket,1,60),'rate_limited');
echo "Passed $count backend checks (signature, authorization, validation, transaction, audit, visibility).\n";

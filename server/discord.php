<?php
declare(strict_types=1);

function verify_signature(string $raw, string $signature, string $timestamp, string $publicKey): bool {
    if (!preg_match('/^[a-f0-9]{128}$/Di',$signature) || !preg_match('/^[a-f0-9]{64}$/Di',$publicKey)
        || !ctype_digit($timestamp) || abs(time()-(int)$timestamp)>300) return false;
    return sodium_crypto_sign_verify_detached(hex2bin($signature),$timestamp.$raw,hex2bin($publicKey));
}

function authorize(array $i): array {
    $c = config();
    foreach (['discord_application_id','discord_guild_id','discord_member_role_id','discord_operator_role_id'] as $k) if (empty($c[$k])) throw new RequestError('service_not_configured',503);
    if (($i['guild_id'] ?? '') !== $c['discord_guild_id'] || ($i['application_id'] ?? '') !== $c['discord_application_id']) throw new RequestError('wrong_guild',403);
    $user = $i['member']['user']['id'] ?? '';
    $roles = $i['member']['roles'] ?? [];
    if (!is_string($user) || !preg_match('/^\d{17,20}$/D',$user) || !is_array($roles)) throw new RequestError('missing_role',403);
    $operator = in_array($c['discord_operator_role_id'],$roles,true);
    if (!$operator && !in_array($c['discord_member_role_id'],$roles,true)) throw new RequestError('missing_role',403);
    if (($i['data']['name'] ?? '') === 'emn-admin' && !$operator) throw new RequestError('missing_operator_role',403);
    return ['user'=>$user,'operator'=>$operator];
}

function message_data(string $content): array {
    return ['content'=>$content,'flags'=>64,'allowed_mentions'=>['parse'=>[]],'components'=>[],'embeds'=>[]];
}

function ephemeral(string $content): array { return ['type'=>4,'data'=>message_data($content)]; }

function modal(string $form, ?string $session, array $profile): array {
    $specs = match ($form) {
        'basic'=>[['display_name','表示名',80,true],['name_jp','日本語名',80,true],['name_en','英語名',80,true],['roles','担当（カンマ区切り）',800,true],['primary_sns_url','主SNS URL（空欄で削除）',300,false]],
        'opt'=>[['website_url','Web URL（空欄で削除）',300,false],['icon_image_url','アイコン画像URL（空欄で削除）',300,false],['vrc_name','VRChat名',80,false],['aliases','別名義（カンマ区切り）',800,false]],
        'link'=>[['url','リンクURL',300,true],['platform','platform（空欄で自動判定）',20,false],['label','表示ラベル',80,false],['display_order','表示順（0〜999）',3,false],['delete','削除する場合「削除」と入力',10,false]],
        default=>throw new RequestError('invalid_input'),
    };
    $components = [];
    foreach ($specs as [$key,$label,$max,$required]) {
        $value = $form==='link' ? '' : ($profile[$key] ?? '');
        if (is_array($value)) $value = implode(', ',$value);
        $input = ['type'=>4,'custom_id'=>$key,'style'=>1,'required'=>$required,'max_length'=>$max];
        if ($value !== '') $input['value'] = $value;
        $components[] = ['type'=>18,'label'=>$label,'component'=>$input];
    }
    return ['type'=>9,'data'=>['custom_id'=>$session?"pm:$form:s:$session":'pm:basic:new','title'=>'公開プロフィールの編集','components'=>$components]];
}

function collect_inputs(array $components, array &$inputs = []): array {
    foreach ($components as $c) {
        if (!is_array($c)) throw new RequestError('invalid_input');
        if (($c['type'] ?? null) === 4) {
            $key = $c['custom_id'] ?? '';
            if (!is_string($key) || $key==='' || array_key_exists($key,$inputs) || !is_string($c['value'] ?? null)) throw new RequestError('invalid_input');
            $inputs[$key] = $c['value'];
        } elseif (isset($c['component'])) collect_inputs([$c['component']],$inputs);
        elseif (isset($c['components'])) collect_inputs($c['components'],$inputs);
        else throw new RequestError('unknown_field');
    }
    return $inputs;
}

function discord_text(string $value): string {
    return str_replace(['\\','*','_','`','~','|','>','[',']'],['\\\\','\\*','\\_','\\`','\\~','\\|','\\>','\\[','\\]'],$value);
}

function profile_summary(array $p): string {
    $lines = [];
    foreach (['display_name'=>'表示名','name_jp'=>'日本語名','name_en'=>'英語名','roles'=>'担当','primary_sns_url'=>'主SNS','website_url'=>'Web','icon_image_url'=>'アイコンURL','vrc_name'=>'VRChat名','aliases'=>'別名義'] as $key=>$label) {
        $value = $p[$key] ?? '';
        if (is_array($value)) $value = implode(', ',$value);
        $lines[] = $label.': '.discord_text($value ?: '(未設定)');
    }
    foreach ($p['links'] ?? [] as $link) if ($link['is_public'] ?? false) $lines[] = discord_text(($link['label'] ?: $link['platform']).': '.$link['url']);
    return implode("\n",$lines);
}

function preview_data(array $session): array {
    $data = message_data('内容を確認し、[反映する]を押してください。有効期限は10分です。');
    // Two embeds keep every value visible, without truncating the confirmation.
    $summary = profile_summary($session['profile']);
    $chunks = [];
    $chunk = '';
    foreach (explode("\n",$summary) as $line) {
        if (mb_strlen($chunk."\n".$line,'UTF-8') > 3900) { $chunks[]=$chunk; $chunk=''; }
        $chunk .= ($chunk!==''?"\n":'').$line;
    }
    $chunks[]=$chunk;
    $data['embeds'] = array_map(fn($text)=>['description'=>$text],$chunks);
    $buttons = [];
    foreach ([['confirm','反映する',3],['revise','修正する',1],['opt','任意項目',2],['link','リンク',2],['cancel','キャンセル',4]] as [$action,$label,$style]) $buttons[] = ['type'=>2,'style'=>$style,'label'=>$label,'custom_id'=>"pv:$action:".$session['id']];
    $data['components'] = [['type'=>1,'components'=>$buttons]];
    return $data;
}

function parse_command(array $i): array {
    $sub = $i['data']['options'][0] ?? [];
    $options = [];
    foreach ($sub['options'] ?? [] as $o) $options[$o['name']] = $o['value'];
    return [$sub['name'] ?? '',$options];
}

function opens_modal(array $i): bool {
    if (($i['type'] ?? 0)===2) return ($i['data']['name'] ?? '')==='emn-profile' && parse_command($i)[0]==='edit';
    return ($i['type'] ?? 0)===3 && preg_match('/^pv:(revise|opt|link):[a-f0-9-]{36}$/D',$i['data']['custom_id'] ?? '')===1;
}

function handle_discord(array $i, array $actor): array {
    $user=$actor['user'];
    rate_limit('discord:'.$user,30,60);
    $type=$i['type'] ?? 0;
    if ($type===3 && ($i['data']['custom_id'] ?? '')==='member:open') return issue_member_link($i,$actor);
    if ($type===2) {
        [$action,$options]=parse_command($i);
        if (($i['data']['name'] ?? '')==='emn-admin') {
            if (!$actor['operator']) throw new RequestError('missing_operator_role');
            $key=text_value($options['musician'] ?? '',100,true);
            if ($action==='audit-list') {
                $m=musician($key);
                $logs=query('SELECT id,action,result,created_at FROM musician_audit_logs WHERE musician_id=? ORDER BY created_at DESC,id DESC LIMIT 10',[$m['id']])->fetchAll();
                return ephemeral($logs?implode("\n",array_map(fn($l)=>$l['id'].' '.$l['created_at'].' '.$l['action'].' ('.$l['result'].')',$logs)):'監査ログはまだありません。');
            }
            $m=admin_mutation($key,$action,$options,$user,$i['id']);
            notify_audit($action,$m,$user);
            return ephemeral('操作を反映しました: '.$m['slug'].' (version '.$m['version'].')');
        }
        if (($i['data']['name'] ?? '')!=='emn-profile') throw new RequestError('invalid_input');
        $m=own_musician($user);
        if ($action==='edit') { editable($m,$user); return modal('basic',null,$m['profile']); }
        if ($action==='view') {
            $data=preview_data(['id'=>uuid(),'profile'=>$m['profile']]);
            $data['content']='現在の登録内容: '.$m['visibility'].' / version '.$m['version'].($m['is_locked']?' / ロック中':'');
            $data['components']=[];
            return ['type'=>4,'data'=>$data];
        }
        if ($action==='confirm') {
            $m=confirm_current_profile($user,$i['id']);
            notify_audit('profile_confirmed',$m,$user);
            return ephemeral('現在の登録内容を確認済みとして記録しました。');
        }
        if ($action==='lock') {
            $m=admin_mutation($m['id'],'profile-lock',$options,$user,$i['id'],true);
            notify_audit('profile-lock',$m,$user);
            return ephemeral('ロックしました。解除は運営者へ依頼してください。');
        }
        throw new RequestError('invalid_input');
    }
    $custom=$i['data']['custom_id'] ?? '';
    if ($type===3 && preg_match('/^'.SUSPICIOUS_BUTTON.':([a-f0-9-]{36})$/D',$custom,$match)) {
        if (!$actor['operator']) throw new RequestError('missing_operator_role');
        $m=mark_suspicious($match[1],$user,$i['id']);
        mark_notification_handled($i,'→ 念のため非公開にして、本人の編集をロックしました（operator '.$user.'）');
        notify_audit('profile-suspicious',$m,$user);
        return ephemeral('念のため非公開にして、本人の編集をロックしました: '.$m['slug']."\n変更前に戻すとき: /emn-admin profile-restore musician:".$m['slug'].' audit_log:'.$match[1].' state:before'."\n問題がなければ、管理画面か /emn-admin profile-unlock でロックを解除できます。");
    }
    if ($type===5) {
        $previous=null; $form='basic';
        if ($custom!=='pm:basic:new') {
            if (!preg_match('/^pm:(basic|opt|link):s:([a-f0-9-]{36})$/D',$custom,$match)) throw new RequestError('invalid_input');
            $form=$match[1]; $previous=$match[2];
        }
        $session=create_session($i,$user,$form,collect_inputs($i['data']['components'] ?? []),$previous);
        return ['type'=>4,'data'=>preview_data($session)];
    }
    if ($type!==3 || !preg_match('/^pv:(confirm|cancel|revise|opt|link):([a-f0-9-]{36})$/D',$custom,$match)) throw new RequestError('invalid_input');
    [$unused,$action,$id]=$match;
    $s=live_session($id,$user);
    if ($action==='cancel') { cancel_session($id,$user); return ephemeral('キャンセルしました。変更は反映されていません。'); }
    if ($action==='confirm') {
        $m=confirm_session($id,$user,$i['id']);
        notify_audit('profile_update',$m,$user,$m['audit_id']);
        query('DELETE FROM profile_update_sessions WHERE expires_at < UTC_TIMESTAMP() LIMIT 1000');
        return ephemeral('反映しました (version '.$m['version'].')。公開名鑑に反映されます。');
    }
    $m=musician($s['musician_id']);
    editable($m,$user,(int)$s['base_version']);
    return modal($action==='revise'?'basic':$action,$id,merged_profile($m['profile'],$s['validated_payload']));
}

function discord_request(string $method, string $path, array $body, bool $bot = false, int $timeoutMs = 1800): bool {
    $ch=curl_init('https://discord.com/api/v10'.$path);
    $headers=['Content-Type: application/json'];
    if ($bot) $headers[]='Authorization: Bot '.config()['discord_bot_token'];
    curl_setopt_array($ch,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_POSTFIELDS=>json($body),CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT_MS=>800,CURLOPT_TIMEOUT_MS=>$timeoutMs]);
    $result=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE); curl_close($ch);
    if ($result===false || $status<200 || $status>=300) { error_log('musicians: Discord request failed (HTTP '.(int)$status.')'); return false; }
    return true;
}

function discord_get(string $path): array {
    $token=config()['discord_bot_token'] ?? '';
    if ($token==='') throw new RequestError('service_not_configured',503);
    $ch=curl_init('https://discord.com/api/v10'.$path);
    curl_setopt_array($ch,[CURLOPT_HTTPHEADER=>['Authorization: Bot '.$token],CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_CONNECTTIMEOUT_MS=>1000,CURLOPT_TIMEOUT_MS=>5000]);
    $raw=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE); curl_close($ch);
    if ($status===404) throw new RequestError('discord_not_found',404);
    if ($raw===false || $status!==200) throw new RequestError('discord_unavailable',503);
    try { $body=json_decode($raw,true,32,JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new RequestError('discord_unavailable',503); }
    if (!is_array($body)) throw new RequestError('discord_unavailable',503);
    return $body;
}

const SUSPICIOUS_BUTTON = 'audit:suspicious';

function diff_value(mixed $value): string {
    if (is_array($value)) $value = implode(', ',$value);
    if (is_bool($value)) $value = $value?'yes':'no';
    $value = trim((string)$value);
    if ($value==='') return '(未設定)';
    return discord_text(mb_strlen($value,'UTF-8')>300?mb_substr($value,0,300,'UTF-8').'…':$value);
}

// Only the changed fields; list fields show added/removed items, not whole lists.
// $before=null is a new record, so every filled field is the change.
function snapshot_diff(?array $before, array $after): string {
    $labels=['slug'=>'slug','visibility'=>'公開状態','is_locked'=>'ロック','is_suspicious'=>'不審フラグ','display_name'=>'表示名','name_jp'=>'日本語名','name_en'=>'英語名','roles'=>'担当','directory_categories'=>'活動区分','primary_sns_url'=>'主SNS','website_url'=>'Web','icon_image_url'=>'アイコン','vrc_name'=>'VRChat名','aliases'=>'別名義','links'=>'追加リンク'];
    $value=function(?array $s, string $key) {
        if ($s===null) return null;
        $v=array_key_exists($key,$s)?$s[$key]:($s['profile'][$key] ?? '');
        if ($key==='links') $v=array_map(fn($l)=>trim(($l['label'] ?? '').' '.($l['url'] ?? '')),$v ?: []);
        return $v;
    };
    $lines=[];
    foreach ($labels as $key=>$label) {
        $new=$value($after,$key); $old=$value($before,$key);
        if ($before===null) { if (diff_value($new)!=='(未設定)' && !in_array($key,['is_locked','is_suspicious'],true)) $lines[]=$label.': '.diff_value($new); continue; }
        if ($old===$new) continue;
        if (is_array($old) || is_array($new)) {
            $old=is_array($old)?$old:[]; $new=is_array($new)?$new:[];
            $added=array_diff($new,$old); $removed=array_diff($old,$new);
            $parts=array_merge(array_map(fn($v)=>'+'.diff_value($v),$added),array_map(fn($v)=>'−'.diff_value($v),$removed));
            if (!$parts) $parts[]='並び順を変更（先頭: '.diff_value($new[0] ?? '').'）';
            $lines[]=$label.': '.implode(' / ',$parts);
        } else $lines[]=$label.': '.diff_value($old).' → '.diff_value($new);
    }
    return implode("\n",$lines);
}

// $auditId is set for a member's own change; operators get a button to stop it.
function notify_audit(string $action, array $m, string $user, ?string $auditId = null): void {
    $c=config();
    if (empty($c['discord_bot_token']) || empty($c['discord_audit_channel_id'])) return;
    // The diff goes in the message text: embeds need the Embed Links permission,
    // which the audit channel does not grant. Discord caps content at 2000 characters.
    $content=$action.' / '.discord_text($m['slug']).' / actor '.$user.' / version '.$m['version'].' / '.$m['visibility'];
    if (array_key_exists('before',$m)) $content=rtrim($content."\n".snapshot_diff($m['before'],snapshot($m)));
    if (mb_strlen($content,'UTF-8')>1850) $content=mb_substr($content,0,1850,'UTF-8').'…';
    $body=['content'=>$content,'allowed_mentions'=>['parse'=>[]]];
    if ($auditId!==null) $body['components']=[['type'=>1,'components'=>[['type'=>2,'style'=>2,'label'=>'気になる変更ならこちら（非公開にしてロックします）','custom_id'=>SUSPICIOUS_BUTTON.':'.$auditId]]]];
    discord_request('POST','/channels/'.rawurlencode($c['discord_audit_channel_id']).'/messages',$body,true);
}

// Record the outcome on the shared notification and remove its button.
function mark_notification_handled(array $i, string $line): void {
    $channel=$i['channel_id'] ?? $i['message']['channel_id'] ?? ''; $message=$i['message']['id'] ?? '';
    if (!preg_match('/^\d{17,20}$/D',(string)$channel) || !preg_match('/^\d{17,20}$/D',(string)$message)) return;
    discord_request('PATCH','/channels/'.$channel.'/messages/'.$message,['content'=>mb_substr((string)($i['message']['content'] ?? ''),0,1900,'UTF-8')."\n".$line,'components'=>[],'allowed_mentions'=>['parse'=>[]]],true);
}

function discord_endpoint(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '')!=='POST') throw new RequestError('method_not_allowed',405);
    $raw=request_body();
    $key=config()['discord_public_key'] ?? '';
    if (!function_exists('sodium_crypto_sign_verify_detached') || !$key) throw new RequestError('service_not_configured',503);
    if (!verify_signature($raw,$_SERVER['HTTP_X_SIGNATURE_ED25519'] ?? '',$_SERVER['HTTP_X_SIGNATURE_TIMESTAMP'] ?? '',$key)) throw new RequestError('invalid_signature',401);
    $i=decode_body($raw);
    if (($i['type'] ?? 0)===1) { response(['type'=>1]); return; }
    try { $actor=authorize($i); }
    catch (RequestError $e) { failure_audit($i,$e->reason); response(ephemeral(error_text($e->reason))); return; }
    if (!is_string($i['id'] ?? null) || !preg_match('/^\d{17,20}$/D',$i['id']) || !is_string($i['token'] ?? null)) throw new RequestError('invalid_input');
    if (opens_modal($i)) {
        try { response(handle_discord($i,$actor)); }
        catch (Throwable $e) { $code=$e instanceof RequestError?$e->reason:'db_error'; failure_audit($i,$code); response(ephemeral(error_text($code))); }
        return;
    }
    // Acknowledge before database work. LSAPI/FPM can finish the HTTP response;
    // on other SAPIs use Discord's callback API, then return HTTP 202.
    // The shared entry message MUST NOT be edited with a personal bearer link, and
    // the shared audit notification is edited separately, only after success.
    $custom=$i['data']['custom_id'] ?? '';
    $shared=$i['type']===3 && ($custom==='member:open' || str_starts_with($custom,SUSPICIOUS_BUTTON.':'));
    $update=!$shared && ($i['type']===3 || ($i['type']===5 && isset($i['message'])));
    $defer=$update?['type'=>6]:['type'=>5,'data'=>['flags'=>64]];
    $finished=function_exists('litespeed_finish_request') || function_exists('fastcgi_finish_request');
    if ($finished) {
        ignore_user_abort(true);
        response($defer);
        if (function_exists('litespeed_finish_request')) litespeed_finish_request(); else fastcgi_finish_request();
    } else {
        if (!discord_request('POST','/interactions/'.rawurlencode($i['id']).'/'.rawurlencode($i['token']).'/callback',$defer)) { response(['error'=>'discord_unavailable'],503); return; }
        http_response_code(202);
    }
    try { $result=handle_discord($i,$actor); }
    catch (Throwable $e) { $code=$e instanceof RequestError?$e->reason:'db_error'; failure_audit($i,$code); $result=ephemeral(error_text($code)); }
    discord_request('PATCH','/webhooks/'.rawurlencode(config()['discord_application_id']).'/'.rawurlencode($i['token']).'/messages/@original',$result['data']);
}

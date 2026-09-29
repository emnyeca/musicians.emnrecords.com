<?php
declare(strict_types=1);

function live_session(string $id, string $user, bool $lock = false): array {
    $s = query('SELECT * FROM profile_update_sessions WHERE session_id=?' . ($lock?' FOR UPDATE':''), [$id])->fetch();
    if (!$s || $s['discord_user_id'] !== $user) throw new RequestError('session_invalid');
    if ($s['consumed_at']) throw new RequestError('session_consumed');
    if (strtotime($s['expires_at'].' UTC') <= time()) throw new RequestError('session_expired');
    $s['validated_payload'] = json_decode($s['validated_payload'], true, 32, JSON_THROW_ON_ERROR);
    return $s;
}

function editable(array $m, string $user, ?int $version = null): void {
    require_representative($m['id'], $user);
    if ($m['is_locked']) throw new RequestError('musician_locked');
    if ($version !== null && (int)$m['version'] !== $version) throw new RequestError('version_conflict');
}

function create_session(array $i, string $user, string $form, array $inputs, ?string $previous): array {
    $allowed = match ($form) { 'basic'=>BASIC_FIELDS, 'opt'=>OPTIONAL_FIELDS, 'link'=>LINK_FIELDS, default=>throw new RequestError('invalid_input') };
    if (array_diff(array_keys($inputs), $allowed) || strlen(json($inputs)) > 8000) throw new RequestError('unknown_field');
    if ($form === 'basic' && array_diff(BASIC_FIELDS, array_keys($inputs))) throw new RequestError('invalid_input');
    $payload = $form === 'link' ? ['fields'=>[], 'link_ops'=>[validate_link($inputs)]] : ['fields'=>validate_fields($inputs),'link_ops'=>[]];
    return transaction(function() use ($i,$user,$payload,$inputs,$previous) {
        // All mutations lock musician first, then session/representative rows.
        $base = $previous ? live_session($previous,$user) : null;
        $target = $base ? $base['musician_id'] : own_musician($user)['id'];
        $m = musician($target, true);
        editable($m,$user,$base ? (int)$base['base_version'] : null);
        if (query('SELECT session_id FROM profile_update_sessions WHERE discord_interaction_id=?', [$i['id']])->fetch()) throw new RequestError('duplicate_interaction');
        $merged = $payload;
        if ($base) {
            $base = live_session($previous,$user,true);
            $merged['fields'] = array_replace($base['validated_payload']['fields'], $payload['fields']);
            $ops = [];
            foreach (array_merge($base['validated_payload']['link_ops'], $payload['link_ops']) as $op) $ops[$op['url']] = $op;
            $merged['link_ops'] = array_values($ops);
            query('UPDATE profile_update_sessions SET consumed_at=UTC_TIMESTAMP() WHERE session_id=?', [$previous]);
        }
        $merged = validate_payload($merged);
        $preview = merged_profile($m['profile'], $merged);
        // Keep the complete confirmation preview within Discord's embed budget.
        if (mb_strlen(profile_summary($preview), 'UTF-8') > 5600) throw new RequestError('payload_too_large');
        $id = uuid();
        query('INSERT INTO profile_update_sessions (session_id,discord_interaction_id,discord_user_id,musician_id,base_version,submitted_payload,validated_payload,expires_at) VALUES (?,?,?,?,?,?,?,?)',
            [$id,$i['id'],$user,$m['id'],$m['version'],json($inputs),json($merged),gmdate('Y-m-d H:i:s',time()+600)]);
        return ['id'=>$id,'profile'=>$preview];
    });
}

function confirm_session(string $id, string $user, string $interaction): array {
    return transaction(function() use ($id,$user,$interaction) {
        $s = live_session($id,$user);
        $m = musician($s['musician_id'],true);
        $s = live_session($id,$user,true);
        ensure_new_interaction($interaction);
        editable($m,$user,(int)$s['base_version']);
        $before = snapshot($m);
        $m['profile'] = merged_profile($m['profile'], $s['validated_payload']);
        $m['version']++;
        query('UPDATE musicians SET profile=?,version=? WHERE id=?', [json($m['profile']),$m['version'],$m['id']]);
        query('UPDATE profile_update_sessions SET consumed_at=UTC_TIMESTAMP() WHERE session_id=?', [$id]);
        $m['audit_id'] = audit($m['id'],$user,'self','profile_update',$before,snapshot($m),$interaction);
        $m['before'] = $before;
        return $m;
    });
}

function cancel_session(string $id, string $user): void {
    query('UPDATE profile_update_sessions SET consumed_at=COALESCE(consumed_at,UTC_TIMESTAMP()) WHERE session_id=? AND discord_user_id=?', [$id,$user]);
}

function confirm_current_profile(string $user, string $interaction): array {
    return transaction(function() use ($user,$interaction) {
        $m = own_musician($user);
        $m = musician($m['id'],true);
        ensure_new_interaction($interaction);
        editable($m,$user);
        $state = snapshot($m);
        audit($m['id'],$user,'self','profile_confirmed',$state,$state,$interaction);
        return $m;
    });
}

function admin_mutation(string $key, string $action, array $options, string $actor, string $interaction, bool $self = false): array {
    return transaction(function() use ($key,$action,$options,$actor,$interaction,$self) {
        $m = musician($key,true);
        ensure_new_interaction($interaction);
        if ($self) {
            if ($action!=='profile-lock') throw new RequestError('missing_operator_role');
            require_representative($m['id'],$actor);
        }
        $before = snapshot($m);
        switch ($action) {
            case 'representative-set':
                $user = $options['user'] ?? '';
                if (!is_string($user) || !preg_match('/^\d{17,20}$/D',$user)) throw new RequestError('invalid_input');
                $before['representative'] = query('SELECT discord_user_id FROM musician_representatives WHERE musician_id=?',[$m['id']])->fetchColumn() ?: null;
                // Do not steal an assignment from a different musician.
                $other = query('SELECT musician_id FROM musician_representatives WHERE discord_user_id=?',[$user])->fetchColumn();
                if ($other && $other !== $m['id']) throw new RequestError('slug_conflict');
                query('DELETE FROM musician_representatives WHERE musician_id=?',[$m['id']]);
                query('INSERT INTO musician_representatives (musician_id,discord_user_id) VALUES (?,?)',[$m['id'],$user]);
                break;
            case 'representative-revoke':
                $before['representative'] = query('SELECT discord_user_id FROM musician_representatives WHERE musician_id=?',[$m['id']])->fetchColumn() ?: null;
                query('DELETE FROM musician_representatives WHERE musician_id=?',[$m['id']]);
                break;
            case 'profile-lock':
            case 'profile-unlock':
                $m['is_locked'] = $action==='profile-lock';
                query('UPDATE musicians SET is_locked=?,locked_at=?,locked_reason=? WHERE id=?', [(int)$m['is_locked'],$m['is_locked']?gmdate('Y-m-d H:i:s'):null,$m['is_locked']?(text_value($options['reason'] ?? '',200) ?: 'ロック申請'):null,$m['id']]);
                break;
            case 'profile-suspicious':
                $m['is_suspicious'] = true;
                $m['visibility'] = 'hidden';
                $m['is_locked'] = true;
                query('UPDATE musicians SET is_locked=1,locked_at=UTC_TIMESTAMP(),locked_reason=? WHERE id=?', ['不審な変更として運営が停止',$m['id']]);
                break;
            case 'profile-hide': $m['visibility']='hidden'; break;
            case 'profile-show': $m['visibility']='public'; break;
            case 'profile-restore':
                $state = $options['state'] ?? 'after';
                if (!in_array($state,['before','after'],true)) throw new RequestError('invalid_input');
                $log = query('SELECT before_snapshot,after_snapshot FROM musician_audit_logs WHERE id=? AND musician_id=? AND result=?', [$options['audit_log'] ?? '',$m['id'],'succeeded'])->fetch();
                $saved = $log ? json_decode($log[$state.'_snapshot'] ?? 'null',true) : null;
                if (!is_array($saved['profile'] ?? null)) throw new RequestError('snapshot_not_restorable');
                // Restore content/visibility only; preserve current lock, suspicious flag and representative.
                $m['profile'] = $saved['profile'];
                validate_fields(array_intersect_key($m['profile'],array_flip(array_merge(BASIC_FIELDS,OPTIONAL_FIELDS))));
                $m['visibility'] = $saved['visibility'];
                break;
            default: throw new RequestError('invalid_input');
        }
        $m['version']++;
        query('UPDATE musicians SET profile=?,visibility=?,is_suspicious=?,version=? WHERE id=?',[json($m['profile']),$m['visibility'],(int)$m['is_suspicious'],$m['version'],$m['id']]);
        // All administrative changes invalidate outstanding previews, including reassignment.
        query('UPDATE profile_update_sessions SET consumed_at=COALESCE(consumed_at,UTC_TIMESTAMP()) WHERE musician_id=?',[$m['id']]);
        $after = snapshot($m);
        if (str_starts_with($action,'representative-')) $after['representative'] = $options['user'] ?? null;
        if ($action==='profile-suspicious') $after['reported_audit_log'] = $options['audit_log'] ?? null;
        $m['before'] = $before;
        audit($m['id'],$actor,$self?'self':'operator',$action,$before,$after,$interaction);
        return $m;
    });
}

// Operator button on a self-change notification in the audit channel.
function mark_suspicious(string $auditLogId, string $actor, string $interaction): array {
    $id = query("SELECT musician_id FROM musician_audit_logs WHERE id=? AND actor_kind='self' AND result='succeeded' AND musician_id IS NOT NULL",[$auditLogId])->fetchColumn();
    if (!$id) throw new RequestError('musician_not_found',404);
    return admin_mutation($id,'profile-suspicious',['audit_log'=>$auditLogId],$actor,$interaction);
}

function create_musician(array $input): array {
    $mapping = ['displayName'=>'display_name','nameJp'=>'name_jp','nameEn'=>'name_en','roles'=>'roles','primarySnsUrl'=>'primary_sns_url','websiteUrl'=>'website_url','iconImageUrl'=>'icon_image_url','vrcName'=>'vrc_name','aliases'=>'aliases'];
    $allowed = array_merge(array_keys($mapping),['slug','canonicalName','sortName','discordName','visibility','links','directoryCategories','roleChoices','otherRole']);
    if (array_diff(array_keys($input),$allowed)) throw new RequestError('unknown_field');
    $fields = [];
    foreach ($mapping as $camel=>$snake) $fields[$snake] = $input[$camel] ?? '';
    $profile = validate_fields($fields);
    if (isset($input['roleChoices'])) {
        $profile['roles']=selected_roles(['roles'=>$input['roleChoices'],'otherRole'=>$input['otherRole'] ?? '']);
        $profile['role_choices']=array_values(array_unique($input['roleChoices']));
        $profile['other_role']=text_value($input['otherRole'] ?? '',40);
    }
    $profile['directory_categories'] = directory_categories($input['directoryCategories'] ?? ['musician']);
    foreach (['canonicalName'=>'canonical_name','sortName'=>'sort_name','discordName'=>'discord_name'] as $camel=>$snake) $profile[$snake] = text_value($input[$camel] ?? '');
    $slug = text_value($input['slug'] ?? '',100) ?: trim(preg_replace('/[^a-z0-9]+/','-',strtolower($profile['name_en'])),'-');
    if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$slug)) throw new RequestError('invalid_input');
    $visibility = $input['visibility'] ?? 'draft';
    if (!in_array($visibility,['draft','public','hidden'],true)) throw new RequestError('invalid_input');
    $links = [];
    foreach (preg_split('/\r?\n/',text_value($input['links'] ?? '',4000)) as $line) {
        if (trim($line)==='') continue;
        $parts = array_map('trim',explode('|',$line,2));
        $links[] = validate_link(['url'=>end($parts),'label'=>count($parts)>1?$parts[0]:'','display_order'=>(string)count($links)]);
    }
    $profile = merged_profile($profile,['fields'=>[],'link_ops'=>$links]);
    if (mb_strlen(profile_summary($profile),'UTF-8') > 5600) throw new RequestError('payload_too_large');
    return transaction(function() use ($slug,$profile,$visibility) {
        $id = uuid();
        query('INSERT INTO musicians (id,slug,profile,visibility) VALUES (?,?,?,?)',[$id,$slug,json($profile),$visibility]);
        $m = musician($id);
        audit($id,null,'operator','create',null,snapshot($m),null);
        return $m;
    });
}

function update_musician(string $key, array $input): array {
    $mapping=['displayName'=>'display_name','nameJp'=>'name_jp','nameEn'=>'name_en','roles'=>'roles','primarySnsUrl'=>'primary_sns_url','websiteUrl'=>'website_url','iconImageUrl'=>'icon_image_url','vrcName'=>'vrc_name','aliases'=>'aliases'];
    $allowed=array_merge(array_keys($mapping),['slug','canonicalName','sortName','discordName','visibility','isSuspicious','isLocked','links','version','representativeDiscordUserId','directoryCategories','roleChoices','otherRole']);
    if (array_diff(array_keys($input),$allowed)) throw new RequestError('unknown_field');
    if (!is_int($input['version'] ?? null) || !is_bool($input['isSuspicious'] ?? null) || !is_bool($input['isLocked'] ?? null)) throw new RequestError('invalid_input');
    $visibility=$input['visibility'] ?? '';
    if (!in_array($visibility,['draft','public','hidden'],true)) throw new RequestError('invalid_input');
    return transaction(function() use ($key,$input,$mapping,$visibility) {
        $m=musician($key,true);
        if ((int)$m['version']!==$input['version']) throw new RequestError('version_conflict',409);
        $slug=text_value($input['slug'] ?? '',100,true);
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$slug)) throw new RequestError('invalid_input');
        $slugOwner=query('SELECT id FROM musicians WHERE slug=?',[$slug])->fetchColumn();
        if ($slugOwner && $slugOwner!==$m['id']) throw new RequestError('slug_conflict',409);
        $representative=text_value($input['representativeDiscordUserId'] ?? '',20);
        if ($representative!=='' && !preg_match('/^\d{17,20}$/D',$representative)) throw new RequestError('invalid_input');
        $fields=[]; foreach ($mapping as $camel=>$snake) $fields[$snake]=$input[$camel] ?? '';
        $fields=validate_fields($fields);
        if (isset($input['roleChoices'])) {
            $fields['roles']=selected_roles(['roles'=>$input['roleChoices'],'otherRole'=>$input['otherRole'] ?? '']);
            $fields['role_choices']=array_values(array_unique($input['roleChoices']));
            $fields['other_role']=text_value($input['otherRole'] ?? '',40);
        } else { $fields['role_choices']=null; $fields['other_role']=''; }
        $fields['directory_categories']=directory_categories($input['directoryCategories'] ?? $m['profile']['directory_categories'] ?? ['musician']);
        foreach (['canonicalName'=>'canonical_name','sortName'=>'sort_name','discordName'=>'discord_name'] as $camel=>$snake) $fields[$snake]=text_value($input[$camel] ?? '');
        $links=[];
        foreach (preg_split('/\r?\n/',text_value($input['links'] ?? '',4000)) as $line) {
            if (trim($line)==='') continue;
            $parts=array_map('trim',explode('|',$line,2));
            $op=validate_link(['url'=>end($parts),'label'=>count($parts)>1?$parts[0]:'','display_order'=>(string)count($links)]);
            $links[]=['id'=>uuid(),'url'=>$op['url'],'platform'=>$op['platform'],'label'=>$op['label'],'display_order'=>$op['display_order'],'is_public'=>true];
        }
        $before=snapshot($m);
        $before['representative']=query('SELECT discord_user_id FROM musician_representatives WHERE musician_id=?',[$m['id']])->fetchColumn() ?: null;
        if ($representative!=='') {
            $other=query('SELECT musician_id FROM musician_representatives WHERE discord_user_id=?',[$representative])->fetchColumn();
            if ($other && $other!==$m['id']) throw new RequestError('slug_conflict',409);
        }
        query('DELETE FROM musician_representatives WHERE musician_id=?',[$m['id']]);
        if ($representative!=='') query('INSERT INTO musician_representatives (musician_id,discord_user_id) VALUES (?,?)',[$m['id'],$representative]);
        $m['profile']=array_replace($m['profile'],$fields,['links'=>$links]);
        if (mb_strlen(profile_summary($m['profile']),'UTF-8')>5600) throw new RequestError('payload_too_large');
        $m['slug']=$slug; $m['visibility']=$visibility; $m['is_suspicious']=$input['isSuspicious']; $m['version']++;
        query('UPDATE musicians SET slug=?,profile=?,visibility=?,is_suspicious=?,version=? WHERE id=?',[$m['slug'],json($m['profile']),$m['visibility'],(int)$m['is_suspicious'],$m['version'],$m['id']]);
        if ($input['isLocked']!==(bool)$m['is_locked']) {
            $m['is_locked']=$input['isLocked'];
            query('UPDATE musicians SET is_locked=?,locked_at=?,locked_reason=? WHERE id=?',[(int)$m['is_locked'],$m['is_locked']?gmdate('Y-m-d H:i:s'):null,$m['is_locked']?'運営によるロック':null,$m['id']]);
        }
        query('UPDATE profile_update_sessions SET consumed_at=COALESCE(consumed_at,UTC_TIMESTAMP()) WHERE musician_id=?',[$m['id']]);
        $after=snapshot($m); $after['representative']=$representative?:null;
        audit($m['id'],null,'operator','admin_update',$before,$after,null);
        return $m;
    });
}

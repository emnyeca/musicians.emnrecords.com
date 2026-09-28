<?php
declare(strict_types=1);
function role_catalog(): array {
    static $catalog;
    return $catalog ??= json_decode(file_get_contents(__DIR__.'/role-catalog.json'),true,32,JSON_THROW_ON_ERROR);
}
function canonical_role(string $role): string {
    $catalog=role_catalog(); $key=strtolower(trim($role));
    foreach ($catalog['groups'] as $group) foreach ($group as $name) if (strtolower($name)===$key) return $name;
    return $catalog['aliases'][$key] ?? trim($role);
}
function normalize_roles(array $roles): array {
    return array_values(array_unique(array_map('canonical_role',$roles)));
}
function role_tags(array $roles): array {
    $known=array_merge(...array_values(role_catalog()['groups']));
    return array_values(array_unique(array_map(fn($r)=>in_array(canonical_role($r),$known,true)?canonical_role($r):'Other',$roles)));
}
function selected_roles(array $input): array {
    $roles=list_value($input['roles'] ?? [],40,true,30);
    $known=array_merge(...array_values(role_catalog()['groups']));
    if (array_diff($roles,$known)) throw new RequestError('invalid_input');
    $other=text_value($input['otherRole'] ?? '',40);
    if (in_array('Other',$roles,true) && $other!=='') $roles=array_map(fn($r)=>$r==='Other'?$other:$r,$roles);
    return array_values(array_unique($roles));
}
function vanity_defaults(array $discordRoles): array {
    $roles=[];
    foreach (role_catalog()['vanity'] as $id=>$role) if (in_array((string)$id,$discordRoles,true)) $roles[]=$role;
    return ['roles'=>$roles,'directoryCategories'=>[in_array('Musician',$roles,true)?'musician':'creator/staff']];
}

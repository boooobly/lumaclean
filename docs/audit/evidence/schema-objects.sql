WITH objects AS (
 SELECT 'function'::text kind,p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' name,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')
 UNION ALL SELECT 'trigger',c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid,true)||':'||t.tgenabled::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
 UNION ALL SELECT 'enum',t.typname,string_agg(e.enumlabel,'|' ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' GROUP BY t.typname
 UNION ALL SELECT 'constraint',r.relname||'.'||c.conname,pg_get_constraintdef(c.oid,true)||':'||c.convalidated FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'view',c.relname,pg_get_viewdef(c.oid,true) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m')
 UNION ALL SELECT 'policy',tablename||'.'||policyname,cmd||':'||roles::text||':'||coalesce(qual,'')||':'||coalesce(with_check,'') FROM pg_policies WHERE schemaname='public'
) SELECT kind,name,md5(replace(definition,E'\r\n',E'\n')) definition_hash FROM objects ORDER BY kind,name

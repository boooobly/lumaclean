import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import applied from '../../docs/audit/evidence/deployed-migrations.json';

test('all 25 deployed migration SQL files retain the exact applied bytes',()=>{
  assert.equal(applied.length,25);
  for(const row of applied){
    const bytes=readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.checksum,row.migration_name);
  }
});

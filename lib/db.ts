import { Db } from '../types';
import * as postgresDB from './dbs/postgres';

// PostgreSQL (Neon) is the only supported database. The firebase and mysql
// implementations inherited from the original sample app were removed; the
// production data has lived in Postgres since the students' migration.
const db: Db = postgresDB;

export default db;

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

const { Pool } = pg;

export let pool: any = null;
export let db: any = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
} else {
  console.warn(
    "\x1b[33m%s\x1b[0m",
    "WARNING: DATABASE_URL is not set. Kinectra is running with an IN-MEMORY database fallback (with file persistence)."
  );

  const dbFilePath = path.join(process.cwd(), ".kinectra_db.json");
  let memorySessions: any[] = [];
  let memoryUsers: any[] = [];

  const loadMemoryDb = () => {
    try {
      if (fs.existsSync(dbFilePath)) {
        const data = JSON.parse(fs.readFileSync(dbFilePath, "utf-8"));
        memorySessions = data.sessions || [];
        memoryUsers = data.users || [];
        memorySessions.forEach((s: any) => {
          if (s.createdAt) s.createdAt = new Date(s.createdAt);
        });
        memoryUsers.forEach((u: any) => {
          if (u.createdAt) u.createdAt = new Date(u.createdAt);
        });
      }
    } catch (e) {
      console.error("Failed to load persistent mock DB:", e);
    }
  };

  const saveMemoryDb = () => {
    try {
      fs.writeFileSync(dbFilePath, JSON.stringify({ sessions: memorySessions, users: memoryUsers }, null, 2));
    } catch (e) {
      console.error("Failed to save persistent mock DB:", e);
    }
  };

  loadMemoryDb();

  const extractValueFromCondition = (cond: any): any => {
    if (!cond) return undefined;
    if (typeof cond === "string") return cond;
    if (typeof cond === "object") {
      if (Array.isArray(cond.queryChunks)) {
        for (const chunk of cond.queryChunks) {
          if (chunk && typeof chunk === "object" && "value" in chunk) {
            if (typeof chunk.value === "string") {
              return chunk.value;
            }
          }
        }
      }
      if ("value" in cond && typeof cond.value === "string") return cond.value;
      if ("right" in cond) {
        if (typeof cond.right === "object" && cond.right !== null && "value" in cond.right) {
          if (typeof cond.right.value === "string") return cond.right.value;
        }
        if (typeof cond.right === "string") return cond.right;
      }
      for (const key of Object.keys(cond)) {
        const val = cond[key];
        if (typeof val === "string") return val;
        if (typeof val === "object" && val !== null) {
          const subVal = extractValueFromCondition(val);
          if (subVal) return subVal;
        }
      }
    }
    return undefined;
  };

  class MockInsert {
    private valuesObj: any;
    constructor(private table: any) {}
    values(obj: any) {
      this.valuesObj = obj;
      return this;
    }
    then(resolve: any) {
      const record = {
        ...this.valuesObj,
        createdAt: new Date(),
      };
      const tableName = (this.table as any)?.[Symbol.for("drizzle:Name")] || 
                        (this.table as any)?.[Symbol.for("drizzle:OriginalName")] || 
                        (this.table as any)?._?.name || 
                        "";
      if (tableName === "users") {
        memoryUsers.push(record);
      } else {
        memorySessions.push(record);
      }
      saveMemoryDb();
      resolve([record]);
    }
  }

  class MockSelect {
    private fromTable: any;
    private whereCondition: any;
    private limitCount: number = 20;
    private order: any;

    from(table: any) {
      this.fromTable = table;
      return this;
    }
    where(condition: any) {
      this.whereCondition = condition;
      return this;
    }
    limit(n: number) {
      this.limitCount = n;
      return this;
    }
    orderBy(order: any) {
      this.order = order;
      return this;
    }
    then(resolve: any) {
      const tableName = (this.fromTable as any)?.[Symbol.for("drizzle:Name")] || 
                        (this.fromTable as any)?.[Symbol.for("drizzle:OriginalName")] || 
                        (this.fromTable as any)?._?.name || 
                        "";
      let result = tableName === "users" ? [...memoryUsers] : [...memorySessions];
      if (this.whereCondition) {
        const targetId = extractValueFromCondition(this.whereCondition);
        if (targetId) {
          result = result.filter((item) => {
            return Object.values(item).some(val => 
              typeof val === "string" && val.toLowerCase() === targetId.toLowerCase()
            );
          });
        }
      }
      if (tableName !== "users") {
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      result = result.slice(0, this.limitCount);
      resolve(result);
    }
  }

  class MockUpdate {
    private setObj: any;
    private whereCondition: any;
    constructor(private table: any) {}
    set(obj: any) {
      this.setObj = obj;
      return this;
    }
    where(condition: any) {
      this.whereCondition = condition;
      return this;
    }
    then(resolve: any) {
      if (this.whereCondition) {
        const targetId = extractValueFromCondition(this.whereCondition);
        if (targetId) {
          const tableName = (this.table as any)?.[Symbol.for("drizzle:Name")] || 
                            (this.table as any)?.[Symbol.for("drizzle:OriginalName")] || 
                            (this.table as any)?._?.name || 
                            "";
          if (tableName === "users") {
            const index = memoryUsers.findIndex((u) => u.id === targetId || u.username.toLowerCase() === targetId.toLowerCase());
            if (index !== -1) {
              memoryUsers[index] = {
                ...memoryUsers[index],
                ...this.setObj,
              };
            }
          } else {
            const index = memorySessions.findIndex((s) => s.id === targetId);
            if (index !== -1) {
              memorySessions[index] = {
                ...memorySessions[index],
                ...this.setObj,
              };
            }
          }
        }
      }
      saveMemoryDb();
      resolve();
    }
  }

  db = {
    insert: (table: any) => new MockInsert(table),
    select: () => new MockSelect(),
    update: (table: any) => new MockUpdate(table),
  };
}

export * from "./schema";

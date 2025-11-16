import fs from "fs";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection({
  host: "astroappdb2.mysql.database.azure.com",
  port: 3306,
  user: "master",
  password: "4YU2c7@@v2zUUdQxJ",       // <- fill in
  database: "astroapp_db",
  ssl: { rejectUnauthorized: false } // TLS; for strict verify, provide { ca: fs.readFileSync("/path/ca.pem") }
});

const table = "your_table";
const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
fs.writeFileSync(`${table}.json`, JSON.stringify(rows, null, 2));
await conn.end();
console.log(`Wrote ${table}.json`);
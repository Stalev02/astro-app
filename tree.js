import fs from "fs";
import path from "path";

const EXCLUDE_DIRS = ["node_modules", ".git", "build", "dist", ".vscode", "coverage", "__pycache__"];
const MAX_DEPTH = 3; // adjust as needed (2–3 is usually enough)

function printTree(dir, indent = "", depth = 0) {
  if (depth > MAX_DEPTH) return;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    // Skip excluded folders
    if (stat.isDirectory() && EXCLUDE_DIRS.includes(file)) continue;

    if (stat.isDirectory()) {
      console.log(indent + "📁 " + file);
      printTree(fullPath, indent + "  ", depth + 1);
    } else {
      console.log(indent + "📄 " + file);
    }
  }
}

printTree(".");

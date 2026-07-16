const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..")
const targetDir = path.join(root, "src", "generated", "prisma")
const target = path.join(targetDir, "index.ts")
const content = `export * from "./client"\nexport * as $Models from "./models"\n`

function main() {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, "utf-8")
    if (existing === content) {
      console.log("prisma index.ts already up to date")
      return
    }
  }

  fs.writeFileSync(target, content)
  console.log("Generated prisma index.ts")
}

try {
  main()
} catch (err) {
  console.error("Failed to generate prisma index.ts:", err.message)
  process.exit(1)
}

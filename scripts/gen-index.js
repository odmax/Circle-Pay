const fs = require("fs")
const path = require("path")

const target = path.join(__dirname, "..", "src", "generated", "prisma", "index.ts")
const content = `export * from "./client"\nexport * as $Models from "./models"\n`

if (!fs.existsSync(path.dirname(target))) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
}

fs.writeFileSync(target, content)
console.log("Generated prisma index.ts")

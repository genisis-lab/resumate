import { copyFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const source = join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs")
const destination = join(root, "public/vendor/pdf.worker.min.mjs")

mkdirSync(dirname(destination), { recursive: true })
copyFileSync(source, destination)

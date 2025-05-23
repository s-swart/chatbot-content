// scripts/promote-dev-to-prod.ts
//
// PURPOSE:
// This script promotes the dev versions of key scripts (e.g., generate-embeddings-metadata.ts, sync-resume-blurbs.ts)
// to their prod counterparts by copying them, updating the script flag and header comment,
// and overwriting the corresponding prod file.
//
// USE THIS WHEN:
// - You have validated your dev pipeline and are ready to promote it to prod
// - You want to enforce consistency between dev and prod script logic

import fs from 'fs'
import path from 'path'

// List of script pairs to promote
const SCRIPT_PAIRS = [
  {
    devPath: path.resolve(__dirname, 'dev/generate-embeddings-metadata.ts'),
    prodPath: path.resolve(__dirname, 'prod/generate-embeddings-metadata.ts')
  },
  {
    devPath: path.resolve(__dirname, 'dev/sync-resume-blurbs.ts'),
    prodPath: path.resolve(__dirname, 'prod/sync-resume-blurbs.ts')
  }
]

for (const { devPath, prodPath } of SCRIPT_PAIRS) {
  try {
    let content = fs.readFileSync(devPath, 'utf-8')

    // Replace script-level comment including filename
    const filename = path.basename(devPath)
    content = content.replace(
      new RegExp(`^// scripts/dev/${filename}`, 'm'),
      `// scripts/prod/${filename}`
    )

    // Insert or update version tag after header comment
    const versionTag = `// VERSION: v${new Date().toISOString().slice(0,10).replace(/-/g,'.')}-1`
    const lines = content.split('\n')
    if (lines.length > 1 && lines[1].startsWith('// VERSION:')) {
      lines[1] = versionTag
    } else {
      lines.splice(1, 0, versionTag)
    }
    content = lines.join('\n')

    // Replace flag
    content = content.replace(/const SCRIPT_ENV: 'dev'/, "const SCRIPT_ENV: 'prod'")

    fs.writeFileSync(prodPath, content)
    console.log(`🚀 Promoted: ${devPath} → ${prodPath}`)
  } catch (err) {
    console.error(`❌ Promotion failed for ${devPath}:`, err)
  }
}

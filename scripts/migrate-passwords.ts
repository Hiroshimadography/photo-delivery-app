/**
 * Migration script: Encrypt existing plain-text passwords in the projects table.
 *
 * Usage:
 *   npx tsx scripts/migrate-passwords.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PASSWORD_ENCRYPTION_KEY  (64-char hex string)
 *
 * Generate a key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { createClient } from '@supabase/supabase-js'
import { encryptPassword, isEncrypted } from '../src/utils/crypto'

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
        console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
        process.exit(1)
    }

    if (!process.env.PASSWORD_ENCRYPTION_KEY) {
        console.error('Missing PASSWORD_ENCRYPTION_KEY')
        console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
        process.exit(1)
    }

    const supabase = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    // Fetch all projects with passwords
    const { data: projects, error } = await supabase
        .from('projects')
        .select('id, password')
        .not('password', 'is', null)

    if (error) {
        console.error('Error fetching projects:', error)
        process.exit(1)
    }

    if (!projects || projects.length === 0) {
        console.log('No projects with passwords found.')
        return
    }

    let migrated = 0
    let skipped = 0

    for (const project of projects) {
        if (!project.password) continue

        // Skip already-encrypted passwords
        if (isEncrypted(project.password)) {
            skipped++
            continue
        }

        const encrypted = encryptPassword(project.password)

        const { error: updateError } = await supabase
            .from('projects')
            .update({ password: encrypted })
            .eq('id', project.id)

        if (updateError) {
            console.error(`Failed to migrate project ${project.id}:`, updateError)
        } else {
            migrated++
            console.log(`Migrated project ${project.id}`)
        }
    }

    console.log(`\nMigration complete: ${migrated} migrated, ${skipped} already encrypted, ${projects.length} total`)
}

main()

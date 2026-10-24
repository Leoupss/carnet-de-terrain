import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const CONTENU = 'src/content/especes'

type Changement = { etat: 'ajouté' | 'modifié' | 'supprimé'; chemin: string }

async function git(cwd: string, ...args: string[]): Promise<string> {
  try {
    // -c core.quotepath=false : garder les accents lisibles dans les chemins.
    const { stdout } = await exec('git', ['-c', 'core.quotepath=false', ...args], { cwd })
    return stdout
  } catch (e) {
    const err = e as { stderr?: string; message: string }
    throw new Error(`Échec de la publication : ${(err.stderr || err.message).trim()}`)
  }
}

export async function resume(cwd: string): Promise<{ changements: Changement[]; commitsEnAttente: number }> {
  const sortie = await git(cwd, 'status', '--porcelain', '--untracked-files=all', '--', CONTENU)
  const changements = sortie.split('\n').filter(Boolean).map((ligne): Changement => {
    const code = ligne.slice(0, 2)
    const etat = code.includes('D') ? 'supprimé' : code.includes('?') || code.includes('A') ? 'ajouté' : 'modifié'
    return { etat, chemin: ligne.slice(3).replace(`${CONTENU}/`, '') }
  })
  // Pas de branche amont configurée → rien en attente.
  const enAttente = await git(cwd, 'rev-list', '--count', '@{u}..HEAD').catch(() => '0')
  return { changements, commitsEnAttente: Number(enAttente.trim()) || 0 }
}

export async function publier(cwd: string): Promise<{ commit: boolean; pousse: boolean }> {
  const { changements } = await resume(cwd)
  let commit = false
  if (changements.length) {
    await git(cwd, 'add', '--all', '--', CONTENU)
    const n = changements.length
    await git(cwd, 'commit', '-m', `Catalogue : ${n} fichier${n > 1 ? 's' : ''} mis à jour`, '--', CONTENU)
    commit = true
  }
  if ((await resume(cwd)).commitsEnAttente === 0) return { commit, pousse: false }
  await git(cwd, 'push')
  return { commit, pousse: true }
}

import { it, expect, beforeEach } from 'vitest'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { resume, publier } from '../admin/publier'

let projet: string, distant: string
const git = (...args: string[]) => execFileSync('git', args, { cwd: projet, encoding: 'utf8' }).trim()
const ajouter = async (chemin: string) => {
  await mkdir(join(projet, chemin, '..'), { recursive: true })
  await writeFile(join(projet, chemin), 'x')
}

beforeEach(async () => {
  const base = await mkdtemp(join(tmpdir(), 'publier-'))
  distant = join(base, 'distant.git')
  projet = join(base, 'projet')
  execFileSync('git', ['init', '--bare', '-q', '-b', 'main', distant])
  execFileSync('git', ['init', '-q', '-b', 'main', projet])
  git('config', 'user.name', 'Test'); git('config', 'user.email', 't@t')
  await ajouter('README.md')
  git('add', '.'); git('commit', '-qm', 'init')
  git('remote', 'add', 'origin', distant); git('push', '-qu', 'origin', 'main')
})

it('résume les fichiers ajoutés du catalogue', async () => {
  await ajouter('src/content/especes/faune/vulpes-vulpes/fiche.md')
  expect(await resume(projet)).toEqual({
    changements: [{ etat: 'ajouté', chemin: 'faune/vulpes-vulpes/fiche.md' }],
    commitsEnAttente: 0,
  })
})

it('publie : commit puis push, et ne touche pas aux autres fichiers', async () => {
  await ajouter('src/content/especes/faune/vulpes-vulpes/fiche.md')
  await ajouter('autre.txt')
  expect(await publier(projet)).toEqual({ commit: true, pousse: true })
  expect(await resume(projet)).toEqual({ changements: [], commitsEnAttente: 0 })
  expect(git('status', '--porcelain')).toBe('?? autre.txt')
  expect(execFileSync('git', ['log', '--oneline', 'main'], { cwd: distant, encoding: 'utf8' })).toContain('Catalogue')
})

it('rien à publier', async () => {
  expect(await publier(projet)).toEqual({ commit: false, pousse: false })
})

it('push échoué : le commit reste et repart à la publication suivante', async () => {
  await ajouter('src/content/especes/faune/vulpes-vulpes/fiche.md')
  git('remote', 'set-url', 'origin', join(projet, 'introuvable'))
  await expect(publier(projet)).rejects.toThrow('Échec de la publication')
  expect((await resume(projet)).commitsEnAttente).toBe(1)
  git('remote', 'set-url', 'origin', distant)
  expect(await publier(projet)).toEqual({ commit: false, pousse: true })
  expect((await resume(projet)).commitsEnAttente).toBe(0)
})
